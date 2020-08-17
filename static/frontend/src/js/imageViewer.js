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
            maxImageCacheCount: 2000, // default is 200, had to set up for loading two layers (labels and image)
            preload: true,
            homeFillsViewer: true,
            visibilityRatio: 1.0
            //debugMode:  true,
        };

        // Instantiate viewer
        that.viewer = OpenSeadragon(viewer_config);

        // Data load 1 - rgb filter
        const data_colors = [
            {
                index: 0,
                name: 'black',
                r: 0,
                g: 0,
                b: 0
            },
            {
                index: 1,
                name: 'white',
                r: 255,
                g: 255,
                b: 255
            },
            {
                index: 2,
                name: 'red',
                r: 255,
                g: 0,
                b: 0
            },
            {
                index: 3,
                name: 'green',
                r: 0,
                g: 255,
                b: 0
            },
            {
                index: 4,
                name: 'blue',
                r: 0,
                g: 0,
                b: 255
            },
            {
                index: 5,
                name: 'light red',
                r: 255,
                g: 128,
                b: 128
            },
            {
                index: 6,
                name: 'light green',
                r: 128,
                g: 255,
                b: 128
            },
            {
                index: 7,
                name: 'light blue',
                r: 128,
                g: 128,
                b: 255
            },
        ];
        const dataLoad1 = {
            data: data_colors,
            config: {
                type: 'color-index',
                filter: 'fil_data_rgb'
            }
        }

        // Data load 2 - nearest cell
        const data_nearest_cell = [];
        const dataLoad2 = {
            data: data_nearest_cell,
            config: {
                type: 'object-single',
                filter: 'fil_data_custom',
                vf_ref: 'vis_data_custom',
                bridge: dataFilter.getNearestCell,
                filterCode: {
                    data: [],
                    name: 'fil_data_nearest_cell',
                    vis_name: 'Data Nearest Cell',
                    settings: {
                        active: 1,
                        default: 1,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_nearest_cell',
                        iter: 'px'
                    },
                    set_pixel: (px) => {
                        // Emulate lenses class setting
                        const vis = this.viewer.lensing.lenses;

                        // Get position of cell and add to data
                        const pos = vis.lensing.configs.pos_full;
                        dataFilter.getNearestCell(pos[0], pos[1]).then(d => {

                            // Clear data to vis
                            vis.lensing.viewfinder.data_cells = [];

                            // Calc offset
                            const cell_point = new OpenSeadragon.Point(d.CellPosition_X, d.CellPosition_Y);
                            const cell_vpoint = vis.lensing.viewer_aux.viewport.pixelFromPoint(
                                vis.lensing.viewer_aux.world.getItemAt(0).imageToViewportCoordinates(cell_point)
                            );
                            const offset = [
                                Math.round(cell_vpoint.x - vis.lensing.configs.pos[0] / vis.lensing.configs.pxRatio),
                                Math.round(cell_vpoint.y - vis.lensing.configs.pos[1] / vis.lensing.configs.pxRatio)
                            ];
                            const distance = Math.sqrt(offset[0] ** 2 + offset[1] ** 2);

                            // Add to vis data
                            if (distance <= vis.lensing.configs.rad / vis.lensing.configs.pxRatio) {
                                vis.lensing.viewfinder.data_cells.push({
                                    data: d,
                                    offset: offset
                                });
                            }

                        }).catch(err => console.log(err));

                    },
                    update: (i, index) => {
                        // Emulate lenses class setting
                        const vis = this.viewer.lensing.lenses;

                        // Magnify
                        vis.selections.magnifier.update(i, index);
                    },
                    fill: 'rgba(255, 255, 255, 0)',
                    stroke: 'rgba(0, 0, 0, 1)'
                },
                get_vf_setup: () => {
                    return {
                        name: 'vis_data_nearest_cell',
                        init: () => {
                            // Define this
                            const vis = this.viewer.lensing.viewfinder;

                            // Vars
                            vis.data_cells = [];
                            vis.nest_range = [];
                            vis.active_channels = ['DNA'];

                            // Els
                            vis.els.cellsG = null
                            vis.els.textReportG = null
                            vis.els.areachartG = null;
                            vis.els.areachartAxisG = null

                            // Configs
                            vis.configs.row_spacing = 16;
                            vis.configs.areachartW = 120;
                            vis.configs.areachartH = 20;
                            vis.configs.newBlackboardH = 80;

                            // Tools
                            vis.tools.nestScX = d3.scaleLinear().range([0, vis.configs.areachartW])
                            vis.tools.nestScY = d3.scaleLinear()
                                .range([vis.configs.areachartH, 0])
                                .domain([0, 2 ** 16])
                            vis.tools.area = d3.area()
                                .x(d => vis.tools.nestScX(d.index))
                                .y1(d => vis.tools.nestScY(d.value))
                                .y0(vis.configs.areachartH);

                            // Resize box g
                            vis.els.blackboardG.attr('height', vis.configs.newBlackboardH);

                            // Append radial g
                            vis.els.cellsG = vis.els.radialG.append('g');

                            // Append text report g
                            vis.els.textReportG = vis.els.boxG.append('g')
                                .attr('class', 'viewfinder_text_report_g');
                            vis.els.textReportG.append('text')
                                .attr('class', 'viewfinder_box_text viewfinder_box_text_a')
                                .attr('fill', 'white')
                                .attr('x', `${vis.configs.boxW / 2}px`)
                                .attr('y', `${vis.configs.row_spacing}px`)
                                .attr('text-anchor', 'middle')
                                .attr('alignment-baseline', 'middle')
                                .style('font-family', 'sans-serif')
                                .style('font-size', '10px')
                                .style('font-weight', 'lighter');

                            // Add area chart (histogram)
                            vis.els.areachartG = vis.els.boxG.append('g')
                                .attr('class', 'viewfinder_areachasrt_g')
                                .style('transform',
                                    `translate(${(vis.configs.boxW - vis.configs.areachartW) / 2}px, ${vis.configs.row_spacing * 2}px)`);
                            vis.els.areachartG.append('path')
                                .attr('class', 'viewfinder_areachart_path');

                        },
                        wrangle: () => {
                            // Define this
                            const vis = this.viewer.lensing.viewfinder;

                            // Get range nest
                            vis.nest_range = [];
                            if (vis.data_cells.length > 0) {

                                const blacklist = ['id', 'phenotype'];
                                let index = 0;
                                for (let d in vis.data_cells[0].data) {
                                    if (!blacklist.includes(d)) {
                                        vis.nest_range.push({
                                            key: d,
                                            value: vis.data_cells[0].data[d],
                                            index: index
                                        });
                                        index++;
                                    }
                                }

                                // Set scales
                                vis.tools.nestScX.domain([0, vis.nest_range.length - 1]);
                            } else {
                                vis.tools.nestScX.domain([0, 1]);
                            }

                        },
                        render: () => {
                            // Define this
                            const vis = this.viewer.lensing.viewfinder;

                            // Append cell center circles
                            vis.els.cellsG.selectAll('.cell')
                                .data(vis.data_cells)
                                .join(
                                    enter => enter.append('g')
                                        .attr('class', 'cell')
                                        .each(function (d) {
                                            const g = d3.select(this)
                                                .style(`transform`, `translate(${d.offset[0]}px, ${d.offset[1]}px)`);
                                            g.append('circle')
                                                .attr('r', 3)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'rgba(0, 0, 0, 0.5)')
                                                .attr('stroke-width', 3);
                                            g.append('circle')
                                                .attr('r', 3)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'white');
                                        }),
                                    update => update
                                        .each(function (d) {
                                            const g = d3.select(this)
                                                .style(`transform`, `translate(${d.offset[0]}px, ${d.offset[1]}px)`);
                                        }),
                                    exit => exit.remove()
                                );

                            // Update text
                            const id = vis.data_cells.length > 0 ? vis.data_cells[0].data.id : 'None in range';
                            vis.els.textReportG.select('.viewfinder_box_text_a')
                                .text(`Cell ID: ${id}`);

                            // Build area chart
                            vis.els.areachartG.select('.viewfinder_areachart_path')
                                .datum(vis.nest_range)
                                .attr('d', vis.tools.area)
                                .attr('fill', 'white');

                            // Add markers
                            const channelArray = vis.nest_range.length > 0 ? vis.active_channels : [];
                            vis.els.areachartG.selectAll('.viewfinder_areachart_markerG')
                                .data(channelArray, d => d)
                                .join(
                                    enter => enter.append('g')
                                        .attr('class', 'viewfinder_areachart_markerG')
                                        .each(function (d) {
                                            const g = d3.select(this);
                                            const findChannel = vis.nest_range.find(c => d === c.key.split('_')[0]);
                                            const x = vis.tools.nestScX(d.index);
                                            g.style('transform', `translateX(${x}px)`);
                                            g.append('line')
                                                .attr('y1', vis.configs.areachartH + 3)
                                                .attr('y2', vis.configs.areachartH + 6)
                                                .attr('stroke', 'white');
                                            g.append('text')
                                                .attr('class', 'viewfinder_areachart_marker_text')
                                                .attr('y', vis.configs.areachartH + 15)
                                                .attr('fill', 'white')
                                                .attr('font-family', 'sans-serif;')
                                                .attr('font-size', 8)
                                                .attr('font-weight', 'lighter')
                                                .attr('text-anchor', `middle`)
                                                .text(d);
                                        })
                                )

                        },
                        destroy: () => {

                        }
                    }
                },
            }
        }

        const dataLoad = [dataLoad1, dataLoad2];

        // Instantiate viewer - todo ck :: jj
        that.viewer.lensing = l.construct(OpenSeadragon, that.viewer, viewer_config, dataLoad);

        // Instantiate colorManagers -todo ck :: jj
        that.viewerManagerVMain = new ViewerManager(that, that.viewer, 'main');
        that.viewerManagerVAuxi = new ViewerManager(that, that.viewer.lensing.viewer_aux, 'auxi');

        // OpenSeadragonCanvasOverlayHd: add canvas overlay -  drawing selection rectangles
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
     *
     * @returns void
     */
    actionFocus(vp) {
        this.setViewPort(vp.x, vp.y, vp.width, vp.height);
    }

    /**
     * @function updateSelection
     *
     * @param selection
     *
     * @returns void
     */
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
        seaDragonViewer.viewer.forceRefilter();
        seaDragonViewer.viewer.forceRedraw();
        seaDragonViewer.viewer.lensing.viewer_aux.forceRefilter();
        seaDragonViewer.viewer.lensing.viewer_aux.forceRedraw();
    }
}


//static vars
ImageViewer.events = {
    //imageClicked: 'image_clicked',
    imageClickedMultiSel: 'image_clicked_multi_selection',
    renderingMode: 'renderingMode'
};


// PUBLIC METHODS TODO - integrate as static (talk w Robert/Simon)

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