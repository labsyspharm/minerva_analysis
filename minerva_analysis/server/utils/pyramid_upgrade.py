# Via https://raw.githubusercontent.com/labsyspharm/ome-tiff-pyramid-tools/master/pyramid_upgrade.py
import argparse
import io
import re
import sys
from minerva_analysis.server.utils import tiffsurgeon
import xml.etree.ElementTree


def fix_attrib_namespace(elt):
    """Prefix un-namespaced XML attributes with the tag's namespace."""
    # This fixes ElementTree's inability to round-trip XML with a default
    # namespace ("cannot use non-qualified names with default_namespace option"
    # error). 7-year-old BPO issue here: https://bugs.python.org/issue17088
    # Code inspired by https://gist.github.com/provegard/1381912 .
    if elt.tag[0] == "{":
        uri, _ = elt.tag[1:].rsplit("}", 1)
        new_attrib = {}
        for name, value in elt.attrib.items():
            if name[0] != "{":
                # For un-namespaced attributes, copy namespace from element.
                name = f"{{{uri}}}{name}"
            new_attrib[name] = value
        elt.attrib = new_attrib
    for child in elt:
        fix_attrib_namespace(child)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert an OME-TIFF legacy pyramid to the BioFormats 6"
            " OME-TIFF pyramid format in-place.",
    )
    parser.add_argument("image", help="OME-TIFF file to convert")
    parser.add_argument(
        "-n",
        dest="channel_names",
        nargs="+",
        default=[],
        metavar="NAME",
        help="Channel names to be inserted into OME metadata. Number of names"
            " must match number of channels in image. Be sure to put quotes"
            " around names containing spaces or other special shell characters."
    )
    args = parser.parse_args()
    return args


def main(py_args=None):
    image_path = py_args['out_path']

    try:
        tiff = tiffsurgeon.TiffSurgeon(
            image_path, encoding="utf-8", writeable=True
        )
    except tiffsurgeon.FormatError as e:
        print(f"TIFF format error: {e}")
        sys.exit(1)

    tiff.read_ifds()

    # ElementTree doesn't parse xml declarations so we'll just run some sanity
    # checks that we do have UTF-8 and give it a decoded string instead of raw
    # bytes. We need to both ensure that the raw tag bytes decode properly and
    # that the declaration encoding is UTF-8 if present.
    try:
        omexml = tiff.ifds[0].tags.get_value(270, "")
    except FormatError:
        print("ImageDescription tag is not a valid UTF-8 string (not an OME-TIFF?)")
        sys.exit(1)
    if re.match(r'<\?xml [^>]*encoding="(?!UTF-8)[^"]*"', omexml):
        print("OME-XML is encoded with something other than UTF-8.")
        sys.exit(1)

    xml_ns = {"ome": "http://www.openmicroscopy.org/Schemas/OME/2016-06"}

    if xml_ns["ome"] not in omexml:
        print("Not an OME-TIFF.")
        sys.exit(1)
    if (
        "Faas" not in tiff.ifds[0].tags.get_value(305, "")
        or 330 in tiff.ifds[0].tags
    ):
        print("Not a legacy OME-TIFF pyramid.")
        sys.exit(1)

    # All XML manipulation assumes the document is valid OME-XML!
    root = xml.etree.ElementTree.fromstring(omexml)
    image = root.find("ome:Image", xml_ns)
    pixels = image.find("ome:Pixels", xml_ns)
    size_x = int(pixels.get("SizeX"))
    size_y = int(pixels.get("SizeY"))
    size_c = int(pixels.get("SizeC"))
    size_z = int(pixels.get("SizeZ"))
    size_t = int(pixels.get("SizeT"))
    num_levels = len(root.findall("ome:Image", xml_ns))
    page_dims = [(ifd.tags[256].value, ifd.tags[257].value) for ifd in tiff.ifds]

    if len(root) != num_levels:
        print("Top-level OME-XML elements other than Image are not supported.")
    if size_z != 1 or size_t != 1:
        print("Z-stacks and multiple timepoints are not supported.")
        sys.exit(1)
    if size_c * num_levels != len(tiff.ifds):
        print("TIFF page count does not match OME-XML Image elements.")
        sys.exit(1)
    if any(dims != (size_x, size_y) for dims in page_dims[:size_c]):
        print(f"TIFF does not begin with SizeC={size_c} full-size pages.")
        sys.exit(1)
    for level in range(1, num_levels):
        level_dims = page_dims[level * size_c : (level + 1) * size_c]
        if len(set(level_dims)) != 1:
            print(
                f"Pyramid level {level + 1} out of {num_levels} has inconsistent"
                f" sizes:\n{level_dims}"
            )
            sys.exit(1)

    print("Input image summary")
    print("===================")
    print(f"Dimensions: {size_x} x {size_y}")
    print(f"Number of channels: {size_c}")
    print(f"Pyramid sub-resolutions ({num_levels - 1} total):")
    for dim_x, dim_y in page_dims[size_c::size_c]:
        print(f"    {dim_x} x {dim_y}")
    software = tiff.ifds[0].tags.get_value(305, "<not set>")
    print(f"Software: {software}")
    print()

    print("Updating OME-XML metadata...")
    # We already verified there is nothing but Image elements under the root.
    for other_image in root[1:]:
        root.remove(other_image)
    for tiffdata in pixels.findall("ome:TiffData", xml_ns):
        pixels.remove(tiffdata)
    new_tiffdata = xml.etree.ElementTree.Element(
        f"{{{xml_ns['ome']}}}TiffData",
        attrib={"IFD": "0", "PlaneCount": str(size_c)},
    )
    # A valid OME-XML Pixels begins with size_c Channels; then comes TiffData.
    pixels.insert(size_c, new_tiffdata)

    fix_attrib_namespace(root)
    # ElementTree.tostring would have been simpler but it only supports
    # xml_declaration and default_namespace starting with Python 3.8.
    xml_file = io.BytesIO()
    tree = xml.etree.ElementTree.ElementTree(root)
    tree.write(
        xml_file,
        encoding="utf-8",
        xml_declaration=True,
        default_namespace=xml_ns["ome"],
    )
    new_omexml = xml_file.getvalue()

    print("Writing new TIFF headers...")
    stale_ranges = [ifd.offset_range for ifd in tiff.ifds]
    main_ifds = tiff.ifds[:size_c]
    channel_sub_ifds = [tiff.ifds[c + size_c : : size_c] for c in range(size_c)]
    for i, (main_ifd, sub_ifds) in enumerate(zip(main_ifds, channel_sub_ifds)):
        for ifd in sub_ifds:
            if 305 in ifd.tags:
                stale_ranges.append(ifd.tags[305].offset_range)
                del ifd.tags[305]
            ifd.tags.insert(tiff.append_tag_data(254, 3, 1))
        if i == 0:
            stale_ranges.append(main_ifd.tags[305].offset_range)
            stale_ranges.append(main_ifd.tags[270].offset_range)
            old_software = main_ifd.tags[305].value.replace("Faas", "F*a*a*s")
            new_software = f"pyramid_upgrade.py (was {old_software})"
            main_ifd.tags.insert(tiff.append_tag_data(305, 2, new_software))
            main_ifd.tags.insert(tiff.append_tag_data(270, 2, new_omexml))
        else:
            if 305 in main_ifd.tags:
                stale_ranges.append(main_ifd.tags[305].offset_range)
                del main_ifd.tags[305]
        sub_ifds[:] = tiff.append_ifd_sequence(sub_ifds)
        offsets = [ifd.offset for ifd in sub_ifds]
        main_ifd.tags.insert(tiff.append_tag_data(330, 16, offsets))
    main_ifds = tiff.append_ifd_sequence(main_ifds)
    tiff.write_first_ifd_offset(main_ifds[0].offset)

    print("Clearing old headers and tag values...")
    # We overwrite all the old IFDs and referenced data values with obvious
    # "filler" as a courtesy to anyone who might need to poke around in the TIFF
    # structure down the road. A real TIFF parser wouldn't see the stale data,
    # but a human might just scan for the first thing that looks like a run of
    # OME-XML and not realize it's been replaced with something else. The filler
    # content is the repeated string "unused " with square brackets at the
    # beginning and end of each filled IFD or data value.
    filler = b"unused "
    f_len = len(filler)
    for r in stale_ranges:
        tiff.file.seek(r.start)
        tiff.file.write(b"[")
        f_total = len(r) - 2
        for i in range(f_total // f_len):
            tiff.file.write(filler)
        tiff.file.write(b" " * (f_total % f_len))
        tiff.file.write(b"]")

    tiff.close()

    print()
    print("Success!")


if __name__ == "__main__":
    main()
