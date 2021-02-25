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

    // Vars
    viewerManagers = [];

    constructor(config, dataLayer, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;

        // Viewer
        this.viewer = {};

        // OSD plugins

        // Local storage of image tiles (for all loaded channels)
        this.tileCache = {};
        // Stores the ordered contents of the tile cache, so that once we hit max size we remove oldest elements
        this.pendingTiles = new Map();


        // Map of selected ids, key is id
        this.selection = new Map();
        this.data = new Map();

        // Currently loaded image / label channels
        this.currentChannels = {};
        this.labelChannel = {};
        this.noLabel = false;

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
            prefixUrl: "/client/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            loadTilesWithAjax: true,
            immediateRender: false,
            timeout: 90000,
            compositeOperation: 'lighter',
            preload: false,
            homeFillsViewer: true,
            visibilityRatio: 1.0
        };


        // Instantiate viewer with the ViaWebGL Version of OSD
        that.viewer = viaWebGL.OpenSeadragon(viewer_config);


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

            let channel = _.find(that.currentChannels, e => {
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
                await that.drawLabels(e);
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
            const group = e.tile.url.split("/");
            let isLabel = group[group.length - 3] == that.labelChannel.sub_url;
            if (isLabel) {
                e.tile._array = new Int32Array(PNG.sync.read(new Buffer(e.tileRequest.response), {colortype: 0}).data.buffer);
                e.image = null;
                return e.getCompletionCallback();
            } else {
                return callback(e);
            }
        });

        // Instantiate viewer managers
        that.viewerManagerVMain = new ViewerManager(that, seaGL.openSD, 'main');
        //
        // // Append to viewers
        that.viewerManagers.push(that.viewerManagerVMain);


        seaGL.init();


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

    async drawLabels(e) {
        const self = this;
        if ((self.show_selection) && self.selection.size > 0) {
            let input = e.rendered.canvas;
            let width = e.rendered.canvas.width;
            let height = e.rendered.canvas.height;
            let labelTileCacheKey = getLabelTileAttribute(e.tile.cacheKey);
            let screenData;
            let labelTile = self.viewer.tileCache.getImageRecord(labelTileCacheKey);
            if (!labelTile) {
                await addTile(getLabelTileAttribute(e.tile.url));
                labelTile = self.viewer.tileCache.getImageRecord(labelTileCacheKey);
            }
            if (!labelTileCacheKey) {
                getLabelTileAttribute(e.tile.cacheKey);
                labelTile = self.viewer.tileCache.getImageRecord(labelTileCacheKey);
            }
            let labelData = labelTile._tiles[0]._array;
            for (let i = 0; i < width * height; i++) {
                let labelVal = labelData[i] - 1;
                if (labelVal != -1) {
                    if (self.selection.has(labelVal)) {
                        if (!screenData) {
                            screenData = e.rendered.getImageData(0, 0, input.width, input.height);
                        }
                        let index = i * 4;
                        let color = [255, 255, 255, 255];
                        screenData['data'][index] = color[0];
                        screenData['data'][index + 1] = color[1];
                        screenData['data'][index + 2] = color[2];
                        screenData['data'][index + 3] = color[3];
                    }
                }
            }
            if (screenData) {
                e.rendered.putImageData(screenData, 0, 0);
            }
        }
        function getLabelTileAttribute(attribute) {
            const group = attribute.split("/");
            const somePath = group[group.length - 3];
            const labelPath = self.labelChannel["sub_url"];
            const labelTileCacheKey = attribute.replace(somePath, labelPath);
            return labelTileCacheKey;
        }
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
     *
     *
     * @param radius
     * @param selection
     * @param dragging
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

    /**
     * @function forceRepaint
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
        if (self.currentChannels[channelIdx]) {
            self.currentChannels[channelIdx]['range'] = [tfmin / range[1], tfmax / range[1]];
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
        if (self.currentChannels[channelIdx]) {
            self.currentChannels[channelIdx]['color'] = color;
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

        if (repaint) this.forceRepaint();

    }
}


// Static vars
ImageViewer
    .events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode'
};

async function

addTile(path) {
    const addJob = new Promise((resolve, reject) => {
        if (seaDragonViewer.tileCache[path]) {
            resolve();
        }

        // If we're currently waiting for a tile to load, just use it's callback
        if (seaDragonViewer.pendingTiles.has(path)) {
            return seaDragonViewer.pendingTiles.get(path);
        }

        // seaDragonViewer.pendingTiles.add(path);
        function callback(success, error, request) {
            if (success) {
                let event = {'tileRequest': request, 'tile': {'url': path}}
                seaDragonViewer.tileLoaded(event);
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
