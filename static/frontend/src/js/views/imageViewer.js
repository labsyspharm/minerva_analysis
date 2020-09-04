/**
 * viewer.js.
 *
 * ImageViewer for CyCif data based on OpenSeadragon.
 *
 */

/* todo
 1. major - the viewer managers should not be looking up the same renderTF
 */

class ImageViewer {

    constructor(config, dataLayer, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;

        // openseadragon viewer
        this.viewer = {};

        // openseadragon plugins

        this.seaGL = {}; // webgl renderer
        //this.rgbPlugin = {}; // reads rgb colors from mouse position
        this.canvasOverlay = {}; // canvas overlay

        // ==========
        // local data
        // ==========

        // local storage of image tiles (for all loaded channels)
        this.tileCache = {};

        // map of selected ids, key is id
        this.selection = new Map();
        this.data = new Map();

        // currently loaded image channels
        this.currentChannels = {}; //array of {"url": "", "suburl": ""}
        // label channel
        this.labelChannel = {}; //{"url": "", "suburl": ""}
        this.noLabel = false;

        // selection polygon (array of xy positions)
        this.selectionPolygonToDraw = [];
        // this.polygonsToDraw = []; deprecated; selected ids as polygons

        // transfer function constant
        this.numTFBins = 1024;

        // transfer function per channel (min,max, start color, end color)
        this.channelTF = [];
        for (var i = 0; i < this.config["imageData"].length; i = i + 1) {

            var start_color = d3.rgb(0, 0, 0);
            var end_color = d3.rgb(255, 255, 255);

            //var tf_def = createTF(0, 65535, start_color, end_color);
            var tf_def = createTFArray(0, 65535, start_color, end_color, this.numTFBins);

            this.channelTF.push(tf_def);
        }

        // ===============
        // render settings
        // ===============

        // applying TF to selection, subset, or all
        this.show_subset = false;
        this.show_selection = true;


    }

    /**
     * @function init
     */
    init() {

        // Define this as that
        const that = this;

        // Hide Loader
        document.getElementById('openseadragon_loader').style.display = "none";

        // Config viewer
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/static/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            //defaultZoomLevel: 1.2,
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 2000, // default is 200, had to set up for loading two layers (labels and image)
            preload: true,
            homeFillsViewer: true,
            visibilityRatio: 1.0
            //debugMode:  true,
        };

        // Instantiate viewer
        that.viewer = OpenSeadragon(viewer_config);

        // Get filters data
        const dataLoad = LensingFiltersExt.getFilters(this);

        // Instantiate viewer
        that.viewer.lensing = l.construct(OpenSeadragon, that.viewer, viewer_config, dataLoad);

        // Instantiate viewer managers
        that.viewerManagerVMain = new ViewerManager(that, that.viewer, 'main');
        that.viewerManagerVAuxi = new ViewerManager(that, that.viewer.lensing.viewer_aux, 'auxi');

        // OpenSeadragonCanvasOverlayHd: add canvas overlay - drawing selection rectangles
        this.canvasOverlay = new OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: function (opts) {
                const context = opts.context;

                //area selection polygon
                if (that.selectionPolygonToDraw && that.selectionPolygonToDraw.length > 0) {
                    var d = that.selectionPolygonToDraw;
                    context.globalAlpha = 0.7;
                    //context.fillStyle = 'orange';
                    context.strokeStyle = 'orange';
                    context.lineWidth = 15;
                    context.beginPath();
                    d.forEach(function (xVal, i) {
                        if (i === 0) {
                            context.moveTo(d[i].x, d[i].y);
                        } else {
                            context.lineTo(d[i].x, d[i].y);
                        }
                    });
                    context.closePath();
                    context.stroke();
                    // context.globalAlpha = 1.0;
                }
            },
        });

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
                //var imagePoint = that.viewer.viewport.viewportToImageCoordinates(viewportPoint);
                // // console.log(webPoint.toString(), viewportPoint.toString(), imagePoint.toString());

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
     * @function setViewport
     *
     * @param {int} x
     * @param {int} y
     * @param {int} width
     * @param {int} height
     *
     * @returns void
     */
    setViewPort(x, y, width, height) {
        // Calc
        const coords = this.viewer.viewport.imageToViewportCoordinates(x, y);
        const lowerBounds = this.viewer.viewport.imageToViewportCoordinates(width, height);
        const box1 = new OpenSeadragon.Rect(coords.x, coords.y, lowerBounds.x, lowerBounds.y);
        //
        this.viewer.viewport.fitBounds(box1);
        this.viewer.lensing.viewer_aux.viewport.fitBounds(box1);
    }

    /**
     * @function actionFocus
     *
     * @param vp
     *
     * @returns void
     */
    actionFocus(vp) {
        this.setViewPort(vp.x, vp.y, vp.width, vp.height);
    }

    // =====================
    // tile cache management
    // =====================


    // event raised when tile loaded with openSeaDragon, we want to store it locally so we can access it later (to manually filter, etc.)
    tileLoaded(event) {

        if (event == null || event == undefined || event.tileRequest == null) {
            return;
        }

        var handlePngAs8Bit = false;
        if (handlePngAs8Bit) {
            var img = new Image();
            img.onload = function () {

                var tile = event.tile;
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // this gets back an 8 bit RGBA image
                var imageData = ctx.getImageData(0, 0, img.width, img.height);

                seaDragonViewer.tileCache[img.src] = imageData;

            };
            img.src = event.tile.url;

        } else { // full 24bit png handling: get buffer, parse it into png, save in cache

            var buffer = new Buffer(event.tileRequest.response);
            if (buffer) {
                var tile = event.tile;
                var tile_png = PNG.sync.read(buffer, {colortype: 0});

                // save tile in tileCache
                seaDragonViewer.tileCache[tile.url] = tile_png;
            } else {
                console.log('[TILE LOADED]: buffer UNDEFINED');
            }
        }
    }


    // event raised when tile is being unloaded by openSeaDragon; we also purge it from local tile cache
    tileUnloaded(event) {

        //console.log('[TILE UNLOADED LOADED]: url:', event.tile.url, 'value:', seaDragonViewer.tileCounter[event.tile.url]);
        seaDragonViewer.tileCache[event.tile.url] = null;

    }


    // ===================
    // rendering functions
    // ===================


    // called by filtering plugin, applies TF on single tile, also accesses the label image
    async renderTFWithLabels(context, callback, tile) {

        if (tile == null) {
            callback();
            return;
        }
        var inputTile = seaDragonViewer.tileCache[tile.url];
        if (inputTile == null) {
            callback();
            return;
        }

        // render multi-channel image
        if (Object.keys(seaDragonViewer.currentChannels).length > 1) {
            seaDragonViewer.renderTFWithLabelsMulti(context, callback, tile);
            return;
        }

        // render single-channel image

        var group = tile.url.split("/");
        var somePath = group[group.length - 3];

        // label data
        if (!seaDragonViewer.noLabel) {
            var labelPath = seaDragonViewer.labelChannel["sub_url"];
            var labelTileAdr = tile.url.replace(somePath, labelPath);
            var labelTile = seaDragonViewer.tileCache[labelTileAdr];
        }

        // channel data
        var channelIdx = "";
        for (var key in seaDragonViewer.currentChannels) {
            channelIdx = key;
            break;
        }
        if (channelIdx == "") {
            return;
        }

        var channelPath = seaDragonViewer.currentChannels[channelIdx]["sub_url"];
        var channelTileAdr = tile.url.replace(somePath, channelPath);
        var channelTile = seaDragonViewer.tileCache[channelTileAdr];

        if (channelTile == null) {
            return;
        }
        var channelTileData = channelTile.data;

        var tf = seaDragonViewer.channelTF[channelIdx];

        // get screen pixels to write into
        var screenData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        var pixels = screenData.data;

        var labelValue = 0;
        var labelValueStr = "";
        var channelValue = 0;
        var rgb = 0;

        // If label tile has not loaded, asynchronously load it, waiting for it to load before proceeding
        if (labelTile == null && !seaDragonViewer.noLabel) {
            console.log("Missing Label Tile", labelTileAdr)
            const loaded = await addTile(labelTileAdr);
            labelTile = seaDragonViewer.tileCache[labelTileAdr];
        }
        // check if there is a label present

        var labelTileData = _.get(labelTile, 'data');

        // iterate over all tile pixels
        for (var i = 0, len = inputTile.width * inputTile.height * 4; i < len; i = i + 4) {

            // get 24bit label data
            if (labelTileData) {
                labelValue = ((labelTileData[i] * 65536) + (labelTileData[i + 1] * 256) + labelTileData[i + 2]) - 1;
                labelValueStr = labelValue.toString();
            }
            // get 16 bit data (stored in G and B channels)
            channelValue = (channelTileData[i + 1] * 256) + channelTileData[i + 2];

            // apply color transfer function
            rgb = evaluateTF(channelValue, tf);

            if (seaDragonViewer.show_subset) { // render everything outside subset as black/white

                // show data as black/white
                pixels[i] = channelTileData[i + 1];
                pixels[i + 1] = channelTileData[i + 1];
                pixels[i + 2] = channelTileData[i + 1];

            } else { // render everything with TF

                if (channelValue < tf.min) {   // values lower than TF gating: 0
                    pixels[i] = 0;
                    pixels[i + 1] = 0;
                    pixels[i + 2] = 0;
                } else {                        // values higher than TF gating: highest TF color
                    pixels[i] = rgb.r;
                    pixels[i + 1] = rgb.g;
                    pixels[i + 2] = rgb.b;
                }
            }

            if (labelValue >= 0) { // check for label data

                if (seaDragonViewer.show_subset) { // render subset with TF (check label id is in subset, apply TF)
                    if (seaDragonViewer.data.has(labelValueStr)) {
                        if (channelValue < tf.min) {
                            pixels[i] = 0;
                            pixels[i + 1] = 0;
                            pixels[i + 2] = 0;
                        } else {
                            pixels[i] = rgb.r;
                            pixels[i + 1] = rgb.g;
                            pixels[i + 2] = rgb.b;
                        }
                    }
                }

                // render selection ids as highlighted
                if (seaDragonViewer.show_selection) {
                    if (seaDragonViewer.selection.has(labelValueStr)) {
                        let phenotype = _.get(seaDragonViewer.selection.get(labelValueStr), 'phenotype', '');
                        let color = seaDragonViewer.colorScheme.colorMap[phenotype].rgb;
                        if (color != undefined) {
                            pixels[i] = color[0];
                            pixels[i + 1] = color[1];
                            pixels[i + 2] = color[2];
                        }
                    }
                }
            }


        }

        context.putImageData(screenData, 0, 0);
        callback();
    }


// apply TF on multi-channel tile, also accesses the label image
    async renderTFWithLabelsMulti(context, callback, tile) {

        if (tile == null) {
            callback();
            return;
        }
        var inputTile = seaDragonViewer.tileCache[tile.url];
        if (inputTile == null) {
            callback();
            return;
        }

        var group = tile.url.split("/");
        var somePath = group[group.length - 3];

        // label data
        if (!seaDragonViewer.noLabel) {
            var labelPath = seaDragonViewer.labelChannel["sub_url"];
            var labelTileAdr = tile.url.replace(somePath, labelPath);
            var labelTile = seaDragonViewer.tileCache[labelTileAdr];
        }

        // channel data
        var channelsTileData = [];
        var tfs = [];
        var tfs_min = [];

        var tileurl = tile.url;

        // get tfs for channels
        for (const key in seaDragonViewer.currentChannels) {
            var channelIdx = key;

            var channelPath = seaDragonViewer.currentChannels[channelIdx]["sub_url"];
            var channelTileAdr = tileurl.replace(somePath, channelPath);
            var channelTile = seaDragonViewer.tileCache[channelTileAdr];

            if (channelTile == null) {
                return;
            }

            channelsTileData.push(channelTile.data);
            tfs.push(seaDragonViewer.channelTF[channelIdx]);
            tfs_min.push(seaDragonViewer.channelTF[channelIdx].min);
        }

        // get screen pixels to write into
        var screenData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        var pixels = screenData.data;

        // If label tile has not loaded, asynchronously load it, waiting for it to load before proceeding
        if (labelTile == null && !seaDragonViewer.noLabel) {
            console.log("Missing Label Tile", labelTileAdr)
            const loaded = await addTile(labelTileAdr);
            labelTile = seaDragonViewer.tileCache[labelTileAdr];
        }

        var labelTileData = _.get(labelTile, 'data');
        var labelValue = 0;
        var labelValueStr = "";
        var channelValue = 0;
        var rgb = 0;

        // iterate over all tile pixels
        for (var i = 0, len = inputTile.width * inputTile.height * 4; i < len; i = i + 4) {

            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;

            // get 24bit label data
            if (labelTileData) {
                labelValue = ((labelTileData[i] * 65536) + (labelTileData[i + 1] * 256) + labelTileData[i + 2]) - 1;
                labelValueStr = labelValue + ''; //faster than labelValue.toString()
            }

            // iterate over all image channels
            for (var channel = 0; channel < channelsTileData.length; channel++) {

                // get 16 bit image data (stored in G and B channels)
                channelValue = (channelsTileData[channel][i + 1] * 256) + channelsTileData[channel][i + 2];

                // apply TF
                rgb = evaluateTF(channelValue, tfs[channel]);

                if (!seaDragonViewer.show_subset) { // render everything with TF
                    if (channelValue >= tfs_min[channel]) {
                        pixels[i] += rgb.r;
                        pixels[i + 1] += rgb.g;
                        pixels[i + 2] += rgb.b;
                    }
                }

                if (seaDragonViewer.show_subset) { // render subset with TF
                    if (seaDragonViewer.data.has(labelValueStr)) { // render with TF
                        if (channelValue >= tfs[channel].min) {
                            pixels[i] += rgb.r;
                            pixels[i + 1] += rgb.g;
                            pixels[i + 2] += rgb.b;
                        }
                    } else {
                        // render data as black/white
                        pixels[i] += channelsTileData[channel][i + 1];
                        pixels[i + 1] += channelsTileData[channel][i + 1];
                        pixels[i + 2] += channelsTileData[channel][i + 1];
                    }
                }

                // render selection ids as highlighted
                if (seaDragonViewer.show_selection && seaDragonViewer.selection.size > 0) {
                    if (seaDragonViewer.selection.has(labelValueStr)) {
                        let phenotype = _.get(seaDragonViewer.selection.get(labelValueStr), 'phenotype', '');
                        let color = seaDragonViewer.colorScheme.colorMap[phenotype].rgb;
                        if (color != undefined) {
                            pixels[i] = color[0];
                            pixels[i + 1] = color[1];
                            pixels[i + 2] = color[2];
                        }
                    }
                }

            }
        }
        context.putImageData(screenData, 0, 0);
        callback();

    }

    updateSelection(selection) {
        // console.log('seaDragon: update selection event received');
        this.selection = selection;
        seaDragonViewer.forceRepaint();
    }

    /**
     * @function updateData
     *
     * @param data
     *
     * @returns void
     */
    updateData(data) {
        // console.log('seaDragon: update subset event received');
        this.data = data;
        seaDragonViewer.forceRepaint();
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

        // console.log('updating TF range');
        const channelIdx = imageChannels[name];

        const min = tfmin;
        const max = tfmax;
        const rgb1 = seaDragonViewer.channelTF[channelIdx].start_color;
        const rgb2 = seaDragonViewer.channelTF[channelIdx].end_color;
        const tf_def = createTFArray(min, max, rgb1, rgb2, seaDragonViewer.numTFBins);

        seaDragonViewer.channelTF[channelIdx] = tf_def;
        seaDragonViewer.forceRepaint();
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

        /*
        example:
        name: "DNA4_Hoechst33342_12Nuclei"
        color: "rgb(177, 0, 255)"
        type: "right"
        */

        // console.log('seaDragon: update channel colors event received ');

        const channelIdx = imageChannels[name];

        const min = seaDragonViewer.channelTF[channelIdx].min;
        const max = seaDragonViewer.channelTF[channelIdx].max;
        let rgb1 = seaDragonViewer.channelTF[channelIdx].start_color;
        let rgb2 = seaDragonViewer.channelTF[channelIdx].end_color;
        if (type === "black") {
            rgb1 = color;
        } else {
            rgb2 = color;
        }
        const tf_def = createTFArray(min, max, rgb1, rgb2, seaDragonViewer.numTFBins);

        seaDragonViewer.channelTF[channelIdx] = tf_def;
        seaDragonViewer.forceRepaint();
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

        var channelIdx = imageChannels[name];

        // console.log('seaDragon: update active channels event received. channel ', channelIdx);

        if (selection.length === 0) {
            // console.log('nothing selected - keep showing last image');
            // return;
        } else if (selection.length === 1) {
            // console.log('1 channel selected');
        } else {
            // console.log('multiple channels selected');
        }

        if (status) {
            // console.log('channel added');
            this.viewerManagerVMain.addChannel(channelIdx);
            this.viewerManagerVAuxi.addChannel(channelIdx);
        } else {
            // console.log('channel removed');
            this.viewerManagerVMain.removeChannel(channelIdx);
            this.viewerManagerVAuxi.removeChannel(channelIdx);
        }

        seaDragonViewer.forceRepaint();
    }

    /**
     * @function updateRenderingMode
     *
     * @param mode
     *
     * @returns void
     */
    updateRenderingMode(mode) {

        // mode is a string: 'show-subset', 'show-selection'

        // console.log('seaDragonViewer: rendering mode change event received. mode ' + mode);

        if (mode === 'show-subset') {
            this.show_subset = !this.show_subset;
        }
        if (mode === 'show-selection') {
            this.show_selection = !this.show_selection;
            // console.log(this.show_selection);
        }

        seaDragonViewer.forceRepaint();

    }


    /**
     * @function forceRepaint
     *
     * @returns void
     */
    forceRepaint() {
        // Refilter, redraw
        seaDragonViewer.viewer.forceRefilter();
        seaDragonViewer.viewer.forceRedraw();
        seaDragonViewer.viewer.lensing.viewer_aux.forceRefilter();
        seaDragonViewer.viewer.lensing.viewer_aux.forceRedraw();
    }

    drawCellRadius(radius, selection, dragging = false) {
        let x = selection[dataLayer.x];
        let y = selection[dataLayer.y];
        let imagePoint = seaDragonViewer.viewer.world.getItemAt(0).imageToViewportCoordinates(x, y);
        let circlePoint = seaDragonViewer.viewer.world.getItemAt(0).imageToViewportCoordinates(x + _.toNumber(radius), y);
        let viewportRadius = Math.abs(circlePoint.x - imagePoint.x);
        let overlay = seaDragonViewer.viewer.svgOverlay();
        let fade = 0;
        // when dragging the bar, don't fade out
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
}

// Static vars
ImageViewer.events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode'
};


// PUBLIC METHODS

// Activates filtering plugin to draw images with applied TF
function activateTFRendering() {

    const tempSet = true;

    //jojo
    if (tempSet) {
        // Filtering plugin
        seaDragonViewer.viewer.setFilterOptions({
            //  loadMode: 'sync',
            filters: {
                processors: //OpenSeadragon.Filters.BRIGHTNESS(200), ImageViewer.myfilter
                seaDragonViewer.viewerManagerVMain.renderTFWithLabels
            }
        });
        seaDragonViewer.viewer.lensing.viewer_aux.setFilterOptions({
            filters: {
                processors: seaDragonViewer.viewerManagerVAuxi.renderTFWithLabels
            }
        });

    } else {
        seaDragonViewer.viewer.setFilterOptions({
            // loadMode: 'sync',
            filters: {
                processors: []
            }
        });
    }
}

function createTFArray(min, max, rgb1, rgb2, numBins) {

    const tfArray = [];

    const numBinsF = parseFloat(numBins);
    col1 = d3.rgb(rgb1);
    col2 = d3.rgb(rgb2);

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

async function addTile(path) {

    function addTileResponse(success, error) {
        if (error) {
            console.log("Error Adding Tile:", error)
        }
        // console.log("Emergency Added Tile:", path)
    }

    const options = {
        src: path,
        loadWithAjax: true,
        crossOriginPolicy: false,
        ajaxWithCredentials: false,
        callback: addTileResponse
    }
    return new Promise(resolve => {
        console.log('hi')
        // - todo ck :: jj (Not confirmed to help, prob can remove)
        seaDragonViewer.viewer.lensing.viewer_aux.imageLoader.addJob(options)
        return seaDragonViewer.viewer.imageLoader.addJob(options)
    })
        .then(response => {
            return Promise.resolve()
        })
        .catch(err => {
            return Promise.resolve()
        })

}