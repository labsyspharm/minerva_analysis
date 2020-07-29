class ColorScheme {
    constructor(dataFilter) {
        this.dataFilter = dataFilter;
        this.colorMap = {};
        this.phenotypes = [];
        this.colorScheme = [];
    }

    async init() {
        try {
            this.phenotypes = this.dataFilter.getPhenotypes();
            this.colorScheme = await this.dataFilter.getColorScheme(this.phenotypes);
            this.colorMap = {}
            _.each(this.phenotypes, (phenotype, n) => {
                let color = _.nth(this.colorScheme, n)
                // Converting colorLab color to RGB
                this.colorMap[phenotype] = convert.lab.rgb(color)
            })
        } catch (e) {
            console.log("Error Getting Color Palette", e)

        }
    }

    getPhenotypeColor(phenotype) {
        return this.colorMap[phenotype];
    }

    getPhenotypeColorHex(phenotype) {
        let color = this.colorMap[phenotype];
        return convert.rgb.hex(color);
    }

    classrColors = {
        '-': [255, 165, 0],
        "0": [31, 120, 180],
        "1": [227, 26, 28],
        "2": [51, 160, 44],
        "3": [106, 61, 154],
        "4": [177, 89, 40],
        "5": [255, 255, 153],
        "6": [166, 206, 227],
        "7": [178, 223, 138],
        "8": [251, 154, 153],
        "9": [202, 178, 214]
    }
}

// colorScheme.classColors = {
//     '-': '#ffa500',
//     0: '#1f78b4',
//     1: '#e31a1c',
//     2: '#33a02c',
//     3: '#6a3d9a',
//     4: '#b15928',
//     5: '#ffff99',
//     6: '#a6cee3',
//     7: '#b2df8a',
//     8: '#fb9a99',
//     9: '#cab2d6'
// }
//
// colorScheme.
// //colorScheme.classrColors = {'-' : [255,165,0], "0" : [141,211,199], "1" : [255,255,179], "2" : [190,186,218], "3": [251,128,114] }




