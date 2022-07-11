from os import walk



mask_types = ["cell", "cellRing", "cyto", "cytoRing", "nuclei", "nucleiRing"]
files = []
for (dirpath, dirnames, filenames) in walk("C:\\Users\Rkrueger\\Documents\\lsp\\mcmicro\\segmentation\\unmicst-smpl"):
    for (file) in filenames:
        file = file.split('.')[0]
        if file in mask_types:
            files.append(file)
    print(files)

