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


        // Map of selected ids, key is id
        this.selection = new Map();
        this.data = new Map();

        // Currently loaded image / label channels
        this.currentChannels = {};
        this.labelChannel = {};
        this.noLabel = false;
        this.sel_outlines = true;

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
        this.singleCellView = true;
        this.contourView = false;
        // this.lassoButton = document.getElementById("lasso_button");
        // this.selectButton = document.getElementById("select_button");
        this.cellViewButton = document.getElementById("cell_view_icon");
        this.contourViewButton = document.getElementById("contour_icon");

        this.isSelectionToolActive = true;
        this.colorByCellType = true;

    }

    /**
     * @function init
     */
    init() {

        // Define this as that
        const that = this;

        // Hide Loader
        that.hideLoader();

        // Config viewer
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/client/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",

            maxZoomPixelRatio: 15,
            showFullPageControl: false,
            zoomInButton: "zoom-in",
            zoomOutButton: "zoom-out",
            homeButton: "home",
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 100,
            imageLoaderLimit: 3,
            timeout: 90000,
            compositeOperation: 'lighter',
            preload: false,
            homeFillsViewer: true,
            visibilityRatio: 1.0,
            viewportMargins: {
                top: 0,
                left: 250,
                right: 0,
                bottom: 0

            }
        };

        // Instantiate viewer
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
                    if (!e.tile._array || !e.tile._tileImageData) {
                        console.log('Missing Array', e.tile.url);
                        // this.refreshSegmentationMask();
                    }
                    try {
                        that.drawLabelTile(e.tile, e.tile._tileImageData.width, e.tile._tileImageData.height);
                    } catch (err) {
                        console.log('Drawing Issue for ', e, err);
                    }
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
                            // that.showLoader();
                            return dataLayer.getCellsInPolygon(that.polygonSelection, false, false)
                                .then(cells => {
                                    that.hideLoader();
                                    d3.select('#selectionPolygon').remove();
                                    that.eventHandler.trigger(ImageViewer.events.displaySelection, {
                                        'selection': cells,
                                        'selectionSource': 'Image'
                                    });
                                })
                        }
                    }
                }
            }, nonPrimaryReleaseHandler(event) {
                if (that.selectButton.classList.contains('selected') && !that.lassoing) {
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
            }
            , moveHandler: function (event) {
                if (that.isSelectionToolActive && that.lassoing) {
                    that.lasso_draw(event);
                }
            }
        })


//some resizing corrections
        d3.select(window).on('resize', function () {
        });
        that.svg_overlay.resize();

        /********************************************************************************************** Emulate click */

// Click first from channel list
// document.querySelector('.channel-list-content').click();

        /******************************************************************************************** Back to normal  */
// OpenSeadragonCanvasOverlayHd: add canvas overlay - drawing selection rectangles
        this.canvasOverlay = new OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: function (opts) {
                const context = opts.context;
                //area selection polygon
                if (that.selectionPolygonToDraw && that.selectionPolygonToDraw.length > 0) {
                    var d = that.selectionPolygonToDraw;
                    context.globalAlpha = 0.7;
                    context.strokeStyle = 'orange';
                    context.lineWidth = 10;
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

        // that.lassoButton.addEventListener("click", () => {
        //     that.lassoButton.classList.add('selected');
        //     that.selectButton.classList.remove('selected');
        //     that.isSelectionToolActive = true;
        // })
        //
        // that.selectButton.addEventListener("click", () => {
        //     that.selectButton.classList.add('selected');
        //     that.lassoButton.classList.remove('selected');
        //     that.isSelectionToolActive = false;
        // })
        that.contourViewButton.addEventListener("click", () => {
            that.contourView = !that.contourView;
            updateSeaDragonSelection(false, true);
        });


        that.cellViewButton.addEventListener("click", () => {
            //     let outerCircles = that.cellViewButton.querySelectorAll('.outer-circles');
            //     _.each(outerCircles, circle => {
            //         let thisCircle = d3.select(circle);
            //         if (that.singleCellView) {
            //             thisCircle.attr('fill', '#FEA50A')
            //         } else {
            //             thisCircle.attr('fill', 'none');
            //         }
            //     });
            //
            that.singleCellView = !that.singleCellView;
            that.eventHandler.trigger(ImageViewer.events.changeSelectionMode, that.singleCellView);
        });
        //
        //     // that.selectButton.classList.add('selected');
        //     // that.lassoButton.classList.remove('selected');
        //     // that.isSelectionToolActive = false;
        // })
        //

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

    drawLabelTile(tile, width, height) {
        const self = this;
        let imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
        tile._tileImageData = imageData;
        if (self.show_selection && self.selection.size > 0) {
            tile._array.forEach((val, i) => {
                    if (val != 0 && self.selection.has(val - 1)) {
                        let labelValue = val - 1;
                        let phenotype = _.get(seaDragonViewer.selection.get(labelValue), 'phenotype');
                        let color = [255, 255, 255];
                        if (!seaDragonViewer.contourView) {
                            if (seaDragonViewer.colorByCellType) {
                                color = seaDragonViewer.colorScheme.colorMap[phenotype].rgb;
                            }
                        }
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

    showLoader() {
        // document.getElementById('openseadragon_loader').style.display = "block";

    }

    hideLoader() {
        document.getElementById('openseadragon_loader').style.display = "none";
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

    drawContourLines() {
        const self = this;
        return dataLayer.getContourLines().then((pathResp, i) => {
            var removeNoise = [[].concat.apply([], pathResp)]
            // let removeNoise = pathResp.filter(e => {
            //     return e[0][2] != -1
            // })
            removeNoise.forEach((path, i) => {
                let polygon = concaveman(path, 2);
                let pathsArray = polygon.map(point => {
                    return self.viewer.world.getItemAt(0).imageToViewportCoordinates(point[0], point[1]);
                });
                pathsArray = [[pathsArray]];
                const lineFunc = d3.line(d => {
                    return d.x
                }, d => {
                    return d.y
                })

                const groups = self.overlay
                    .selectAll(`g.contourPathGroups${i}`)
                    .data(pathsArray)
                    .join("g");

                groups.attr('class', `contourPathGroups contourPathGroups${i}`)

                groups.selectAll('path')
                    .data(d => d)
                    .join('path')
                    .classed('contourPath', true)
                    .attr("d", lineFunc)

            })


            // let pathsArray = Object.values(pathResp).map(paths_el => {
            //     return paths_el.map(path_el => {
            //         return path_el.map(point => {
            //             return self.viewer.world.getItemAt(0).imageToViewportCoordinates(point[0], point[1]);
            //         })
            //     })
            // })


        })
    }

    clearContourLines() {
        const self = this;
        d3.selectAll('.contourPathGroups').remove();
    }


    changeColoring(colorByCellType) {
        const that = this;
        that.colorByCellType = !that.colorByCellType;
        updateSeaDragonSelection(false, true);
    }
}

// Static vars
ImageViewer
    .events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode',
    displaySelection: 'displaySelection',
    changeSelectionMode: 'changeSelectionMode',
    displayNeighborhoodSelection: 'displayNeighborhoodSelection'
};

async function addTile(path) {

    const promiseWrapper = new Promise((resolve, reject) => {
        function addTileResponse(success, error) {
            // console.log("Emergency Added Tile:", path);
            resolve();
        }

        const options = {
            src: path,
            loadWithAjax: true,
            crossOriginPolicy: false,
            ajaxWithCredentials: false,
            callback: addTileResponse
        }
        seaDragonViewer.viewer.imageLoader.addJob(options)
    })
    return Promise.all([promiseWrapper])

}