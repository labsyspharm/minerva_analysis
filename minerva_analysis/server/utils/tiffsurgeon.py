# Via https://raw.githubusercontent.com/labsyspharm/ome-tiff-pyramid-tools/master/tiffsurgeon.py
import collections
import dataclasses
import fractions
import io
import os
import re
import reprlib
import struct
from typing import List, Any
import warnings


datatype_formats = {
    1: "B", # BYTE
    2: "s", # ASCII
    3: "H", # SHORT
    4: "I", # LONG
    5: "I", # RATIONAL (pairs)
    6: "b", # SBYTE
    7: "B", # UNDEFINED
    8: "h", # SSHORT
    9: "i", # SLONG
    10: "i", # SRATIONAL (pairs)
    11: "f", # FLOAT
    12: "d", # DOUBLE
    13: "I", # IFD
    16: "Q", # LONG8
    17: "q", # SLONG8
    18: "Q", # IFD8
}
rational_datatypes = {5, 10}


class TiffSurgeon:
    """Read, manipulate and write IFDs in BigTIFF files."""

    def __init__(self, path, *, writeable=False, encoding=None):
        self.path = path
        self.writeable = writeable
        self.encoding = encoding
        self.endian = ""
        self.ifds = None
        self.file = open(self.path, "r+b" if self.writeable else "rb")
        self._validate()

    def _validate(self):
        signature = self.read("2s")
        signature = signature.decode("ascii", errors="ignore")
        if signature == "II":
            self.endian = "<"
        elif signature == "MM":
            self.endian = ">"
        else:
            raise FormatError(f"Not a TIFF file (signature is '{signature}').")
        self.version = self.read("H")
        if self.version == 42:
            self.offset_size = 4
            self.offset_format = "I"
            self.ntags_size = 2
            self.ntags_format = "H"
            self.tag_size = 12
            self.first_ifd_offset_offset = 4
            self.first_ifd_offset = self.read("I")
        elif self.version == 43:
            offset_size, reserved, first_ifd_offset = self.read("H H Q")
            if offset_size != 8 or reserved != 0:
                raise FormatError(
                    f"Malformed BigTIFF: offset_size={offset_size}"
                    f" reserved={reserved}"
                )
            self.offset_size = 8
            self.offset_format = "Q"
            self.ntags_size = 8
            self.ntags_format = "Q"
            self.tag_size = 20
            self.first_ifd_offset_offset = 8
            self.first_ifd_offset = first_ifd_offset
        else:
            raise FormatError(f"Unknown TIFF version: {self.version}")

    def read(self, fmt, *, file=None):
        if file is None:
            file = self.file
        endian = self.endian or "="
        size = struct.calcsize(endian + fmt)
        raw = file.read(size)
        value = self.unpack(fmt, raw)
        return value

    def write(self, fmt, *values):
        if not self.writeable:
            raise ValueError("File is opened as read-only.")
        raw = self.pack(fmt, *values)
        self.file.write(raw)

    def unpack(self, fmt, raw):
        assert self.endian or re.match(r"\d+s", fmt), \
            "can't unpack non-string before endianness is detected"
        fmt = self.endian + fmt
        size = struct.calcsize(fmt)
        values = struct.unpack(fmt, raw[:size])
        if len(values) == 1:
            return values[0]
        else:
            return values

    def pack(self, fmt, *values):
        assert self.endian, "can't pack without endian set"
        fmt = self.endian + fmt
        raw = struct.pack(fmt, *values)
        return raw

    @property
    def tag_format(self):
        return f"H H {self.offset_format} {self.offset_size}s"

    def read_ifds(self):
        ifds = [self.read_ifd(self.first_ifd_offset)]
        while ifds[-1].offset_next:
            ifds.append(self.read_ifd(ifds[-1].offset_next))
        self.ifds = ifds

    def read_ifd(self, offset):
        self.file.seek(offset)
        num_tags = self.read(self.ntags_format)
        buf = io.BytesIO(self.file.read(num_tags * self.tag_size))
        offset_next = self.read(self.offset_format)
        offset_range = range(offset, self.file.tell())
        try:
            tags = TagSet([self.read_tag(buf) for i in range(num_tags)])
        except FormatError as e:
            raise FormatError(f"IFD at offset {offset}, {e}") from None
        ifd = Ifd(tags, offset, offset_next, offset_range)
        return ifd

    def read_tag(self, buf):
        tag = Tag(*self.read(self.tag_format, file=buf))
        value, offset_range = self.tag_value(tag)
        tag = dataclasses.replace(tag, value=value, offset_range=offset_range)
        return tag

    def append_ifd_sequence(self, ifds):
        """Write list of IFDs as a chained sequence at the end of the file.

        Returns a list of new Ifd objects with updated offsets.

        """
        self.file.seek(0, os.SEEK_END)
        new_ifds = []
        for ifd in ifds:
            offset = self.file.tell()
            self.write(self.ntags_format, len(ifd.tags))
            for tag in ifd.tags:
                self.write_tag(tag)
            offset_next = (
                self.file.tell() + self.offset_size if ifd is not ifds[-1] else 0
            )
            self.write(self.offset_format, offset_next)
            offset_range = range(offset, self.file.tell())
            new_ifd = dataclasses.replace(
                ifd,
                offset=offset,
                offset_next=offset_next,
                offset_range=offset_range,
            )
            new_ifds.append(new_ifd)
        return new_ifds

    def append_tag_data(self, code, datatype, value):
        """Build new tag and write data to the end of the file if necessary.

        Returns a Tag object corresponding to the passed parameters. This
        function only writes any "overflow" data and not the IFD entry itself,
        so the returned Tag must still be written to an IFD.

        If the value is small enough to fit in the data field within an IFD, no
        data will actually be written to the file and the returned Tag object
        will have the value encoded in its data attribute. Otherwise the data
        will be appended to the file and the returned Tag's data attribute will
        encode the corresponding offset.

        """
        fmt = datatype_formats[datatype]
        # FIXME Should we perform our own check that values match datatype?
        # struct.pack will do it but the exception won't be as understandable.
        original_value = value
        if isinstance(value, str):
            if not self.encoding:
                raise ValueError(
                    "ASCII tag values must be bytes if encoding is not set"
                )
            value = [value.encode(self.encoding) + b"\x00"]
            count = len(value[0])
        elif isinstance(value, bytes):
            value = [value + b"\x00"]
            count = len(value[0])
        else:
            try:
                len(value)
            except TypeError:
                value = [value]
            count = len(value)
        struct_count = count
        if datatype in rational_datatypes:
            value = [i for v in value for i in v.as_integer_ratio()]
            count //= 2
        byte_count = struct_count * struct.calcsize(fmt)
        if byte_count <= self.offset_size:
            data = self.pack(str(struct_count) + fmt, *value)
            data += bytes(self.offset_size - byte_count)
        else:
            self.file.seek(0, os.SEEK_END)
            data = self.pack(self.offset_format, self.file.tell())
            self.write(str(count) + fmt, *value)
        # TODO Compute and set offset_range.
        tag = Tag(code, datatype, count, data, original_value)
        return tag

    def write_first_ifd_offset(self, offset):
        self.file.seek(self.first_ifd_offset_offset)
        self.write(self.offset_format, offset)

    def write_tag(self, tag):
        self.write(self.tag_format, tag.code, tag.datatype, tag.count, tag.data)

    def tag_value(self, tag):
        """Return decoded tag data and the file offset range."""
        fmt = datatype_formats[tag.datatype]
        count = tag.count
        if tag.datatype in rational_datatypes:
            count *= 2
        byte_count = count * struct.calcsize(fmt)
        if byte_count <= self.offset_size:
            value = self.unpack(str(count) + fmt, tag.data)
            offset_range = range(0, 0)
        else:
            offset = self.unpack(self.offset_format, tag.data)
            self.file.seek(offset)
            value = self.read(str(count) + fmt)
            offset_range = range(offset, offset + byte_count)
        if tag.datatype == 2:
            value = value.rstrip(b"\x00")
            if self.encoding:
                try:
                    value = value.decode(self.encoding)
                except UnicodeDecodeError as e:
                    raise FormatError(f"tag {tag.code}: {e}") from None
        elif tag.datatype in rational_datatypes:
            value = [
                fractions.Fraction(*v) for v in zip(value[::2], value[1::2])
            ]
            if len(value) == 1:
                value = value[0]
        return value, offset_range

    def close(self):
        self.file.close()


@dataclasses.dataclass(frozen=True)
class Tag:
    code: int
    datatype: int
    count: int
    data: bytes
    value: Any = None
    offset_range: range = None

    _vrepr = reprlib.Repr()
    _vrepr.maxstring = 60
    _vrepr.maxother = 60
    vrepr = _vrepr.repr

    def __repr__(self):
        return (
            self.__class__.__qualname__ + "("
            + f"code={self.code!r}, datatype={self.datatype!r}, "
            + f"count={self.count!r}, data={self.data!r}, "
            + f"value={self.vrepr(self.value)}"
            + ")"
        )

@dataclasses.dataclass(frozen=True)
class TagSet:
    """Container for Tag objects as stored in a TIFF IFD.

    Tag objects are maintained in a list that's always sorted in ascending order
    by the tag code. Only one tag for a given code may be present, which is where
    the "set" name comes from.

    """

    tags: List[Tag] = dataclasses.field(default_factory=list)

    def __post_init__(self):
        code_counter = collections.Counter(self.codes)
        dups = [item for item, count in code_counter.items() if count > 1]
        if dups:
            warnings.warn(f"Duplicate tags: {dups}")

    def __repr__(self):
        ret = type(self).__name__ + "(["
        if self.tags:
            ret += "\n"
        ret += "".join([f"    {t},\n" for t in self.tags])
        ret += "])"
        return ret

    @property
    def codes(self):
        return [t.code for t in self.tags]

    def __getitem__(self, code):
        for t in self.tags:
            if code == t.code:
                return t
        else:
            raise KeyError(code)

    def __delitem__(self, code):
        try:
            i = self.codes.index(code)
        except ValueError:
            raise KeyError(code) from None
        self.tags[:] = self.tags[:i] + self.tags[i+1:]

    def __contains__(self, code):
        return code in self.codes

    def __len__(self):
        return len(self.tags)

    def __iter__(self):
        return iter(self.tags)

    def get(self, code, default=None):
        try:
            return self[code]
        except KeyError:
            return default

    def get_value(self, code, default=None):
        tag = self.get(code)
        if tag:
            return tag.value
        else:
            return default

    def insert(self, tag):
        """Add a new tag or replace an existing one."""
        for i, t in enumerate(self.tags):
            if tag.code == t.code:
                self.tags[i] = tag
                return
            elif tag.code < t.code:
                break
        else:
            i = len(self.tags)
        n = len(self.tags)
        self.tags[i:n+1] = [tag] + self.tags[i:n]


@dataclasses.dataclass(frozen=True)
class Ifd:
    tags: TagSet
    offset: int
    offset_next: int
    offset_range: range = dataclasses.field(repr=False)


class FormatError(Exception):
    pass
