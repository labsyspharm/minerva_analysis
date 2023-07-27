/**
 * viewer.js.
 *
 * ImageViewer for CyCif data based on OpenSeadragon.
 *
 */

class ImageViewer {

    // Class vars
    databaseDescription = null;
    imageMetadata = null;
    viewer = null;
    viewers = [];
    viewerManagerVMain = null;
    viewerManagerVAuxi = null;
    viewerManagers = [];

    constructor(config, dataLayer, eventHandler, colorScheme) {

        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;

        // Viewer
        this.viewer = {};

        // OSD pluginTools
        this.canvasImg = []; //an overlay to render

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
    async init() {

        // Define this as that
        const that = this;

        // Hide Loader
        document.getElementById('openseadragon_loader').style.display = "none";

        // Config viewer
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/scope2screen/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
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
        viaWebGL.OpenSeadragon.TileCache.prototype.clearTile = function (tile) {
            OpenSeadragon.console.assert(tile, '[TileCache.clearTilesFor] tile is required');
            var tileRecord;
            for (var i = 0; i < this._tilesLoaded.length; ++i) {
                tileRecord = this._tilesLoaded[i];
                if (tileRecord.tile === tile) {
                    this._unloadTile(tileRecord);
                    this._tilesLoaded.splice(i, 1);
                    return;
                }
            }

        };

        // Instantiate viewer with the ViaWebGL Version of OSD
        this.viewer = viaWebGL.OpenSeadragon(viewer_config);
        // TODO: Giorgio wants this, but idk if it's worth adding now
        // this.viewer.gestureSettingsMouse.clickToZoom = false;
        this.viewer.addHandler('tile-load-failed', (e) => {
            console.log('Tile Caching Error: ', e)
            this.viewer.tileCache.clearTile(e.tile);
            that.forceRepaint();
        });


        /****************************************************************************************** OSD style changes */

        // Get and shrink all button images
        this.parent = d3.select(`#openseadragon`);
        this.parent.selectAll('img')
            .attr('height', 40);

        // Force controls to bottom right
        const controlsAnchor = this.parent.select('img').node().parentElement.parentElement.parentElement.parentElement;
        controlsAnchor.style.left = 'unset';
        controlsAnchor.style.top = 'unset';
        controlsAnchor.style.right = '5px';
        controlsAnchor.style.bottom = '5px';

        /************************************************************************************** Create viewer overlay */

        this.viewer.overlay = new ViewerOverlay(this);

        /************************************************************************************* Lensing Implementation */

            // Get lensingFilters data
        const dataLoad = LensingFiltersExt.getFilters(this);

        // Instantiate lensing
        const lensing_config = {};
        this.viewer.lensing = Lensing.create(OpenSeadragon, this.viewer, viewer_config, lensing_config, dataLoad);



        /************************ SVG Overlay for additional graphics in the image view ***************?*/

        this.viewer.svgOverlay = this.viewer.svgOverlay();
        this.viewer.svg = this.viewer.svgOverlay.node();

        // $(window).resize(function () {
        //     this.viewer.svgOverlay.resize();
        // });

        /************************ CANVAS Overlay for additional graphics in the image view ***************?*/

        this.viewer.canvasOverlay = new OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: function (options) {
                let context = options.context;
                //some checks to be safe..
                if (context != null && context != undefined && Object.keys(context).length === 0 && that.canvasImg.mask) {
                    context.drawImage(that.canvasImg.mask, that.canvasImg.shift_x, that.canvasImg.shift_y,
                        that.canvasImg.width, that.canvasImg.height,);
                }
            },
            clearBeforeRedraw: true
        });

        /*************************************************** Access OME tiff metadata / activate lensing measurements */

        // Get metadata -> share with lensing
        this.dataLayer.getMetadata().then(d => {

            // Add magnification
            this.imageMetadata = d;

            //
            const unitConversion = {
                inputUnit: d.physical_size_x_unit,
                outputUnit: 'µm',
                inputOutputRatio: [1, 1]
            }

            // Update lensing
            this.viewer.lensing.config_update({
                compassOn: true,
                compassUnitConversion: unitConversion,
                imageMetadata: this.imageMetadata,
            });

        }).catch(err => console.log(err));

        /************************************************************************************************* Use webgl  */

        // Instantiate viewer managers
        this.viewerManagerVMain = new ViewerManager(this, this.viewer, 'main');
        this.viewerManagerVAuxi = new ViewerManager(this, this.viewer.lensing.viewer_aux, 'auxi');
        this.viewerManagers.push(this.viewerManagerVMain, this.viewerManagerVAuxi);

        // For multiple viewers
        this.viewers = [
            {
                name: 'main',
                viewer: this.viewer,
                show_selections: true,
                selection_outlined: true
            },
            {
                name: 'auxi',
                viewer: this.viewer.lensing.viewer_aux,
                show_selections: true,
                selection_outlined: true
            }
        ];

        /************************************************************************************** Database description  */

        dataLayer.getDatabaseDescription().then(result => {

            this.databaseDescription = result;

        }).catch(err => console.log(err))

        /************************************************************************************* Right click selection  */

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

                // Query
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
                    });
            }
        });



    }

    // drawLabelTile(tile, width, height) {
    //     console.log(tile)
    //
    //     //
    //     const self = this;
    //
    //     // Empty data
    //     let imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
    //     tile._tileImageData = imageData;
    //
    //     // Iterate if selection
    //     if (self.show_selection && self.selection.size > 0) {
    //
    //         imageData = tile._tileImageData;
    //         tile._array.forEach((val, i) => {
    //             if (val !== 0 && self.selection.has(val - 1)) {
    //                 let index = i * 4;
    //                 imageData.data[index] = 255;
    //                 imageData.data[index + 1] = 255;
    //                 imageData.data[index + 2] = 255;
    //                 imageData.data[index + 3] = 255;
    //                 tile.containsLabel = true;
    //             }
    //         })
    //     }
    // }

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

    // /** TODO - not sure if is being used?
    //  *
    //  * @param radius
    //  * @param selection
    //  * @param dragging
    //  */
    // drawCellRadius(radius, selection, dragging = false) {
    //
    //     let x = selection[dataLayer.x];
    //     let y = selection[dataLayer.y];
    //     let imagePoint = this.viewer.world.getItemAt(0).imageToViewportCoordinates(x, y);
    //     let circlePoint = this.viewer.world.getItemAt(0).imageToViewportCoordinates(x + _.toNumber(radius), y);
    //     let viewportRadius = Math.abs(circlePoint.x - imagePoint.x);
    //     let overlay = seaDragonViewer.viewer.svgOverlay();
    //     let fade = 0;
    //     // When dragging the bar, don't fade out
    //     if (dragging) {
    //         fade = 1;
    //     }
    //
    //     let circle = d3.select(overlay.node())
    //         .selectAll('.radius-circle')
    //         .interrupt()
    //         .data([{'x': imagePoint.x, 'y': imagePoint.y, 'r': viewportRadius}])
    //     circle.enter()
    //         .append("circle")
    //         .attr("class", "radius-circle")
    //         .merge(circle)
    //         .attr("cx", d => {
    //             return d.x;
    //         })
    //         .attr("cy", d => {
    //             return d.y;
    //         })
    //         .attr("r", d => {
    //             return d.r;
    //         })
    //         .style("opacity", 1)
    //         .transition()
    //         .duration(1000)
    //         .ease(d3.easeLinear)
    //         .style("opacity", fade);
    //     circle.exit().remove();
    //
    // }

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
                vM.channelAdd(channelIdx);
            });
        } else {
            this.viewerManagers.forEach(vM => {
                vM.channelRemove(channelIdx);
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
        self.viewerManagers.forEach(vM => {
            if (vM.viewerChannels[`${channelIdx}`]) {
                let channelRange = [tfmin / range[1], tfmax / range[1]];
                vM.viewerChannels[channelIdx]['range'] = channelRange;
                vM.rangeConnector[`${channelIdx}`] = channelRange;
            }
        })
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

        const channelIdx = imageChannels[name];
        this.viewerManagers.forEach(vM => {
            if (vM.viewerChannels[`${channelIdx}`]) {
                vM.colorConnector[`${channelIdx}`] = {color: color};
                vM.viewerChannels[`${channelIdx}`]['color'] = color;
            }

            vM.forceRepaint();
        });
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

        // Update selection
        this.selection = selection;

        // Update via viewer manager
        this.viewerManagers.forEach(vM => {
            vM.updateSelection();
        });
    }
}


// Static vars
ImageViewer.events = {
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode'
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