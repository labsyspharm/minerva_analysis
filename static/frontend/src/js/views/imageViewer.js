/**
 * viewer.js.
 *
 * ImageViewer for CyCif data based on OpenSeadragon.
 *
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

        this.isSelectionToolActive = false;
    }


    init() {

        console.log('[seaDragonViewer::init]');

        var that = this;
        //Hide Loader
        document.getElementById('openseadragon_loader').style.display = "none";
        // ==================
        // init openseadragon
        // ==================
        that.viewer = OpenSeadragon({
            id: "openseadragon",
            prefixUrl: "/static/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            defaultZoomLevel: 1.2,
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 1000, // default is 200, had to set up for loading two layers (labels and image)
            preload: true
            //debugMode:  true,
        });

        // that.viewer.setControlsEnabled(true);
        // that.viewer.addHandler('page', () => {
        //     let printButton = new OpenSeadragon.Button({
        //         tooltip: 'Print',
        //         srcRest: `/cycif_viewer/static/frontend/external_js/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/next_rest.png`,
        //         srcGroup: `/cycif_viewer/static/frontend/external_js/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/next_rest.png`,
        //         srcHover: `/cycif_viewer/static/frontend/external_js/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/next_rest.png`,
        //         srcDown: `/cycif_viewer/static/frontend/external_js/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/next_rest.png`,
        //         onClick: that.switchSelectionMode
        //     });
        //     that.viewer.addControl(printButton.element, { anchor: OpenSeadragon.ControlAnchor.TOP_LEFT });
        // })

        that.viewer.addHandler('tile-loaded', this.tileLoaded);
        that.viewer.addHandler('tile-unloaded', this.tileUnloaded);

        // ==================
        // init Plugins  [Selection and Annotation]
        // ==================


        this.switchSelectionMode = function(selectionType, isSelectionToolActive){
            //currently all lasso selection..selectionType can be checked when other selections are implemented
            that.isSelectionToolActive = isSelectionToolActive;
            that.viewer.setMouseNavEnabled(!isSelectionToolActive);
            if (that.isSelectionToolActive){
                d3.select('body').style("cursor", "crosshair");
            }else{
                d3.select('body').style("cursor", "default");
            }
        }

        that.svg_overlay = that.viewer.svgOverlay()
        that.overlay = d3.select(that.svg_overlay.node())

        //SELECTION POLYGON (LASSO)
        that.polygonSelection = [];
        that.renew = false;
        that.numCalls = 0; //defines how fine-grained the polygon resolution is (0 = no subsampling, 10=high subsampling)

        that.lasso_draw = function(event){
            //add points to polygon and (re)draw

            var webPoint = event.position;
            var viewportPoint = that.viewer.viewport.pointFromPixel(webPoint);
            //console.log(webPoint.toString(), viewportPoint.toString());

            if (that.numCalls % 5 == 0){
                console.log(that.numCalls)
                that.polygonSelection.push({"x":viewportPoint.x,"y":viewportPoint.y});
            }

            d3.select('#selectionPolygon').remove();
            var selPoly = that.overlay.selectAll("selectionPolygon").data([that.polygonSelection]);
            selPoly.enter().append("polygon")
                .attr('id', 'selectionPolygon')
                .attr("points",function(d) {
                    return d.map(function(d) { return [d.x,d.y].join(","); }).join(" ");})
            that.numCalls++;
        }

        that.lasso_end = function(event){
            that.renew = true;

            //the drawn polygon data
            console.log('original polygon data: ')
            console.log(that.polygonSelection);

            //the compressed url string for this polygon
            var encodedPolygonString = that.toURL(that.polygonSelection);
            console.log('compressed polygon string: ');
            console.log(encodedPolygonString)

            //the decoded polygon (holding the original x,y values for each point)
            var decodedPolygon = that.fromURL(encodedPolygonString);
            console.log('decoded polygon data: ')
            console.log(decodedPolygon);

            that.polygonSelection = [];
            that.numCalls = 0;
        }


        that.mouse_drag = new OpenSeadragon.MouseTracker({
            element: that.viewer.canvas,
            dragHandler: function(event) {
                if (that.isSelectionToolActive) {
                    console.log('dragged');
                    that.lasso_draw(event);
                }
            }
        })

        that.mouse_up = new OpenSeadragon.MouseTracker({
            element: that.viewer.canvas,
            dragEndHandler: function(event) {
                if (that.isSelectionToolActive) {
                    console.log('release');
                    that.lasso_end(event);
                }
            }
        })

        that.toURL = function(polygon){
            var pointString='';
            polygon.forEach(function(d){
                pointString += d.x.toFixed(5) + "," + d.y.toFixed(5) + ",";
            })
            pointString = pointString.slice(0, -1); //removes "," at the end
            var result =  LZString.compressToEncodedURIComponent(pointString);
            return result;
        }

        that.fromURL = function(polygonString){
            var decompressed = LZString.decompressFromEncodedURIComponent(polygonString);
            var xArray = [], yArray = [];

            //get all values out of the string
            decompressed.split(',').forEach(function(d,i){
                if (i % 2 == 0){ xArray.push(d); }
                else{ yArray.push(d) }
            })

            //recreate polygon data structure
            var newPolygon = [];
            xArray.forEach(function(d, i){
                newPolygon.push({x: d, y: yArray[i]});
            })
            return newPolygon;
        }


        //some resizing corrections
        d3.select(window).on('resize', function() {});
        that.svg_overlay.resize();




        // =======================
        // OpenSeaDragonFiltering: applying custom filters (e.g., transfer functions)

        seaDragonViewer.viewer.setFilterOptions({
            //loadMode: 'sync',
            // items do not work in sync mode
            filters: {
                //items: seaDragonViewer.viewer.world.getItemAt(0), //seaDragonViewer.viewer.world.getItemCount() - 1),
                processors:
                seaDragonViewer.renderTFWithLabels
            }
        });


        // =======================
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
                        if (i == 0) {
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

        // on mouse click
        this.viewer.addHandler('canvas-nonprimary-press', function (event) {

            // right click
            if (event.button === 2) {
                // The canvas-click event gives us a position in web coordinates.
                var webPoint = event.position;
                // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
                var viewportPoint = that.viewer.viewport.pointFromPixel(webPoint);
                // Convert from viewport coordinates to image coordinates.

                var imagePoint = that.viewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
                //var imagePoint = that.viewer.viewport.viewportToImageCoordinates(viewportPoint);

                // console.log(webPoint.toString(), viewportPoint.toString(), imagePoint.toString());
                // $("#terminal").html("Terminal message: webpoint " + webPoint.toString() + " viewpoint " + viewportPoint.toString() + " image point " + imagePoint.toString())
                //

                return that.dataLayer.getNearestCell(imagePoint.x, imagePoint.y)
                    .then(selectedItem => {
                        if (selectedItem != null && selectedItem != undefined) {
                            // check if user is doing multi-selection or not
                            var clearPriors = true;
                            if (event.originalEvent.ctrlKey) {
                                clearPriors = false;
                            }
                            // trigger event
                            that.eventHandler.trigger(ImageViewer.events.imageClickedMultiSel, {
                                selectedItem,
                                clearPriors
                            });
                        }
                    })
            }
        });

        // ============
        // general init
        // ============
        // load label image in background if it exists
        if (that.config["imageData"][0]["src"] && that.config["imageData"][0]["src"] != '') {
            that.viewer.addTiledImage({
                tileSource: that.config["imageData"][0]["src"],
                index: 0,
                opacity: 1,
                //preload: true,
                success: function (event) {
                    var url0 = that.viewer.world.getItemAt(0).source.tilesUrl;
                    seaDragonViewer.labelChannel["url"] = url0;
                    var group = url0.split("/");
                    seaDragonViewer.labelChannel["sub_url"] = group[group.length - 2];
                }
            });
        } else {
            seaDragonViewer.noLabel = true;
        }


    } // init()


    // set viewport (called on focus action)
    setViewPort(x, y, width, height) {
        var coords = this.viewer.viewport.imageToViewportCoordinates(x, y);
        var lowerBounds = this.viewer.viewport.imageToViewportCoordinates(width, height);
        var box1 = new OpenSeadragon.Rect(coords.x, coords.y, lowerBounds.x, lowerBounds.y);
        this.viewer.viewport.fitBounds(box1);
    }


    // =============
    // handle events
    // =============


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
        console.log('seaDragon: update selection event received');
        this.selection = selection;
        seaDragonViewer.forceRepaint();
    }

    updateData(data) {
        console.log('seaDragon: update subset event received');
        this.data = data;
        seaDragonViewer.forceRepaint();
    }

    clearSelectionTool(){
        this.selectionPolygonToDraw = [];
        d3.select('#selectionPolygon').remove();
    }


    updateChannelRange(name, tfmin, tfmax) {
        console.log('updating TF range');

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
        console.log('seaDragon: update channel colors event received ');

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

        console.log('seaDragon: update active channels event received. channel ', channelIdx);

        if (selection.length == 0) {
            console.log('nothing selected - keep showing last image');
            // return;
        } else if (selection.length == 1) {

            console.log('1 channel selected');
        } else {
            console.log('multiple channels selected');
        }

        if (status == true) {
            console.log('channel added');
            addChannel(channelIdx);
        } else {
            console.log('channel removed');
            removeChannel(channelIdx);
        }

        seaDragonViewer.forceRepaint();
    }

//mode is a string: 'show-subset', 'show-selection'
    updateRenderingMode(mode) {

        console.log('seaDragonViewer: rendering mode change event received. mode ' + mode);

        if (mode == 'show-subset') {
            this.show_subset = !this.show_subset;
        }
        if (mode == 'show-selection') {
            this.show_selection = !this.show_selection;
            console.log(this.show_selection);
        }

        seaDragonViewer.forceRepaint();

    }

    forceRepaint() {
        seaDragonViewer.viewer.forceRefilter();
        seaDragonViewer.viewer.forceRedraw();
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


//static vars
ImageViewer.events = {
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
    } else {
        seaDragonViewer.viewer.setFilterOptions({
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


function evaluateTF(val, tf) {

    var lerpFactor = Math.round(((val - tf.min) / (tf.max - tf.min)) * (tf.num_bins - 1));

    if (lerpFactor >= tf.num_bins) {
        lerpFactor = tf.num_bins - 1;
    }

    if (lerpFactor < 0) {
        lerpFactor = 0;
    }

    var col = tf.tf[lerpFactor];

    return col;
}

async function addTile(path) {

    function addTileResponse(success, error) {
        if (error) {
            console.log("Error Adding Tile:", error)
        }
        console.log("Emergency Added Tile:", path)
    }

    const options = {
        src: path,
        loadWithAjax: true,
        crossOriginPolicy: false,
        ajaxWithCredentials: false,
        callback: addTileResponse
    }
    return new Promise(resolve => {
        return seaDragonViewer.viewer.imageLoader.addJob(options)
    })
        .then(response => {
            return Promise.resolve()
        })
        .catch(err => {
            return Promise.resolve()
        })


}