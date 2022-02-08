/**
 * viewer.js.
 * @class ImageViewer to render multiplexed imaging data (based on OpenSeadragon)
 *
 */

/* todo
 1. major - the viewer managers should not be looking up the same renderTF
 */

class ImageViewer {

    // Vars
    viewerManagers = [];

    /**
     * @constructor
     * @param config the cinfiguration file (json)
     * @param dataLayer - the data layer (stub) that executes server requests and holds client side data
     * @param eventHandler - the event handler for distributing interface and data updates
     * @param colorScheme - the color scheme to use or selections etc.
     */
    constructor(config, dataLayer, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;
        this.channelList = channelList;

        // Viewer
        this.viewer = {};

        // OSD plugins

        // Stores the ordered contents of the tile cache, so that once we hit max size we remove oldest elements
        this.pendingTiles = new Map();


        // Map of selected ids, key is id
        this.selection = new Map();
        this.data = new Map();

        // Currently loaded label channels
        this.labelChannel = {};
        this.noLabel = false;
        this.sel_outlines = true;
        this.show_scalebar = true;

        // Selection polygon (array of xy positions)
        this.selectionPolygonToDraw = [];

        // Transfer function constant
        this.numTFBins = 1024;

        // Transfer function per channel (min,max, start color, end color)
        this.channelTF = [];
        for (let i = 0; i < this.config["imageData"].length; i = i + 1) {

            const start_color = d3.rgb(0, 0, 0);
            const end_color = d3.rgb(255, 255, 255);

            const tf_def = this.createTFArray(0, 65535, start_color, end_color, this.numTFBins);
            tf_def.name = this.config['imageData'][i].name;

            this.channelTF.push(tf_def);
        }

        // Applying TF to selection, subset, or all
        this.show_subset = false;
        this.show_selection = true;

    }

    /**
     * @function init - initializes OSD, loads metadata, tile drawing, etc.
     */
    init() {

        // Define this as that
        const that = this;

        // Hide Loader
        document.getElementById('openseadragon_loader').style.display = "none";

        // Config viewer
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/client/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 100,
            timeout: 90000,
            compositeOperation: 'lighter',
            preload: false,
            homeFillsViewer: true,
            visibilityRatio: 1.0
        };


        // Instantiate viewer with the ViaWebGL Version of OSD
        that.viewer = viaWebGL.OpenSeadragon(viewer_config);

        /************************************************************************************** Get ome tiff metadata */

        dataLayer.getMetadata().then(d => {
            that.imgMetadata = d;
            console.log('Image metadata:', that.imgMetadata)
            that.addScaleBar()
        });


        // Define interface to shaders
        const seaGL = new viaWebGL.openSeadragonGL(that.viewer);
        seaGL.vShader = '/client/src/shaders/vert.glsl';
        seaGL.fShader = '/client/src/shaders/frag.glsl';
        //
        seaGL.addHandler('tile-drawing', async function (callback, e) {

            // Read parameters from each tile
            const tile = e.tile;
            const group = e.tile.url.split("/");
            const sub_url = group[group.length - 3];

            let channel = _.find(that.channelList.currentChannels, e => {
                return e.sub_url == sub_url;
            })
            if (channel) {
                const color = _.get(channel, 'color', d3.color("white"));
                const floatColor = [color.r / 255., color.g / 255., color.b / 255.];
                const range = _.get(channel, 'range', that.dataLayer.getImageBitRange(true));
                const via = this.viaGL;
                // Store channel color and range to send to shader
                via.color_3fv = new Float32Array(floatColor);
                via.range_2fv = new Float32Array(range);
                let fmt = 0;
                if (tile._format == 'u16') {
                    fmt = 16;
                } else if (tile._format == 'u32') {
                    fmt = 32;
                }
                via.fmt_1i = fmt;
                // Start webGL rendering
                callback(e);
                // After the callback, call the labels
                // await that.drawLabels(e);
            } else {
                if (e.tile._redrawLabel) {
                    if (!e.tile._array || !e.tile._tileImageData) {
                        console.log('Missing Array', e.tile.url);
                        // this.refreshSegmentationMask();
                    }
                    that.drawLabelTile(e.tile, e.tile._tileImageData.width, e.tile._tileImageData.height);
                }
                if (e.tile.containsLabel) {
                    try {
                        e.rendered.putImageData(e.tile._tileImageData, 0, 0);
                    } catch (err) {
                        console.log('Another issue', err, e.tile.url);
                        // this.refreshSegmentationMask();
                    }
                }
            }
        });

        seaGL.addHandler('gl-drawing', function () {
            // Send color and range to shader
            this.gl.uniform3fv(this.u_tile_color, this.color_3fv);
            this.gl.uniform2fv(this.u_tile_range, this.range_2fv);
            this.gl.uniform1i(this.u_tile_fmt, this.fmt_1i);

            // Clear before each draw call
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        });

        seaGL.addHandler('gl-loaded', function (program) {
            // Turn on additive blending
            this.gl.enable(this.gl.BLEND);
            this.gl.blendEquation(this.gl.FUNC_ADD);
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

            // Uniform variable for coloring
            this.u_tile_color = this.gl.getUniformLocation(program, 'u_tile_color');
            this.u_tile_range = this.gl.getUniformLocation(program, 'u_tile_range');
            this.u_tile_fmt = this.gl.getUniformLocation(program, 'u_tile_fmt');
        });


        seaGL.addHandler('tile-loaded', (callback, e) => {
            var decoder = new Promise(function (resolve, reject) {
                try {
                    const group = e.tile.url.split("/");
                    let isLabel = group[group.length - 3] == that.labelChannel.sub_url;
                    e.tile._blobUrl = e.image?.src;
                    if (isLabel) {
                        e.tile._isLabel = true;
                        if (!e.tile._array) {
                            e.tile._array = new Int32Array(PNG.sync.read(new Buffer(e.tileRequest?.response ||
                                e.image._array), {colortype: 0}).data.buffer);
                        }
                        that.drawLabelTile(e.tile, e.image?.width || e.tile?._tileImageData?.width, e.image?.height
                            || e.tile?._tileImageData?.height);

                        // We're hence skipping that OpenseadragonGL callback since we only care about the vales
                        return resolve();
                    } else {
                        return callback(e)
                        // This goes to OpenseadragonGL which does the necessary bit stuff.
                    }
                } catch (err) {
                    console.log('Load Error, Refreshing', err, e.tile.url);
                    that.forceRepaint();

                    // return callback(e);
                }
                // Notify openseadragon when decoded
                decoder.then(e.getCompletionCallback())
            });
        });


        this.viewer.addHandler('tile-drawn', (e) => {
            let count = _.size(e.tiledImage._tileCache._tilesLoaded);
            e.tiledImage._tileCache._imagesLoadedCount = count;
        })

        this.viewer.addHandler('tile-unloaded', (e) => {
            if (e.tile._blobUrl) {
                (window.URL || window.webkitURL).revokeObjectURL(e.tile._blobUrl);
            }
            delete e.tile._array;
            delete e.tile._tileImageData;
        })


        // Instantiate viewer managers
        that.viewerManagerVMain = new ViewerManager(that, seaGL.openSD, 'main');
        //
        // // Append to viewers
        that.viewerManagers.push(that.viewerManagerVMain);

        seaGL.init();

        /************************************************************************************************** Add layer */

        // Add overlay
        this.csvGatingOverlay = new CsvGatingOverlay(this.viewer, this);

        this.viewer.scalebar({
                location: 3,
                minWidth: '100px',
                type: 'Microscopy',
                stayInsideImage: true,
                pixelsPerMeter: 0,
                fontColor: 'rgb(255, 255, 255)',
                color: 'rgb(255, 255, 255)'
        })

        // Add listener for scalebar
        const controls_scalebar = document.querySelector('#controls_scalebar')
        controls_scalebar.addEventListener('change', e => {
            this.show_scalebar = e.target.checked;
            this.eventHandler.trigger(ImageViewer.events.addScaleBar)
        })

        // Add event mouse handler (cell selection)
        this.viewer.addHandler('canvas-nonprimary-press', function (event) {

            // Right click (cell selection)
            if (event.button === 2) {
                // The canvas-click event gives us a position in web coordinates.
                const webPoint = event.position;
                // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
                const viewportPoint = that.viewer.viewport.pointFromPixel(webPoint);
                // Convert from viewport coordinates to image coordinates.
                const imagePoint = that.viewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);

                return that.dataLayer.getNearestCell(imagePoint.x, imagePoint.y)
                    .then(selectedItem => {
                        if (selectedItem !== null && selectedItem !== undefined) {
                            // Check if user is doing multi-selection or not
                            let clearPriors = true;
                            if (event.originalEvent.ctrlKey) {
                                clearPriors = false;
                            }
                            // Trigger event
                            that.eventHandler.trigger(ImageViewer.events.imageClickedMultiSel, {
                                selectedItem,
                                clearPriors
                            });
                        }
                    })
            }
        });


    }

    /**
     * @function drawLabelTile - cell-based rendering using the segmentation mask
     * @param tile - the tile to draw
     * @param width - width of the tile
     * @param height - height of the tile
     */
    drawLabelTile(tile, width, height) {
        const self = this;
        let imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
        tile._tileImageData = imageData;
        const valInc = 0;
        if (self.show_selection && self.selection.size > 0) {
            tile._array.forEach((val, i) => {
                    if (val !== 0 && self.selection.has(val + valInc)) {
                        let labelValue = val + valInc;
                        let phenotype = _.get(seaDragonViewer.selection.get(labelValue), 'phenotype');
                        //set color to white but when phenotype column in passed selection, use that for coloring
                        let color = [255, 255, 255];
                        // if (phenotype !== undefined) {
                        //     color = seaDragonViewer.colorScheme.colorMap[phenotype].rgb;
                        // }
                        let index = i * 4;
                        const grid = [
                            index - 4,
                            index + 4,
                            index - width * 4,
                            index + width * 4
                        ];
                        const test = [
                            index % (width * 4) !== 0,
                            index % (width * 4) !== (width - 1) * 4,
                            index >= width * 4,
                            index < width * 4 * (height - 1)
                        ];

                        // If outline
                        if (this.viewerManagerVMain.sel_outlines) {
                            // Iterate grid
                            for (let j = 0; j < grid.length; j++) {
                                // if pass test (not on tile border)
                                if (test[j]) {
                                    // Neighbor label value
                                    const altLabelValue = tile._array[grid[j] / 4] + valInc;
                                    // Color
                                    if (altLabelValue !== labelValue) {
                                        tile._tileImageData.data[index] = color[0];
                                        tile._tileImageData.data[index + 1] = color[1];
                                        tile._tileImageData.data[index + 2] = color[2];
                                        tile._tileImageData.data[index + 3] = 255;
                                        tile.containsLabel = true;
                                        break;
                                    }
                                }
                            }
                        } else {
                            tile._tileImageData.data[index] = color[0];
                            tile._tileImageData.data[index + 1] = color[1];
                            tile._tileImageData.data[index + 2] = color[2];
                            tile._tileImageData.data[index + 3] = 255;
                            tile.containsLabel = true;
                        }
                        /************************ newend */

                    }
                }
            )
        }
    }

    // =================================================================================================================
    // Tile cache management
    // =================================================================================================================

    /**
     * @function createTFArray - creates an array of colors as a transfer/lookup table for pixel values.
     * @param min the minimum value
     * @param max - the maximum value
     * @param rgb1 - the start color (min)
     * @param rgb2 - the end color (max)
     * @param numBins - the bins for the color interpolation steps
     * @returns {{tf: Array, min: *, max: *, num_bins: *, start_color: *, end_color: *}}
     */
    createTFArray(min, max, rgb1, rgb2, numBins) {

        const tfArray = [];

        const numBinsF = parseFloat(numBins);
        const col1 = d3.rgb(rgb1);
        const col2 = d3.rgb(rgb2);

        for (let i = 0; i < numBins; i++) {
            const rgbTupel = {};
            const lerpFactor = (i / (numBinsF - 1.0));

            rgbTupel.r = col1.r + (col2.r - col1.r) * lerpFactor;
            rgbTupel.g = col1.g + (col2.g - col1.g) * lerpFactor;
            rgbTupel.b = col1.b + (col2.b - col1.b) * lerpFactor;

            const lerpCol = d3.rgb(rgbTupel.r, rgbTupel.g, rgbTupel.b);
            tfArray.push(lerpCol);
        }

        return {
            min: min, max: max, start_color: rgb1, end_color: rgb2,
            num_bins: numBins,
            tf: tfArray
        }
    }


    /**
     * @function actionFocus - sets a viewport based on an action (tool or user driven)
     *
     * @param vp - viewport
     * @returns void
     */
    actionFocus(vp) {
        this.setViewPort(vp.x, vp.y, vp.width, vp.height);
    }

    /**
     * @function setViewPort
     *
     * @param {int} x
     * @param {int} y
     * @param {int} width
     * @param {int} height
     *
     * @returns void
     */
    setViewPort(x, y, width, height) {

        // Calc from main viewer
        const coords = this.viewer.viewport.imageToViewportCoordinates(x, y);
        const lowerBounds = this.viewer.viewport.imageToViewportCoordinates(width, height);
        const box1 = new OpenSeadragon.Rect(coords.x, coords.y, lowerBounds.x, lowerBounds.y);

        // Apply to all viewers
        this.viewerManagers.forEach(vM => {
            vM.viewer.viewport.fitBounds(box1);
        });
    }


    // =================================================================================================================
    // Rendering
    // =================================================================================================================

    /**
     * @function drawCellRadius - draws a circle with certain radius around a cell
     *
     * @param radius
     * @param selection
     * @param  - whether it fades out
     */
    drawCellRadius(radius, selection, dragging = false) {

        let x = selection[dataLayer.x];
        let y = selection[dataLayer.y];
        let imagePoint = this.viewer.world.getItemAt(0).imageToViewportCoordinates(x, y);
        let circlePoint = this.viewer.world.getItemAt(0).imageToViewportCoordinates(x + _.toNumber(radius), y);
        let viewportRadius = Math.abs(circlePoint.x - imagePoint.x);
        let overlay = seaDragonViewer.viewer.svgOverlay();
        let fade = 0;
        // When dragging the bar, don't fade out
        if (dragging) {
            fade = 1;
        }

        let circle = d3.select(overlay.node())
            .selectAll('.radius-circle')
            .interrupt()
            .data([{'x': imagePoint.x, 'y': imagePoint.y, 'r': viewportRadius}])
        circle.enter()
            .append("circle")
            .attr("class", "radius-circle")
            .merge(circle)
            .attr("cx", d => {
                return d.x;
            })
            .attr("cy", d => {
                return d.y;
            })
            .attr("r", d => {
                return d.r;
            })
            .style("opacity", 1)
            .transition()
            .duration(1000)
            .ease(d3.easeLinear)
            .style("opacity", fade);
        circle.exit().remove();

    }

    /**Z
     * @function forceRepaint - for all active viewers repaint the canvas
     *
     * @returns void
     */
    forceRepaint() {
        // Refilter, redraw
        this.viewerManagers.forEach(vM => {
            vM.viewer.forceRefilter();
            vM.viewer.forceRedraw();
        });
    }

    /**
     * @function updateActiveChannels
     *
     * @param name
     * @param selection
     * @param status
     *
     * @returns void
     */
    updateActiveChannels(name, selection, status) {

        const channelIdx = imageChannels[name];

        if (selection.length === 0) {
            // console.log('nothing selected - keep showing last image');
            // return;
        } else if (selection.length === 1) {
            // console.log('1 channel selected');
        } else {
            // console.log('multiple channels selected');
        }

        if (status) {
            this.viewerManagers.forEach(vM => {
                vM.channel_add(channelIdx);
            });
        } else {
            this.viewerManagers.forEach(vM => {
                vM.channel_remove(channelIdx);
            });
        }

        this.forceRepaint();
    }

    /**
     * @function updateChannelRange
     *
     * @param name
     * @param tfmin
     * @param tfmax
     *
     * @returns void
     */
    updateChannelRange(name, tfmin, tfmax) {
        const self = this;
        let range = self.dataLayer.getImageBitRange();
        const channelIdx = imageChannels[name];
        if (self.channelList.currentChannels[channelIdx]) {
            let channelRange = [tfmin / range[1], tfmax / range[1]];
            self.channelList.currentChannels[channelIdx]['range'] = channelRange;
            self.channelList.rangeConnector[channelIdx] = channelRange;
        }
        this.forceRepaint();
    }

    /**
     * @function updateChannelColors
     *
     * @param name
     * @param color
     * @param type
     *
     * @returns void
     */
    updateChannelColors(name, color, type) {
        const self = this;
        const channelIdx = imageChannels[name];
        if (self.channelList.currentChannels[channelIdx]) {
            self.channelList.colorConnector[channelIdx] = {color: color};
            self.channelList.currentChannels[channelIdx]['color'] = color;
            // self.channelTF[channelIdx].end_color = color;
        }
        this.forceRepaint();
    }

    /**
     * @function updateData
     *
     * @param data
     *
     * @returns void
     */
    updateData(data) {

        this.data = data;
        this.forceRepaint();
    }

    /**
     * @function updateRenderingMode
     *
     * @param mode
     *
     * @returns void
     */
    updateRenderingMode(mode) {

        // Mode is a string: 'show-subset', 'show-selection'
        if (mode === 'show-subset') {
            this.show_subset = !this.show_subset;
        }
        if (mode === 'show-selection') {
            this.show_selection = !this.show_selection;
        }

        this.forceRepaint();

    }

    /**
     * @function updateSelection
     *
     * @param selection
     * @param repaint
     *
     * @returns void
     */
    updateSelection(selection, repaint = true) {
        this.selection = selection;
        // Reload Label Tiles
        let tileLevels = this.viewer.world.getItemAt(0).tilesMatrix;
        for (const [levelKey, level] of Object.entries(tileLevels)) {
            for (const [levelKey, tile] of Object.entries(level)) {
                for (const [subLevelKey, subTile] of Object.entries(tile)) {
                    subTile._redrawLabel = true;
                }

            }
        }
        this.viewer.forceRedraw();
        if (repaint) this.forceRepaint();

    }

    addScaleBar(){
        let pixelsPerMeter;
        if (this.show_scalebar){
            let unitConvert;
            if (this.imgMetadata.physical_size_x_unit === "µm" || this.imgMetadata.physical_size_x_unit === "um"){
                unitConvert = 1000000;
            } else if (this.imgMetadata.physical_size_x_unit === "nm"){
                unitConvert = 1000000000;
            } else if (this.imgMetadata.physical_size_x_unit === "cm"){
                unitConvert = 100;
            } else if (this.imgMetadata.physical_size_x_unit === "m"){
                unitConvert = 1;
            } else{
                unitConvert = 0;
            }
            pixelsPerMeter = unitConvert*this.imgMetadata.physical_size_x;
        } else {
            pixelsPerMeter = 0;
        }

        this.viewer.scalebar({
            pixelsPerMeter: pixelsPerMeter,
        });
    }
}

// Static vars
ImageViewer
    .events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode',
    addScaleBar: 'addScaleBar'
};

async function addTile(path) {
    const addJob = new Promise((resolve, reject) => {

        // If we're currently waiting for a tile to load, just use it's callback
        if (seaDragonViewer.pendingTiles.has(path)) {
            return seaDragonViewer.pendingTiles.get(path);
        }

        // seaDragonViewer.pendingTiles.add(path);
        function callback(success, error, request) {
            if (success) {
                console.log("Emergency Added Tile:", path);
                seaDragonViewer.pendingTiles.delete(path)
                resolve(success);
            } else {
                error();
            }
        }

        seaDragonViewer.pendingTiles.set(path, callback);


        const options = {
            src: path,
            loadWithAjax: true,
            crossOriginPolicy: false,
            ajaxWithCredentials: false,
            callback: callback
        }
        seaDragonViewer.viewer.imageLoader.addJob(options)
    });
    await Promise.all([addJob])
}
