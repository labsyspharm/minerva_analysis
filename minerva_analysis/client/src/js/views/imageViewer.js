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

        this.isSelectionToolActive = true;
        this.showSelection = true;
        this.sel_outlines = true;


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
            maxImageCacheCount: 100,
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
                // After the callback, call the labels
                // await that.drawLabels(e);
            } else {
                if (e.tile._redrawLabel) {
                    that.drawLabelTile(e.tile, e.tile._tileImageData.width, e.tile._tileImageData.height);
                }
                if (e.tile.containsLabel) {
                    e.rendered.putImageData(e.tile._tileImageData, 0, 0);
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
            try {
                const group = e.tile.url.split("/");
                let isLabel = group[group.length - 3] == that.labelChannel.sub_url;
                e.tile._blobUrl = e.image.src;
                // Label Tiles We'll view as 32 bits to get the ID values and save that on the tile object so it's cached
                if (isLabel) {
                    e.tile._array = new Int32Array(PNG.sync.read(new Buffer(e.tileRequest.response), {colortype: 0}).data.buffer);

                    that.drawLabelTile(e.tile, e.image.width, e.image.height);

                    // We're hence skipping that OpenseadragonGL callback since we only care about the vales
                    return e.getCompletionCallback()();
                } else {
                    // This goes to OpenseadragonGL which does the necessary bit stuff.
                    return callback(e);
                }
            } catch (e) {
                console.log('Load Error, Refreshing');
                that.forceRepaint();

                // return callback(e);
            }
        });


        this.viewer.addHandler('tile-drawn', (e) => {
            let count = _.size(e.tiledImage._tileCache._tilesLoaded);
            e.tiledImage._tileCache._imagesLoadedCount = count;

        });

        this.viewer.addHandler('tile-unloaded', (e) => {
            (window.URL || window.webkitURL).revokeObjectURL(e.tile._blobUrl);
            delete e.tile._array;
            delete e.tile._tileImageData;
        });


        // Instantiate viewer managers
        that.viewerManagerVMain = new ViewerManager(that, seaGL.openSD, 'main');
        //
        // // Append to viewers
        that.viewerManagers.push(that.viewerManagerVMain);


        seaGL.init();

        /*********/
        that.svg_overlay = that.viewer.svgOverlay()
        that.overlay = d3.select(that.svg_overlay.node())

//SELECTION POLYGON (LASSO)
        that.polygonSelection = [];
        that.renew = false;
        that.numCalls = 0; //defines how fine-grained the polygon resolution is (0 = no subsampling, 10=high subsampling)
        that.lassoing = false;
        that.lasso_draw = function (event) {
            //add points to polygon and (re)draw
            let webPoint = event.position;
            if (that.numCalls % 5 == 0) {
                // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
                let viewportPoint = that.viewer.viewport.pointFromPixel(webPoint);
                // Convert from viewport coordinates to image coordinates.
                let imagePoint = that.viewer.world.getItemAt(0).viewportToImageCoordinates(viewportPoint);
                that.polygonSelection.push({'imagePoints': imagePoint, 'viewportPoints': viewportPoint});
            }

            d3.select('#selectionPolygon').remove();
            var selPoly = that.overlay.selectAll("selectionPolygon").data([that.polygonSelection]);
            selPoly.enter().append("polygon")
                .attr('id', 'selectionPolygon')
                .attr("points", function (d) {
                    return d.map(function (d) {
                        return [d.viewportPoints.x, d.viewportPoints.y].join(",");
                    }).join(" ");
                })
            that.numCalls++;
        }

        that.lasso_end = function (event) {
            that.renew = true;

        }

        let primaryTracker = new OpenSeadragon.MouseTracker({
            element: that.viewer.canvas,
            pressHandler: (event) => {
                if (event.originalEvent.shiftKey) {
                    this.viewer.setMouseNavEnabled(false);
                    if (that.isSelectionToolActive) {
                        that.lassoing = true;
                    } else {
                    }
                    if (!that.isSelectionToolActive) {
                        d3.select('#selectionPolygon').remove();

                    }
                    that.polygonSelection = [];
                    that.numCalls = 0;
                }
            }, releaseHandler: (event) => {
                this.viewer.setMouseNavEnabled(true);
                if (that.lassoing) {
                    that.lassoing = false;
                    console.log('release');
                    if (that.isSelectionToolActive) {
                        that.lasso_end(event);
                        if (_.size(that.polygonSelection) > 2) {
                            return dataLayer.getCellsInPolygon(that.polygonSelection, false, false)
                                .then(cells => {
                                    d3.select('#selectionPolygon').remove();
                                    that.eventHandler.trigger(ImageViewer.events.displaySelection, cells);
                                })
                        }
                    }
                }
            }, moveHandler: function (event) {
                if (that.isSelectionToolActive && that.lassoing) {
                    that.lasso_draw(event);
                }
            }
        })


//some resizing corrections
        d3.select(window).on('resize', function () {
        });
        that.svg_overlay.resize();
    }

    drawLabelTile(tile, width, height) {
        const self = this;
        let imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
        tile._tileImageData = imageData;
        if (self.showSelection && self.selection.size > 0) {
            tile._array.forEach((val, i) => {
                    if (val != 0 && self.selection.has(val - 1)) {
                        let labelValue = val - 1;
                        let celltype = _.get(seaDragonViewer.selection.get(labelValue), 'cellType');
                        let color = seaDragonViewer.colorScheme.colorMap[celltype].rgb;
                        // let color = [255, 255, 255]
                        let index = i * 4;
                        const grid = [
                            index - 4,
                            index + 4,
                            index - width * 4,
                            index + height * 4
                        ];
                        const test = [
                            index % (width * 4) !== 0,
                            index % (width * 4) !== (width - 1) * 4,
                            index >= width * 4,
                            index < width * 4 * (height - 1)
                        ];

                        // If outline
                        if (this.sel_outlines) {
                            // Iterate grid
                            for (let j = 0; j < grid.length; j++) {
                                // if pass test (not on tile border)
                                if (test[j]) {
                                    // Neighbor label value
                                    const altLabelValue = tile._array[grid[j] / 4] - 1;
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

    /**Z
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
            this.showSelection = !this.showSelection;
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
}


// Static vars
ImageViewer
    .events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode',
    displaySelection: 'displaySelection',
};

async function addTile(path) {
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
