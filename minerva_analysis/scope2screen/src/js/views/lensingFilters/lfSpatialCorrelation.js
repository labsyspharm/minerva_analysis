import {Utils} from './utils'

/**
 * @class LfSpatialCorrelation
 */
export class LfSpatialCorrelation {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        cellIntensityRange: [0, 65536],
        channelSelection: [],
        config_axisPad: 5,
        config_boxW: 300,
        config_boxH: 300,
        config_bubbleR: 3,
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_chartsMargin: {top: 50, right: 50, bottom: 50, left: 50},
        config_fontSm: 9,
        config_fontMd: 11,
        el_axisX: null,
        el_axisY: null,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartsG: null,
        el_radialExtG: null,
        el_textReportG: null,
        forceUpdate: false,
        tool_axisX: d3.axisBottom(),
        tool_axisY: d3.axisLeft(),
        tool_rCellScale: d3.scalePow()
            .exponent(0.5)
            .range([0.5, 10]),
        tool_scX: d3.scaleLinear(),
        tool_scY: d3.scaleLinear()
    };

    /**
     * @constructor
     */
    constructor(_imageViewer) {
        this.imageViewer = _imageViewer;

        // From global vars
        this.dataLayer = dataLayer;
        this.channelList = channelList;

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
                    name: 'fil_data_spatial_correlation',
                    vis_name: 'Data Spatial Correlation',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_spatial_correlation',
                        iter: 'px'
                    },
                    set_pixel: () => {

                        if (!this.load.config.filterCode.settings.loading) {

                            // Lensing ref
                            const lensing = this.imageViewer.viewer.lensing;

                            // Measure relative
                            const screenPt1 = new OpenSeadragon.Point(0, 0);
                            const screenPt2 =
                                new OpenSeadragon.Point(lensing.configs.rad / lensing.configs.pxRatio, 0);
                            const contextPt1 =
                                this.imageViewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt1);
                            const contextPt2 =
                                this.imageViewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt2)
                            let newRad = Math.round(contextPt2.x - contextPt1.x)
                            if (newRad > 250) newRad = 250;

                            // Get position of cell and add to data
                            const pos = lensing.positionData.posFull;

                            // Load
                            this.load.config.filterCode.settings.loading = true;
                            const channels = [];
                            const channelsShort = channelList.selections;
                            channelsShort.forEach(c => {
                                channels.push(this.dataLayer.getFullChannelName(c))
                            });
                            this.dataLayer.getKResultsForSpatialCorrelation(newRad, pos[0], pos[1], channels).then(darr => {

                                // Loaded
                                this.load.config.filterCode.settings.loading = false;

                                // Send another request if mouse pos is diff
                                if (pos[0] !== lensing.positionData.posFull[0]
                                    && pos[1] !== lensing.positionData.posFull[1]) {
                                    this.load.config.filterCode.set_pixel();
                                }

                                // Check if same filter (in case async return arrives after change)
                                if (this.load.config.filterCode.name !==
                                    this.imageViewer.viewer.lensing.lenses.selections.filter.name) {
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
                                            offset: offset,
                                            distance: distance
                                        });
                                    }
                                });

                                // Trigger update
                                lensing.viewfinder.setup.wrangle()
                                lensing.viewfinder.setup.render();

                            }).catch(err => console.log(err));

                        }

                    },
                    update: (i, index) => {

                        // Magnify (simply pass through after filter)
                        this.imageViewer.viewer.lensing.lenses.selections.magnifier.update(i, index);
                    },
                    fill: 'rgba(255, 255, 255, 0)',
                    stroke: 'rgba(0, 0, 0, 1)'
                },
                get_vf_setup: () => {
                    return {
                        name: 'vis_data_spatial_correlation',
                        init: () => {

                            // Define this
                            const vf = this.imageViewer.viewer.lensing.viewfinder;

                            // Update vf box size
                            vf.els.blackboardRect.attr('height', this.vars.config_boxH);
                            vf.els.blackboardRect.attr('width', this.vars.config_boxW);
                            vf.configs.boxH = this.vars.config_boxH;
                            vf.configs.boxW = this.vars.config_boxW;

                            // Add extensions (to later remove)
                            this.vars.el_radialExtG = vf.els.radialG.append('g')
                                .attr('class', 'viewfinder_radial_ext_g');
                            this.vars.el_boxExtG = vf.els.boxG.append('g')
                                .attr('class', 'viewfinder_box_ext_g');

                            // Append cellsG
                            this.vars.el_cellsG = this.vars.el_radialExtG.append('g')
                                .attr('class', 'viewfinder_cells_g');

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
                                .text('Spatial Correlation');

                            // Append chartG
                            this.vars.el_chartsG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_charts_g')
                                .style('transform', `translate(${this.vars.config_chartsMargin.left}px, 
                                    ${this.vars.config_chartsMargin.top}px)`);
                            this.vars.el_axisX = this.vars.el_chartsG.append('g');
                            this.vars.el_axisY = this.vars.el_chartsG.append('g');

                            // Scales
                            this.vars.tool_rCellScale.domain([this.imageViewer.viewer.viewport.getMinZoom(),
                                this.imageViewer.viewer.viewport.getMaxZoom()]);


                        },
                        wrangle: () => {

                            // Define this
                            const vis = this;

                            // Update scales
                            this.vars.tool_scX.domain([1, 10])
                                .range([0, this.vars.config_boxW - (this.vars.config_chartsMargin.right
                                    + this.vars.config_chartsMargin.left)]);
                            this.vars.tool_scY.domain([1, -1])
                                .range([0, this.vars.config_boxH - (this.vars.config_chartsMargin.top
                                    + this.vars.config_chartsMargin.bottom)]);
                            this.vars.tool_axisX.scale(this.vars.tool_scX).ticks(10);
                            this.vars.tool_axisY.scale(this.vars.tool_scY).tickValues([-1, 0, 1]);


                        },
                        render: () => {

                            // Define this
                            const vis = this;
                            const vf = this.imageViewer.viewer.lensing.viewfinder;

                            // Update vf box size
                            vf.els.blackboardRect.attr('height', this.vars.config_boxH);
                            vf.configs.boxH = this.vars.config_boxH;

                            // Get zoom
                            const zoom = vis.imageViewer.viewer.viewport.getZoom();
                            const cellR = vis.vars.tool_rCellScale(zoom);

                            // Append cell center circles
                            this.vars.el_cellsG.selectAll('.cell')
                                .data(this.data)
                                .join(
                                    enter => enter.append('g')
                                        .attr('class', 'cell')
                                        .each(function (d) {
                                            const g = d3.select(this)
                                                .style(`transform`, `translate(${d.offset[0]}px, ${d.offset[1]}px)`);
                                            g.append('circle')
                                                .attr('r', cellR)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'rgba(0, 0, 0, 0.5)')
                                                .attr('stroke-width', 2);
                                            g.append('circle')
                                                .attr('r', cellR)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'white')
                                                .attr('stroke-width', 1);
                                        }),
                                    update => update
                                        .each(function (d) {
                                            const g = d3.select(this)
                                                .style(`transform`, `translate(${d.offset[0]}px, ${d.offset[1]}px)`);
                                            g.selectAll('circle')
                                                .attr('r', cellR)
                                        }),
                                    exit => exit.remove()
                                );

                            // Create dots on chart
                            vis.vars.el_chartsG.selectAll('.bubbleG')
                                .data(this.data)
                                .join('g')
                                .attr('class', 'bubbleG')
                                .each(function (d, i) {

                                    const g = d3.select(this);

                                    const arr = [];
                                    vis.channelList.selections.forEach(c => {
                                        const fullC = vis.dataLayer.getFullChannelName(c);
                                        for (let i = 1; i <= 10; i++) {
                                            const val = d.data[fullC + '_' + i];
                                            const col = Utils.getChannelColor(c, 65536, vis.imageViewer, vis.channelList)
                                            if (typeof val === 'number') {
                                                arr.push({
                                                    x: i,
                                                    y: val,
                                                    color: col
                                                });
                                            }
                                        }
                                    });

                                    g.selectAll('.bubble')
                                        .data(arr)
                                        .join('circle')
                                        .attr('class', 'bubble')
                                        .attr('r', 3)
                                        .attr('cx', c => vis.vars.tool_scX(c.x))
                                        .attr('cy', c => vis.vars.tool_scY(c.y))
                                        .attr('fill', c => c.color)
                                        .attr('opacity', 0.75);

                                });

                            // // Add dots
                            // vis.vars.el_chartsG.selectAll('.bubble')
                            //     .data(vis.data)
                            //     .join(
                            //         enter => enter
                            //             .append('circle')
                            //             .attr('class', 'bubble')
                            //             .attr('r', vis.vars.config_bubbleR)
                            //             .attr('fill', 'white')
                            //             .attr('r', vis.vars.config_bubbleR)
                            //             .attr('cx', d => vis.vars.tool_scX(d.distance))
                            //             .attr('cy', d => vis.vars.tool_scY(d.data[this.vars.channelSelection])),
                            //         update => update
                            //             .attr('cx', d => vis.vars.tool_scX(d.distance))
                            //             .attr('cy', d => vis.vars.tool_scY(d.data[this.vars.channelSelection])),
                            //         exit => exit.remove()
                            //     );

                            // Axes
                            vis.vars.el_axisX.style('transform',
                                `translateY(${this.vars.config_boxH - (this.vars.config_chartsMargin.top
                                    + this.vars.config_chartsMargin.bottom) + this.vars.config_axisPad}px)`);
                            vis.vars.el_axisY.style('transform', `translateX(${-this.vars.config_axisPad}px)`);
                            vis.vars.el_axisX.transition(250).call(vis.vars.tool_axisX);
                            vis.vars.el_axisY.transition(250).call(vis.vars.tool_axisY);
                            vis.vars.el_axisX.selectAll('text')
                                .attr('fill', 'white');
                            vis.vars.el_axisX.selectAll('line')
                                .attr('stroke', 'white');
                            vis.vars.el_axisX.selectAll('path')
                                .attr('stroke', 'white');
                            vis.vars.el_axisY.selectAll('text')
                                .attr('fill', 'white');
                            vis.vars.el_axisY.selectAll('line')
                                .attr('stroke', 'white');
                            vis.vars.el_axisY.selectAll('path')
                                .attr('stroke', 'white');

                        },
                        destroy: () => {

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