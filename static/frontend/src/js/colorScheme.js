colorScheme = {};


colorScheme.classColors = {
    '-': '#ffa500',
    0: '#1f78b4',
    1: '#e31a1c',
    2: '#33a02c',
    3: '#6a3d9a',
    4: '#b15928',
    5: '#ffff99',
    6: '#a6cee3',
    7: '#b2df8a',
    8: '#fb9a99',
    9: '#cab2d6'
}

colorScheme.classColorsLight = {
    '-': '#ffa500',
    0: '#8dd3c7',
    1: '#ffffb3',
    2: '#bebada',
    3: '#fb8072',
    4: '#80b1d3',
    5: '#fdb462',
    6: '#b3de69',
    7: '#fccde5',
    8: '#d9d9d9',
    9: '#cab2d6'
}

//colorScheme.classColors = {'-' : 'orange', 0 : '#E41A1C', 1 : '#377EB8', 2 : '#4DAF4A', 3: '#984EA3' }
// colorScheme.classRGBColors = [[27,201,127],[190,174,212],[253,192,134],[255,255,153],[56,108,176]]


colorScheme.classrColors = {
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
//colorScheme.classrColors = {'-' : [255,165,0], "0" : [141,211,199], "1" : [255,255,179], "2" : [190,186,218], "3": [251,128,114] }

//when colors are cycled 1 time start at front (but not orange, thats the highlight color
colorScheme.retrieveClassColor = function (classNumber) {
    if (classNumber == '-') {
        return colorScheme.classColors[classNumber];
    }
    return colorScheme.classColors[classNumber % 10];
}


colorScheme.hexToRgb = function (hex) {
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return r + "," + g + "," + b;
}

colorScheme.rgbToHex = function (r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

colorScheme.lightenColor = function (color, percent) {
    color = color.slice(1, color.length);
    var num = parseInt(color, 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        B = (num >> 8 & 0x00FF) + amt,
        G = (num & 0x0000FF) + amt;

    var res = (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    // var res = rgbToHex(res);
    return '#' + res;
};

colorScheme.hexToRGB = function (hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}