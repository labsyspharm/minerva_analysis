/**
 * viewer.js.
 *
 * ImageViewer for CyCif data based on OpenSeadragon.
 *
 */

class ImageViewer {

    constructor(config, dataFilter, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataFilter = dataFilter;
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


    init() {

        // console.log('[seaDragonViewer::init]');
        const that = this;

        // Hide Loader
        document.getElementById('openseadragon_loader').style.display = "none";

        // Config viewer - todo ck :: jj
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/static/frontend/external_js/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            //defaultZoomLevel: 1.2,
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 1000, // default is 200, had to set up for loading two layers (labels and image)
            preload: true,
            homeFillsViewer: true,
            visibilityRatio: 1.0
            //debugMode:  true,
        };

        // Instantiate viewer
        that.viewer = OpenSeadragon(viewer_config);

        // Init data w config
        const data = [
            {
                index: 0,
                name: 'red',
                r: 255,
                g: 0,
                b: 0
            },
            {
                index: 1,
                name: 'green',
                r: 0,
                g: 255,
                b: 0
            },
            {
                index: 2,
                name: 'blue',
                r: 0,
                g: 0,
                b: 255
            },
        ];
        const data_config = {
            type: 'color'
        };

        // Instantiate viewer - todo ck :: jj
        that.viewer.lensing = l.construct(OpenSeadragon, that.viewer, viewer_config, data, data_config);

        // Instantiate colorManagers -todo ck :: jj
        that.viewerManagerVMain = new ViewerManager(that, that.viewer);
        that.viewerManagerVAuxi = new ViewerManager(that, that.viewer.lensing.viewer_aux);

        // OpenSeadragonCanvasOverlayHd: add canvas overlay -  drawing selection rectangles
        this.canvasOverlay = new OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: function (opts) {
                var context = opts.context;

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

                return that.dataFilter.getNearestCell(imagePoint.x, imagePoint.y)
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
     */
    actionFocus(vp) {
        this.setViewPort(vp.x, vp.y, vp.width, vp.height);
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
            // console.log("Missing Label Tile", labelTileAdr)
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
                        let color = seaDragonViewer.colorScheme.getPhenotypeColor(phenotype)
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

    updateData(data) {
        // console.log('seaDragon: update subset event received');
        this.data = data;
        seaDragonViewer.forceRepaint();
    }


    updateChannelRange(name, tfmin, tfmax) {
        // console.log('updating TF range');

        var channelIdx = imageChannels[name];

        var min = tfmin;
        var max = tfmax;
        var rgb1 = seaDragonViewer.channelTF[channelIdx].start_color;
        var rgb2 = seaDragonViewer.channelTF[channelIdx].end_color;

        var tf_def = createTFArray(min, max, rgb1, rgb2, seaDragonViewer.numTFBins);

        seaDragonViewer.channelTF[channelIdx] = tf_def;

        seaDragonViewer.forceRepaint();
    }

//example:
// name: "DNA4_Hoechst33342_12Nuclei"
// color: "rgb(177, 0, 255)"
// type: "right"
    updateChannelColors(name, color, type) {
        // console.log('seaDragon: update channel colors event received ');

        var channelIdx = imageChannels[name];

        var min = seaDragonViewer.channelTF[channelIdx].min;
        var max = seaDragonViewer.channelTF[channelIdx].max;
        var rgb1 = seaDragonViewer.channelTF[channelIdx].start_color;
        var rgb2 = seaDragonViewer.channelTF[channelIdx].end_color;

        if (type == "black") {
            rgb1 = color;
        } else {
            rgb2 = color;
        }

        var tf_def = createTFArray(min, max, rgb1, rgb2, seaDragonViewer.numTFBins);

        seaDragonViewer.channelTF[channelIdx] = tf_def;

        seaDragonViewer.forceRepaint();
    }


    updateActiveChannels(name, selection, status) {

        var channelIdx = imageChannels[name];

        // console.log('seaDragon: update active channels event received. channel ', channelIdx);

        if (selection.length == 0) {
            // console.log('nothing selected - keep showing last image');
            // return;
        } else if (selection.length == 1) {

            // console.log('1 channel selected');
        } else {
            // console.log('multiple channels selected');
        }

        if (status == true) {
            // console.log('channel added');
            addChannel(channelIdx);
        } else {
            // console.log('channel removed');
            removeChannel(channelIdx);
        }

        seaDragonViewer.forceRepaint();
    }

//mode is a string: 'show-subset', 'show-selection'
    updateRenderingMode(mode) {

        // console.log('seaDragonViewer: rendering mode change event received. mode ' + mode);

        if (mode == 'show-subset') {
            this.show_subset = !this.show_subset;
        }
        if (mode == 'show-selection') {
            this.show_selection = !this.show_selection;
            // console.log(this.show_selection);
        }

        seaDragonViewer.forceRepaint();

    }

    forceRepaint() {
        seaDragonViewer.viewer.forceRefilter();
        seaDragonViewer.viewer.forceRedraw();
    }
}


//static vars
ImageViewer.events = {
    //imageClicked: 'image_clicked',
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode'
};


// PUBLIC METHODS

// activates filtering plugin to draw images with applied TF
function activateTFRendering() {

    //jojo
    if (!false) {
        // filtering plugin
        seaDragonViewer.viewer.setFilterOptions({
            //  loadMode: 'sync',
            filters: {
                processors: //OpenSeadragon.Filters.BRIGHTNESS(200), ImageViewer.myfilter
                seaDragonViewer.renderTFWithLabels
            }
        });
        // - todo ck :: jj (Not confirmed to help, prob can remove)
        seaDragonViewer.viewer.lensing.viewer_aux.setFilterOptions({
            //  loadMode: 'sync',
            filters: {
                processors: //OpenSeadragon.Filters.BRIGHTNESS(200), ImageViewer.myfilter
                seaDragonViewer.renderTFWithLabels
            }
        });

    } else {
        seaDragonViewer.viewer.setFilterOptions({
            // loadMode: 'sync',
            filters: {
                processors: []
            }
        });
        // - todo ck :: jj (Not confirmed to help, prob can remove)
        seaDragonViewer.viewer.viewer_aux.setFilterOptions({
            // loadMode: 'sync',
            filters: {
                processors: []
            }
        });
    }
}


// add channel to multi-channel rendering
function addChannel(srcIdx) {

    //jojo
    // no channel -> add channel
    // already a channel -> getItemAt -> tiledImage.myMetaInfo = {otherdata: 'foo', more: 'foo2'}

    var src = seaDragonViewer.config["imageData"][srcIdx]["src"];

    if ((srcIdx in seaDragonViewer.currentChannels)) {
        return;
    }

    /* not working correctly, image will be white
    var imgopacity = 1;
    if ( Object.keys(seaDragonViewer.currentChannels).length > 0 ){
        imgopacity = 0;
    }*/

    var img = seaDragonViewer.viewer.addTiledImage({
        tileSource: src,
        //index: 0,
        opacity: 1, //    preload: true, (not working correctly for us)
        preload: true,
        success: function (event) {
            var itemidx = seaDragonViewer.viewer.world.getItemCount() - 1; //0
            var url = seaDragonViewer.viewer.world.getItemAt(itemidx).source.tilesUrl;
            var group = url.split("/");
            var sub_url = group[group.length - 2];

            seaDragonViewer.currentChannels[srcIdx] = {"url": url, "sub_url": sub_url};
        }
    });

    // Imitating - todo ck :: jj
    seaDragonViewer.viewer.lensing.viewer_aux.addTiledImage({
        tileSource: src,
        //index: 0,
        opacity: 1, //    preload: true, (not working correctly for us)
        preload: true,
        success: function (event) {
            /*
            var itemidx = seaDragonViewer.viewer.world.getItemCount() - 1; //0
            var url = seaDragonViewer.viewer.world.getItemAt(itemidx).source.tilesUrl;
            var group = url.split("/");
            var sub_url = group[group.length - 2];

            seaDragonViewer.currentChannels[srcIdx] = {"url": url, "sub_url": sub_url};
            */
        }
    });
}


// remove channel from multichannel rendering
function removeChannel(srcIdx) {

    var src = seaDragonViewer.config["imageData"][srcIdx]["src"];

    var img_count = seaDragonViewer.viewer.world.getItemCount();

    // remove channel
    if ((srcIdx in seaDragonViewer.currentChannels)) {

        // remove channel - first find it
        for (var i = 0; i < img_count; i = i + 1) {
            var url = seaDragonViewer.viewer.world.getItemAt(i).source.tilesUrl;
            if (url == seaDragonViewer.currentChannels[srcIdx]["url"]) {

                seaDragonViewer.viewer.world.removeItem(seaDragonViewer.viewer.world.getItemAt(i));
                // - todo ck :: jj (Not confirmed to help, prob can remove)
                seaDragonViewer.viewer.lensing.viewer_aux.world.removeItem(
                    seaDragonViewer.viewer.lensing.viewer_aux.world.getItemAt(i)
                );

                delete seaDragonViewer.currentChannels[srcIdx];
                break;
            }
        }
    }
}


function createTFArray(min, max, rgb1, rgb2, numBins) {

    var tfArray = [];

    var numBinsF = parseFloat(numBins);
    col1 = d3.rgb(rgb1);
    col2 = d3.rgb(rgb2);


    for (var i = 0; i < numBins; i++) {
        var rgbTupel = {};
        var lerpFactor = (i / (numBinsF - 1.0));

        rgbTupel.r = col1.r + (col2.r - col1.r) * lerpFactor;
        rgbTupel.g = col1.g + (col2.g - col1.g) * lerpFactor;
        rgbTupel.b = col1.b + (col2.b - col1.b) * lerpFactor;

        var lerpCol = d3.rgb(rgbTupel.r, rgbTupel.g, rgbTupel.b);
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
            // console.log("Error Adding Tile:", error)
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