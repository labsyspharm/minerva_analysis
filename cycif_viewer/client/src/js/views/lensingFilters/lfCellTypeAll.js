import {Utils} from './utils'

/**
 * @class LfCellTypeAll
 */
export class LfCellTypeAll {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        areaTerm: '',
        cellChannels: [],
        cellTypes: [],
        cellCount: 0,
        cellTypeSort: false,
        cellTypeColumnName: null,
        cellTypeMap: new Map(),
        cellIntensityRange: [0, 65536],
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_chartsMargin: {top: 50, right: 30, bottom: 10, left: 30},
        config_boxW: 250,
        config_boxH: 200,
        config_channelR: 3,
        config_chartR0: 20,
        config_chartR1: 70,
        config_colorR: 8,
        config_fontSm: 9,
        config_fontMd: 11,
        config_nucleusMargin: {top: 0, right: 0, bottom: 30, left: 30},
        config_nucleusR: 25,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartG: null,
        el_chartAreaPath: null,
        el_chartLabelsG: null,
        el_nucleusG: null,
        el_radialExtG: null,
        el_textReportG: null,
        imageChannels: [],
        colorMap : seaDragonViewer.colorScheme.colorMap,
        c10 : d3.scaleOrdinal(d3.schemeCategory10),
        tool_angleScale: d3.scaleLinear()
            .range([0, 2 * Math.PI]),
        tool_areaMaker: d3.areaRadial()
            .curve(d3.curveCardinalClosed),
        tool_channelScale: d3.scaleLinear()
            .range([Math.PI, -Math.PI]),
        tool_nucleusScale: d3.scaleSqrt()
            .domain([0, 200]),
        tool_rCellScale: d3.scalePow()
            .exponent(0.5)
            .range([3, 8]),
        tool_radiusScale: d3.scaleLinear()
            .domain([0, 1]),
        xyPosKeys: [],
        keydown: e => {
            //whether to sort celltype order by count in current range query
            if (e.key === 'j'){
                this.vars.cellTypeSort = !this.vars.cellTypeSort;
                this.image_viewer.viewer.lensing.viewfinder.setup.wrangle();
                this.image_viewer.viewer.lensing.viewfinder.setup.render();
            }
        }
    };

    /**
     * @constructor
     */
    constructor(_imageViewer) {
        this.image_viewer = _imageViewer;

        // From global vars
        this.data_layer = dataLayer;
        this.channel_list = channelList;

        // Init
        this.init()
    }


    /**
     * @function init
     *
     * @return void
     */
    init() {

        this.data = [];
        this.load = {
            data: [],
            config: {
                type: 'object-single',
                filter: 'fil_data_custom',
                vf_ref: 'vis_data_custom',
                filterCode: {
                    data: [],
                    name: 'fil_data_cell_type',
                    vis_name: 'Data Cell Type',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_cell_type',
                        iter: 'px'
                    },
                    set_pixel: () => {

                        if (!this.load.config.filterCode.settings.loading) {

                            //rename object
                            let _this = this;

                            // Lensing ref
                            const lensing = this.image_viewer.viewer.lensing;

                            // Measure relative
                            const screenPt1 = new OpenSeadragon.Point(0, 0);
                            const screenPt2 =
                                new OpenSeadragon.Point(lensing.configs.rad / lensing.configs.pxRatio, 0);
                            const contextPt1 =
                                this.image_viewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt1);
                            const contextPt2 =
                                this.image_viewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt2)
                            let newRad = Math.round(contextPt2.x - contextPt1.x)
                            if (newRad > 500) newRad = 500;

                            // Get position of cell and add to data
                            const pos = lensing.positionData.posFull;

                            // Load
                            this.load.config.filterCode.settings.loading = true;
                            this.data_layer.getNeighborhood(newRad, pos[0], pos[1]).then(darr => {

                                // Loaded
                                this.load.config.filterCode.settings.loading = false;

                                // Send another request if mouse pos is diff
                                if (pos[0] !== lensing.positionData.posFull[0]
                                    && pos[1] !== lensing.positionData.posFull[1]) {
                                    this.load.config.filterCode.set_pixel();
                                }

                                // Check if same filter (in case async return arrives after change)
                                if (this.load.config.filterCode.name !==
                                    this.image_viewer.viewer.lensing.lenses.selections.filter.name) {
                                    (this.load.config.get_vf_setup()).destroy();
                                    return;
                                }

                                // Clear data to vis
                                this.data = [];

                                // Iterate data array
                                darr.forEach(d => {
                                    // Calc offset
                                    const cell_point = new OpenSeadragon.Point(d[config.featureData[0].xCoordinate],
                                        d[config.featureData[0].yCoordinate]);
                                    const cell_vpoint = lensing.viewer_aux.viewport.pixelFromPoint(
                                        lensing.viewer_aux.world.getItemAt(0)
                                            .imageToViewportCoordinates(cell_point)
                                    );
                                    const offset = [
                                        Math.round(cell_vpoint.x - lensing.positionData.pos[0] / lensing.configs.pxRatio),
                                        Math.round(cell_vpoint.y - lensing.positionData.pos[1] / lensing.configs.pxRatio)
                                    ];
                                    const distance = Math.sqrt(offset[0] ** 2 + offset[1] ** 2);

                                    // Add to vis data
                                    if (distance <= lensing.configs.rad / lensing.configs.pxRatio) {
                                        this.data.push({
                                            data: d,
                                            offset: offset
                                        });
                                    }
                                });

                                //update cell type structure (we keep to original map as reference)
                                this.vars.cellCount = darr.length;
                                this.vars.cellTypeMap.forEach((value, key, map) => map.set(key, 0));
                                let cellTypeCounts = this.vars.cellTypeMap;
                                darr.forEach(function(d,i) {
                                    if (d[_this.vars.cellTypeColumnName] != null) {
                                        let fieldName = dataLayer.getNameForPhenotypeId(d[_this.vars.cellTypeColumnName]);
                                        if (!cellTypeCounts.has(fieldName)) {
                                            cellTypeCounts.set(fieldName, 0);
                                        }
                                        cellTypeCounts.set(fieldName, cellTypeCounts.get(fieldName) + 1);
                                    }
                                });
                                this.vars.cellTypes = Array.from(cellTypeCounts);


                                // Trigger update
                                lensing.viewfinder.setup.wrangle()
                                lensing.viewfinder.setup.render();

                            }).catch(err => console.log(err));
                        }
                    },

                    update: (i, index) => {

                        // Magnify (simply pass through after filter)
                        this.image_viewer.viewer.lensing.lenses.selections.magnifier.update(i, index);
                    },
                    fill: 'rgba(255, 255, 255, 0)',
                    stroke: 'rgba(0, 0, 0, 1)'
                },
                get_vf_setup: () => {
                    return {
                        name: 'vis_data_cell_type',
                        init: () => {

                            let _this = this;
                            // Define this
                            const vf = this.image_viewer.viewer.lensing.viewfinder;

                            // Add extensions (to later remove)
                            this.vars.el_radialExtG = vf.els.radialG.append('g')
                                .attr('class', 'viewfinder_radial_ext_g');
                            this.vars.el_boxExtG = vf.els.boxG.append('g')
                                .attr('class', 'viewfinder_box_ext_g');

                            // Append cellsG
                            this.vars.el_cellsG = this.vars.el_radialExtG.append('g')
                                .attr('class', 'viewfinder_cells_g');

                            // Append chartG
                            this.vars.el_chartG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_chart_g')
                                .style('transform', `translate(${this.vars.config_boxW / 2}px, 
                                    ${this.vars.config_boxW / 2 + this.vars.config_boxMargin.top}px)`);
                            this.vars.el_chartLabelsG = this.vars.el_chartG.append('g')
                                .attr('class', 'viewfinder_chart_label_g');
                            this.vars.el_chartAreaPath = this.vars.el_chartG.append('path')
                                .attr('class', 'viewfinder_chart_area_path')
                                .attr('fill', 'rgba(255, 255, 255, 0.9');

                            // Append chartG
                            this.vars.el_chartsG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_charts_g')
                                .style('transform', `translate(${this.vars.config_chartsMargin.left}px, 
                                    ${this.vars.config_chartsMargin.top}px)`);

                                // Append textReportG
                            this.vars.el_textReportG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_text_report_g');
                            this.vars.el_textReportG.append('text')
                                .attr('class', 'viewfinder_text_report_text1')
                                .attr('x', this.vars.config_boxMargin.left)
                                .attr('y', this.vars.config_boxMargin.top)
                                .attr('text-anchor', 'start')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', this.vars.config_fontMd)
                                .attr('font-style', 'italic')
                                .attr('font-weight', 'lighter')
                                .style('letter-spacing', 1)
                                .text('Cell Type view');

                            //Set Visual Containers
                            // Update vf box width
                            vf.els.blackboardRect.attr('width', this.vars.config_boxW);
                            vf.configs.boxW = this.vars.config_boxW;


                            this.vars.active = true;
                            // Trigger channel list data request
                            dataLayer.getCellIdsPhenotype(channelList.sel).then(cellTypes => {

                                //Set cell type column name
                                this.vars.cellTypeColumnName = dataLayer.phenotypeColumnName;

                                // Check if still active
                                if (this.vars.active) {

                                    // Show outlines
                                    this.image_viewer.viewerManagerVMain.show_sel = false;
                                    this.image_viewer.viewerManagerVAuxi.show_sel = true;

                                    // Add to selection
                                    dataLayer.addAllToCurrentSelection(cellTypes);

                                    //Cell type description (names)
                                    let cellTypeDescription = dataLayer.phenotypeDescription;

                                    //If description is there we use these names for naming
                                    if (cellTypeDescription != '' && cellTypeDescription != undefined){
                                        cellTypeDescription.forEach(function(d,i){
                                            _this.vars.cellTypeMap.set(d[1], 0);
                                        });
                                    }
                                    //if not we build a map from the direct entries in the single cell data
                                    else {
                                        let cellTypeCounts = this.vars.cellTypeMap;
                                        cellTypes.forEach(function (d, i) {
                                            if (d[_this.vars.cellTypeColumnName] != undefined) {
                                                if (!cellTypeCounts.has(d[_this.vars.cellTypeColumnName])) {
                                                    cellTypeCounts.set(d[_this.vars.cellTypeColumnName], 0);
                                                }
                                                cellTypeCounts.set(d[_this.vars.cellTypeColumnName], cellTypeCounts.get(d[_this.vars.cellTypeColumnName]) + 1);
                                            }
                                        });
                                        this.vars.cellTypeMap = cellTypeCounts;
                                    }

                                    //depending on how many cell types we have, we set the height of the box
                                    this.vars.config_boxH = this.vars.cellTypeMap.size*24 + 25;

                                    //Set types to vars
                                    this.vars.cellTypes = cellTypes;

                                    // Update selection in viewers
                                    this.image_viewer.updateSelection(dataLayer.getCurrentSelection(), true);
                                }

                            vf.els.blackboardRect.attr('height', this.vars.config_boxH);
                            vf.els.blackboardRect.attr('width', this.vars.config_boxW);
                            vf.configs.boxH = this.vars.config_boxH;
                            vf.configs.boxW = this.vars.config_boxW;

                            // Add listener
                            this.vars.keydown = this.vars.keydown.bind(this)
                            document.addEventListener('keydown', this.vars.keydown);


                            }).catch(err => console.log(err))

                        },
                        wrangle: () => {

                            // Define this
                            const vis = this;


                            //overall cell count:
                            vis.vars.barScale = d3.scaleLinear()
                              .domain([0, vis.vars.cellCount])
                              .range([0, 80]);


                            //sort cell types by count in current range query?
                            if (vis.vars.cellTypeSort){
                                let sorting = vis.vars.cellTypes;
                                sorting.sort(function(a,b){
                                    return b[1] - a[1];
                                });
                                vis.vars.cellTypes = sorting;
                               };
                             d3.select('.viewfinder_charts_g').selectAll(".viewfinder_charts_g_celltypes").remove();


                        },
                        render: () => {

                            // Define this
                            const vis = this;

                            // Get zoom
                            const zoom = vis.image_viewer.viewer.viewport.getZoom();
                            const cellR = vis.vars.tool_rCellScale(zoom);

                            const kF = function(d, i) { return d.item };


                            // Draw something
                            d3.select('.viewfinder_charts_g').selectAll(".viewfinder_charts_g_celltypes").data(vis.vars.cellTypes, function(d) { return  d[0] + "-" +  d[1] })
                                .join(function(group) {
                                    let enter = group.append("g")
                                    .attr('class', 'viewfinder_charts_g_celltypes');

                                        //draw color legend (colored circles by cell type)
                                        enter.append('circle')
                                        .attr('cx', function (d, i) {
                                            return 10
                                        })
                                        .attr('cy', function (d, i) {
                                            return i * 20;
                                        })
                                        .attr('r', 5)
                                        .attr('stroke', 'black')
                                        .attr('fill', function (d, i) {

                                            //we get the index if the original map (so that colors stay consistent if filtered)
                                            let index = Array.from(vis.vars.cellTypeMap)
                                                .map(function(val) {
                                                    return val.slice(0, -1)[0];
                                                }).indexOf(d[0]);

                                            if (vis.vars.colorMap[index]){
                                                return '' + vis.vars.colorMap[index].hex;
                                            }else{
                                                return "#FFFFFF";
                                            }
                                        })

                                        //draw bars (currently linear scaling)
                                        enter.append("rect")
                                            .attr("x", function(d,i){
                                                return 135;
                                            })
                                            .attr("y", function(d,i){
                                                return (i * 20) -5
                                            })
                                            .attr("width", function(d,i){
                                                return vis.vars.barScale(d[1]);
                                            })
                                            .attr("height", function(d,i){
                                                return 10;
                                            })
                                            .attr("fill", "#ffffff");

                                        //draw phenotype names and counts
                                        enter.append("text")
                                        .attr("x", function (d,i) {
                                            return 30;
                                        })
                                        .attr("y", function (d,i) {
                                            return (i * 20) + 2.5;
                                        })
                                        .text(function(d,i){
                                            return d[0] + "  (" +   d[1] + ")";
                                        })
                                        .attr('fill', 'white')
                                        .attr('font-family', 'sans-serif')
                                        .attr('font-size', vis.vars.config_fontSm)
                                        .attr('font-style', 'italic')
                                        .attr('font-weight', 'lighter');

                                        return enter;
                                });

                        },
                        destroy: () => {

                            // Hide outlines
                            this.image_viewer.selection = new Map();
                            this.image_viewer.viewerManagerVMain.show_sel = true;
                            this.image_viewer.viewerManagerVAuxi.forceRepaint();

                            // Mark as inactive
                            this.vars.active = false;

                            // Remove
                            this.vars.el_radialExtG.remove();
                            this.vars.el_boxExtG.remove();
                        }
                    }
                },
            }
        }

    }
}