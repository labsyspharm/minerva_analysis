/*
LFilters
 + Some filters from National Institute of Standards and Technology (indicated below)
   - https://github.com/usnistgov/OpenSeadragonFiltering/blob/master/openseadragon-filtering.js
 + Fisheye magnification demo from jOloga
   - https://codepen.io/jOlga/pen/KyQMQW?editors=0010
 + Color differences
   - https://www.compuphase.com/cmetric.htm
 + Gamma
   - https://stackoverflow.com/questions/16521003/gamma-correction-formula-gamma-or-1-gamma
 + Sobel edge
   - https://stackoverflow.com/questions/17815687/image-processing-implementing-sobel-filter
   - https://github.com/miguelmota/sobel
 */

export default class Lenses {

    // Class refs
    lensing = null;

    // Configs
    config = {
        preserve: 0.75,
        scale: 1
    };

    // Selections
    selections = {
        filter: null,
        magnifier: null
    };

    // Data
    img_data = {
        orig: null,
        copy: null,
        copy_indexed: []
    };

    /*
    CONSTRUCTOR
     */
    constructor(_lensing) {
        // Fields
        this.lensing = _lensing;
        // Defaults
        this.selections.filter = this.filters[0];
        this.selections.magnifier = this.magnifiers[0];
    }

    /*
    modify
     */
    modify(imgD) {

        // Do not need deep copy atm
        this.img_data.orig = imgD;
        this.img_data.copy = {
            data: []
        };
        this.img_data.copy_indexed = [];

        // Iterate and update
        if (this.selections.filter.settings.iter === 'px') {
            let index = 0;
            for (let i = 0; i < this.img_data.orig.data.length; i += 4) {
                // Copy
                this.img_data.copy.data.push(
                    this.img_data.orig.data[i],
                    this.img_data.orig.data[i + 1],
                    this.img_data.orig.data[i + 2],
                    this.img_data.orig.data[i + 3]
                );
                // Update filter
                this.selections.filter.update(i, index);
                // Increment index
                index++;
            }
        } else if (this.selections.filter.settings.iter === 'wh') {
            // Copy
            for (let y = 0; y < this.img_data.orig.height; y++) {
                for (let x = 0; x < this.img_data.orig.width; x++) {
                    // Update filter
                    this.selections.filter.update(x, y);
                }
            }
        }

        // Return modified image data
        const copyData = new Uint8ClampedArray(this.img_data.copy.data);
        const copyImageData = new ImageData(copyData, this.img_data.orig.width, this.img_data.orig.height);
        // KEEP4REF // console.log(copyImageData, Math.sqrt(copyImageData.data.length / 4));
        return copyImageData;
    }

    /*
    change_lens
     */
    change_lens(direction, lensType) {
        let lensSet = [];
        if (lensType === 'filter') {
            lensSet = this.filters;
        } else if (lensType === 'magnifier') {
            lensSet = this.magnifiers;
        }
        let index = 0;
        if (direction === 'none') {
            this.selections[lensType] = lensSet[index];
        } else {
            lensSet.forEach((f, i) => {
                if (f.name === this.selections[lensType].name) {
                    index = i;
                }
            });
            if (direction === 'next') {
                if (index + 1 === lensSet.length) {
                    this.selections[lensType] = lensSet[0];
                } else {
                    this.selections[lensType] = lensSet[index + 1];
                }
            } else if (direction === 'prev') {
                if (index - 1 < 0) {
                    this.selections[lensType] = lensSet[this.filters.length - 1];
                } else {
                    this.selections[lensType] = this.filters[index - 1];
                }
            }
        }
    }

    /*
    update_filter
     */
    update_filter(val) {

        // Update filter
        this.selections.filter.settings.active = val;
    }

    /*
    filters
     */
    filters = [
        // Natural
        {
            name: 'fil_none',
            vis_name: 'No Filter',
            settings: {
                active: 1,
                default: 1,
                max: 1,
                min: 0,
                step: 1,
                vf: false,
                iter: 'px'
            },
            update: (i, index) => {
                // Magnify
                this.selections.magnifier.update(i, index);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // data_rgb
        {
            name: 'fil_data_rgb',
            vis_name: 'Data RGB',
            settings: {
                active: 1,
                default: 1,
                max: 1,
                min: 0,
                step: 1,
                vf: true,
                iter: 'px'
            },
            update: (i, index) => {

                // TODO - thinking of optimizing - trial work in 'test' - no big breakthrough :^(
                const test = false;

                if (test) {

                    const sel = this.lensing.configs.pxData.sel;
                    // Compare
                    const r_mean = (this.img_data.copy.data[i] + +sel.r) / 2;
                    const r_diff = this.img_data.copy.data[i] - +sel.r;
                    const g_diff = this.img_data.copy.data[i + 1] - +sel.g;
                    const b_diff = this.img_data.copy.data[i + 2] - +sel.b;
                    const cDiff = Math.sqrt(
                        (2 + r_mean / 256) * r_diff ** 2
                        + 4 * g_diff ** 2
                        + (2 + (255 - r_mean) / 256) * b_diff ** 2
                    );
                    // Eval
                    if (cDiff <= this.lensing.configs.pxData.range) {
                        this.img_data.copy.data[i] = this.lensing.configs.pxData.sel.r;
                        this.img_data.copy.data[i + 1] = this.lensing.configs.pxData.sel.g;
                        this.img_data.copy.data[i + 2] = this.lensing.configs.pxData.sel.b;
                    } else {
                        this.img_data.copy.data[i] = this.img_data.copy.data[i] + 255 / 2;
                        this.img_data.copy.data[i + 1] = this.img_data.copy.data[i] + 255 / 2;
                        this.img_data.copy.data[i + 2] = this.img_data.copy.data[i] + 255 / 2;
                    }

                } else {

                    // See if matches selected
                    let selected = null;
                    let diff = 255 * 3;
                    // Iterate
                    this.lensing.data.forEach((d, j) => {
                        const r_mean = (this.img_data.copy.data[i] + +d.r) / 2;
                        const r_diff = this.img_data.copy.data[i] - +d.r;
                        const g_diff = this.img_data.copy.data[i + 1] - +d.g;
                        const b_diff = this.img_data.copy.data[i + 2] - +d.b;
                        const cDiff = Math.sqrt(
                            (2 + r_mean / 256) * r_diff ** 2
                            + 4 * g_diff ** 2
                            + (2 + (255 - r_mean) / 256) * b_diff ** 2
                        );
                        // If smaller difference
                        if (cDiff < diff) {
                            diff = cDiff;
                            selected = d;
                        }
                    });
                    if (selected.name === this.lensing.configs.pxData.sel.name) {
                        this.img_data.copy.data[i] = this.lensing.configs.pxData.sel.r;
                        this.img_data.copy.data[i + 1] = this.lensing.configs.pxData.sel.g;
                        this.img_data.copy.data[i + 2] = this.lensing.configs.pxData.sel.b;
                    } else {
                        this.img_data.copy.data[i] = this.img_data.copy.data[i] + 255 / 2;
                        this.img_data.copy.data[i + 1] = this.img_data.copy.data[i] + 255 / 2;
                        this.img_data.copy.data[i + 2] = this.img_data.copy.data[i] + 255 / 2;
                    }
                }

                // Magnify
                this.selections.magnifier.update(i, index);
                // Pass data to viewfinder
                this.lensing.viewfinder.update_box_test(this.lensing.configs.pxData)
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Sobel Edge
        {
            name: 'fil_sobeledge',
            vis_name: 'Sobel Edge',
            settings: {
                active: 127,
                default: 127,
                max: 255,
                min: 0,
                step: 1,
                vf: false,
                iter: 'wh'
            },
            update: (x, y) => {

                // TODO - need to optimize - slow performance

                // Define this
                const vis = this;
                // Kernals
                const sobel_x = [
                    [-1, 0, 1],
                    [-2, 0, 2],
                    [-1, 0, 1]
                ];
                const sobel_y = [
                    [-1, -2, -1],
                    [0, 0, 0],
                    [1, 2, 1]
                ];

                // Px location
                function getPxLoc(xx, yy) {
                    return ((yy * vis.img_data.orig.width) + xx) * 4;
                }

                // To grayscale
                function toGrayscale(i) {
                    return Math.round(
                        vis.img_data.orig.data[i] * 0.2126
                        + vis.img_data.orig.data[i + 1] * 0.7152
                        + vis.img_data.orig.data[i + 2] * 0.0722
                    );
                }

                // To Pixel vals
                function returnPixel(arr) {
                    if (x >= 0 && x < vis.img_data.orig.width - 1 && y >= 0 && y < vis.img_data.orig.height - 1) {
                        return (arr[0][0] * toGrayscale(getPxLoc(x - 1, y - 1)))
                            + (arr[0][1] * toGrayscale(getPxLoc(x, y - 1)))
                            + (arr[0][2] * toGrayscale(getPxLoc(x + 1, y - 1)))
                            + (arr[1][0] * toGrayscale(getPxLoc(x - 1, y)))
                            + (arr[1][1] * toGrayscale(getPxLoc(x, y)))
                            + (arr[1][2] * toGrayscale(getPxLoc(x + 1, y)))
                            + (arr[2][0] * toGrayscale(getPxLoc(x - 1, y + 1)))
                            + (arr[2][1] * toGrayscale(getPxLoc(x, y + 1)))
                            + (arr[2][2] * toGrayscale(getPxLoc(x + 1, y + 1)));
                    }
                    return 0;
                }

                const pixel_x = returnPixel(sobel_x);
                const pixel_y = returnPixel(sobel_y);
                let val = Math.round(Math.sqrt(pixel_x * pixel_x + pixel_y * pixel_y));
                const px_loc = getPxLoc(x, y);
                this.img_data.copy.data.push(this.img_data.orig.data[px_loc], this.img_data.orig.data[px_loc + 1],
                    this.img_data.orig.data[px_loc + 2], this.img_data.orig.data[px_loc + 3])
                this.img_data.copy.data[px_loc] = this.img_data.copy.data[px_loc + 1] = this.img_data.copy.data[px_loc + 2] = val;

                // Magnify
                this.selections.magnifier.update(px_loc, px_loc / 4);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Grayscale (from some source TODO - check 'rangi' work)
        {
            name: 'fil_grayscale',
            vis_name: 'Grayscale',
            settings: {
                active: 127,
                default: 127,
                max: 255,
                min: 0,
                step: 1,
                vf: false,
                iter: 'px'
            },
            update: (i, index) => {
                // Perform pixel modification
                const set = this.selections.filter.settings.active;
                const gray = Math.round(
                    this.img_data.copy.data[i] * 0.2126
                    + this.img_data.copy.data[i + 1] * 0.7152
                    + this.img_data.copy.data[i + 2] * 0.0722
                );
                this.img_data.copy.data[i] = this.img_data.copy.data[i + 1] = this.img_data.copy.data[i + 2] = gray;
                // Magnify
                this.selections.magnifier.update(i, index);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Invert
        {
            name: 'fil_invert',
            vis_name: 'Invert',
            settings: {
                active: 255,
                default: 255,
                max: 255,
                min: 0,
                step: 1,
                vf: false,
                iter: 'px'
            },
            update: (i, index) => {
                // Perform pixel modification
                const set = this.selections.filter.settings.active;

                function invert(v) {
                    return Math.abs(set - v);
                }

                this.img_data.copy.data[i] = invert(this.img_data.copy.data[i]);
                this.img_data.copy.data[i + 1] = invert(this.img_data.copy.data[i + 1]);
                this.img_data.copy.data[i + 2] = invert(this.img_data.copy.data[i + 2]);
                // Magnify
                this.selections.magnifier.update(i, index);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Threshold (from NIST)
        {
            name: 'fil_threshold',
            vis_name: 'Threshold',
            settings: {
                active: 127,
                default: 127,
                max: 255,
                min: 0,
                step: 1,
                vf: false,
                iter: 'px'
            },
            update: (i, index) => {
                // Perform pixel modification
                const set = this.selections.filter.settings.active;
                const sum = (this.img_data.copy.data[i] + this.img_data.copy.data[i + 1]
                    + this.img_data.copy.data[i + 2]) / 3;
                this.img_data.copy.data[i] = this.img_data.copy.data[i + 1] = this.img_data.copy.data[i + 2]
                    = sum < set ? 0 : 255;
                // Magnify
                this.selections.magnifier.update(i, index);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Gamma (from SO - Deepu and Guffa)
        {
            name: 'fil_gamma',
            vis_name: 'Gamma',
            settings: {
                active: 2.2,
                default: 2.2,
                max: 5.5,
                min: 0,
                step: 0.1,
                vf: false,
                iter: 'px'
            },
            update: (i, index) => {
                // Perform pixel modification
                const set = this.selections.filter.settings.active;

                function gamma(v) {
                    return 255 * (v / 255) ** (1 / set);
                    // return Math.pow(v / 255, set) * 255;
                }

                this.img_data.copy.data[i] = gamma(this.img_data.copy.data[i]);
                this.img_data.copy.data[i + 1] = gamma(this.img_data.copy.data[i + 1]);
                this.img_data.copy.data[i + 2] = gamma(this.img_data.copy.data[i + 2]);
                // Magnify
                this.selections.magnifier.update(i, index);
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },

    ];

    /*
    magnifiers
     */
    magnifiers = [
        // None
        {
            name: 'mag_standard',
            vis_name: 'Standard',
            settings: {
                active: 1,
                default: 1,
                max: 10,
                min: 1,
                step: 0.5,
                vf: false
            },
            update: (i, index) => {
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Fisheye - from jOloga
        {
            name: 'mag_fisheye',
            vis_name: 'Fisheye',
            settings: {
                active: 1,
                default: 1,
                max: 2,
                min: 1,
                step: 0.5,
                vf: false
            },
            update: (i, index) => {
                // Add to copy index
                this.img_data.copy_indexed.push([
                    this.img_data.copy.data[i],
                    this.img_data.copy.data[i + 1],
                    this.img_data.copy.data[i + 2],
                    this.img_data.copy.data[i + 3]
                ]);

                // Check if at end
                if (i + 4 === this.img_data.orig.data.length) {
                    // Get fisheye result
                    const wh = this.lensing.configs.rad * 2 * this.lensing.configs.mag;
                    const result = fisheye(this.img_data.copy_indexed, wh, wh);
                    // Update copy
                    for (let j = 0; j < result.length; j++) {
                        const reIndex = 4 * j;
                        if (result[j]) {
                            this.img_data.copy.data[reIndex] = result[j][0];
                            this.img_data.copy.data[reIndex + 1] = result[j][1];
                            this.img_data.copy.data[reIndex + 2] = result[j][2];
                            this.img_data.copy.data[reIndex + 3] = result[j][3];
                        }
                    }

                }

                // fisheye()
                function fisheye(srcpixels, w, h) {

                    const dstpixels = srcpixels.slice();

                    for (let y = 0; y < h; y++) {
                        const ny = ((2 * y) / h) - 1;
                        const ny2 = ny * ny;

                        for (let x = 0; x < w; x++) {
                            const nx = ((2 * x) / w) - 1;
                            const nx2 = nx * nx;
                            const r = Math.sqrt(nx2 + ny2);

                            if (0.0 <= r && r <= 1.0) {
                                let nr = Math.sqrt(1.0 - r * r);
                                nr = (r + (1.0 - nr)) / 2.0;

                                if (nr <= 1.0) {
                                    const theta = Math.atan2(ny, nx);
                                    const nxn = nr * Math.cos(theta);
                                    const nyn = nr * Math.sin(theta);
                                    const x2 = Math.round(((nxn + 1) * w) / 2);
                                    const y2 = Math.round(((nyn + 1) * h) / 2);
                                    const srcpos = y2 * w + x2;
                                    if (srcpos >= 0 && srcpos < w * h) {
                                        dstpixels[y * w + x] = srcpixels[srcpos];
                                    }
                                }
                            }
                        }
                    }
                    return dstpixels;
                }
            },
            fill: 'rgba(255, 255, 255, 0)',
            stroke: 'rgba(0, 0, 0, 1)'
        },
        // Plateau
        /*
        {
            name: 'mag_plateau',
            vis_name: 'Plateau',
            settings: {
                active: 1,
                default: 1,
                max: 10,
                min: 1,
                step: 0.5,
                vf: false
            },
            update: (i, index) => {

                // Get x, y, and r
                let x = index % this.d.width;
                if (x < this.wh) {
                    x += -this.d.width / 2;
                } else {
                    x += -this.d.width / 2 + 1;
                }
                let y = Math.floor(index / this.d.width);
                if (y < this.wh) {
                    y += -this.d.height / 2;
                } else {
                    y += -this.d.height / 2 + 1;
                }
                const r = Math.sqrt(x ** 2 + y ** 2);

                // Get pixels
                const threshold = this.d.width * this.scale * 0.5;
                if (x <= threshold && x >= -threshold &&
                    y <= threshold && y >= -threshold) {
                    if (r <= this.wh * 0.5 * this.preserve) {
                        this.img_data.copy.push(this.d.data[i], this.d.data[i + 1], this.d.data[i + 2], this.d.data[i + 3]);
                    } else {
                        this.img_data.copy.push(0, 0, 0, 255);
                    }

                }
            },
        },
        */
    ];

}

/*
 ref.
    + https://stackoverflow.com/questions/17615963/standard-rgb-to-grayscale-conversion
    + https://stackoverflow.com/questions/16521003/gamma-correction-formula-gamma-or-1-gamma
 */