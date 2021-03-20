import {Utils} from './utils'

/**
 * @class LfNearestCellsAll
 */
export class LfNearestCellsAll {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        areaTerm: '',
        cellChannels: [],
        cellIntensityRange: [0, 65536],
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_boxW: 300,
        config_boxH: 300,
        config_channelR: 3,
        config_chartR0: 20,
        config_chartR1: 70,
        config_fontSm: 9,
        config_fontMd: 11,
        config_nucleusMargin: {top: 0, right: 0, bottom: 30, left: 30},
        config_nucleusR: 25,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartG: null,
        el_chartAreaPath: null,
        el_chartAreaPathRef1: null,
        el_chartAreaPathRef2: null,
        el_chartLabelsG: null,
        el_nucleusG: null,
        el_radialExtG: null,
        el_textReportG: null,
        imageChannels: [],
        tool_angleScale: d3.scaleLinear()
            .range([0, 2 * Math.PI]),
        tool_areaMaker: d3.areaRadial()
            .curve(d3.curveCardinalClosed)
            .innerRadius(() => this.vars.config_chartR0)
            .outerRadius(d => d.scale(d.value ? d.value : 0))
            .angle(d => this.vars.tool_angleScale(d.index)),
        tool_areaMakerRef1: d3.areaRadial()
            .curve(d3.curveCardinalClosed)
            .innerRadius(() => this.vars.config_chartR0)
            .outerRadius(d => d.scale(d.refMean))
            .angle(d => this.vars.tool_angleScale(d.index)),
        tool_areaMakerRef2: d3.areaRadial()
            .curve(d3.curveCardinalClosed)
            .innerRadius(d => d.scale(d.refMean))
            .outerRadius(d => d.scale(d.refMean) + 0.5)
            .angle(d => this.vars.tool_angleScale(d.index)),
        tool_channelScale: d3.scaleLinear()
            .range([Math.PI, -Math.PI]),
        tool_nucleusScale: d3.scaleSqrt()
            .domain([0, 200]),
        tool_rCellScale: d3.scalePow()
            .exponent(0.5)
            .range([0.5, 10]),
        xyPosKeys: []
    };

    /**
     * @constructor
     */
    constructor(_imageViewer) {
        this.imageViewer = _imageViewer;

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
                    name: 'fil_data_nearest_cell',
                    vis_name: 'Data Nearest Cell',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_nearest_cell',
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
                                            offset: offset
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
                        name: 'vis_data_nearest_cell',
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
                                .text('Multiplex mean distributions (all)');
                            this.vars.el_textReportG.append('text')
                                .attr('class', 'viewfinder_text_report_text2')
                                .attr('x', this.vars.config_boxMargin.left * 2.5)
                                .attr('y', this.vars.config_boxMargin.top * 3.5)
                                .attr('text-anchor', 'start')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', this.vars.config_fontSm)
                                .attr('font-style', 'italic')
                                .attr('font-weight', 'lighter');

                            // Append chartG
                            this.vars.el_chartG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_chart_g')
                                .style('transform', `translate(${this.vars.config_boxW / 2}px, 
                                    ${this.vars.config_boxW / 2 + this.vars.config_boxMargin.top}px)`);
                            this.vars.el_chartLabelsG = this.vars.el_chartG.append('g')
                                .attr('class', 'viewfinder_chart_label_g');

                            // Clipping mask
                            this.vars.el_chartG.append('defs')
                                .append('clipPath')
                                .attr('id', 'radialClip')
                                .append('path')
                                .attr('d', () => {
                                    return d3.arc()
                                        .innerRadius(this.vars.config_chartR0)
                                        .outerRadius(this.vars.config_chartR1)
                                        .startAngle(0)
                                        .endAngle(Math.PI * 2)();
                                });
                            this.vars.el_chartAreaPathRef1 = this.vars.el_chartG.append('path')
                                .attr('class', 'viewfinder_chart_area_path_ref_1')
                                .attr('clip-path', 'url(#radialClip)')
                                .attr('fill', 'rgba(255, 160, 0, 0.8)');
                            this.vars.el_chartAreaPath = this.vars.el_chartG.append('path')
                                .attr('class', 'viewfinder_chart_area_path')
                                .attr('clip-path', 'url(#radialClip)')
                                .attr('fill', 'rgba(255, 255, 255, 0.9)');
                            this.vars.el_chartAreaPathRef2 = this.vars.el_chartG.append('path')
                                .attr('class', 'viewfinder_chart_area_path_ref_2')
                                .attr('clip-path', 'url(#radialClip)')
                                .attr('fill', 'none')
                                .attr('stroke', 'rgba(255, 160, 0, 1)');

                            // Append nucleusG
                            this.vars.el_nucleusG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_nucleus_g')
                                .style('transform', `translate(${this.vars.config_nucleusMargin.left}px, 
                                    ${this.vars.config_boxH - this.vars.config_nucleusMargin.bottom}px)`);
                            this.vars.el_nucleusG.append('circle')
                                .attr('class', 'viewfinder_nucleus_g_circle')
                                .attr('fill', 'rgba(255, 255, 255, 0.9)');
                            this.vars.el_nucleusG.append('text')
                                .attr('class', 'viewfinder_chart_nucleus_g_text1')
                                .attr('y', 1)
                                .attr('fill', 'rgba(0, 0, 0, 0.95)')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', this.vars.config_fontMd)
                                .attr('text-anchor', 'middle')
                                .attr('dominant-baseline', 'middle');
                            this.vars.el_nucleusG.append('text')
                                .attr('class', 'viewfinder_nucleus_g_text2')
                                .attr('x', this.vars.config_nucleusR / 2)
                                .attr('y', this.vars.config_nucleusR / 2)
                                .attr('fill', 'rgba(255, 255, 255, 0.95)')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', this.vars.config_fontSm)
                                .attr('font-style', 'italic')
                                .attr('text-anchor', 'start')
                                .html(`Area, &micro;<tspan font-size=\'${this.vars.config_fontMd / 2}\' ` +
                                    `dx=\'1\' dy=\'-5\'>2</tspan>`);


                        },
                        wrangle: () => {

                            // Define cell
                            let cell = {};
                            if (this.data && this.data[0] && this.data[0].data) {
                                cell = this.data[0].data;
                            }

                            // Set image channels (whitelist)
                            if (this.vars.imageChannels.length === 0) {
                                this.vars.imageChannels = Utils.getImageChannels(this.data[0].data, this.imageViewer)
                            }

                            // Clear then update cell channels (value is average)
                            this.vars.cellChannels = [];
                            for (let k in cell) {
                                if (cell.hasOwnProperty(k) && this.vars.imageChannels.includes(k)) {

                                    const pMin = this.imageViewer.databaseDescription[k]['1%']
                                    const pMax = this.imageViewer.databaseDescription[k]['99%']

                                    this.vars.cellChannels.push({
                                        key: k,
                                        refMean: this.imageViewer.databaseDescription[k].mean,
                                        scale: d3.scaleLinear()
                                            .domain([pMin, pMax])
                                            .range([this.vars.config_chartR0, this.vars.config_chartR1]),
                                        short: this.data_layer.getShortChannelName(k),
                                        value: this.data
                                            ? this.data.map(d => d.data[k]).reduce((acc, cur) => acc + cur) /
                                            this.data.length
                                            : pMin
                                    });
                                }
                            }
                            this.vars.cellChannels.sort((a, b) => {
                                if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
                                if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
                                return 0;
                            });
                            this.vars.cellChannels.forEach((d, i) => {
                                // Add index
                                d.index = i;
                            });

                            // Config
                            this.vars.tool_angleScale.domain([0, this.vars.cellChannels.length]);
                            this.vars.tool_channelScale.domain([0, this.vars.cellChannels.length]);
                            this.vars.tool_nucleusScale.range([7, this.vars.config_nucleusR])
                            this.vars.tool_rCellScale.domain([this.imageViewer.viewer.viewport.getMinZoom(),
                                this.imageViewer.viewer.viewport.getMaxZoom()]);

                        },
                        render: () => {

                            // Define this
                            const vis = this;

                            // Define cell, channels
                            let cell = {};
                            if (this.data && this.data[0] && this.data[0].data) {
                                cell = this.data[0].data;
                            }

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

                            /*
                            aux func :: getCoordsTranslation
                             */
                            function getCoordsTranslation(r, pos) {
                                const x = Math.round(r * Math.sin(vis.vars.tool_channelScale(pos)));
                                const y = Math.round(r * Math.cos(vis.vars.tool_channelScale(pos)));
                                return [x, y];
                            }

                            // Draw lines / labels
                            this.vars.el_chartLabelsG.selectAll('.viewfinder_chart_label_g_g')
                                .data(this.vars.cellChannels, d => d.key)
                                .join(
                                    enter => enter
                                        .append('g')
                                        .attr('class', 'viewfinder_chart_label_g_g')
                                        .each(function (d, i) {

                                            // Get g
                                            const g = d3.select(this);

                                            // Coords
                                            const coords = [
                                                getCoordsTranslation(vis.vars.config_chartR0, i),
                                                getCoordsTranslation(vis.vars.config_chartR1, i)
                                            ];

                                            // Line
                                            const labelLine = g.append('path')
                                                .attr('class', 'labelLine')
                                                .attr('stroke', 'rgba(255, 255, 255, 1)')
                                                .attr('stroke-width', 0.5);
                                            labelLine.transition()
                                                .attr('d', d3.line()(coords));

                                            // Label group
                                            const textCoords = getCoordsTranslation(vis.vars.config_chartR1 + 5, i)
                                            const angle = vis.vars.tool_angleScale(i);
                                            g.append('g')
                                                .attr('class', 'viewfinder_chart_label_g_g_text_g')
                                                .style('transform',
                                                    `translate(${textCoords[0]}px, ${textCoords[1]}px)`)
                                                .append('text')
                                                .attr('fill', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) {
                                                        return 'rgba(255, 255, 255, 1)';
                                                    }
                                                    return 'rgba(255, 255, 255, 0.75)';
                                                })
                                                .attr('font', 'sans-serif')
                                                .attr('font-size', vis.vars.config_fontSm)
                                                .attr('font-weight', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) return 'bold';
                                                    return 'normal';
                                                })
                                                .attr('text-anchor', () => {
                                                    if (angle >= Math.PI) return `end`;
                                                    return `start`;
                                                })
                                                .attr('dominant-baseline', 'middle')
                                                .style('transform', () => {
                                                    if (angle >= Math.PI) return `rotate(${angle + Math.PI / 2}rad)`;
                                                    return `rotate(${angle - Math.PI / 2}rad)`;
                                                })
                                                .text(d => {
                                                    if (d.short.length <= 4) return d.short;
                                                    return d.short;
                                                });

                                            // Label group
                                            const channelCoords =
                                                getCoordsTranslation(vis.vars.config_chartR1, i + 0.05)
                                            g.append('circle')
                                                .attr('class', 'viewfinder_chart_label_g_g_circle')
                                                .attr('r', vis.vars.config_channelR)
                                                .attr('cx', channelCoords[0])
                                                .attr('cy', channelCoords[1])
                                                .attr('fill', Utils.getChannelColor(d.short, d.value, vis.imageViewer,
                                                    vis.channel_list))
                                                .attr('stroke', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) {
                                                        return 'rgba(255, 255, 255, 1)';
                                                    }
                                                    return 'rgba(255, 255, 255, 0)';
                                                })
                                                .attr('stroke-width', 0.5);
                                        }),
                                    update => update
                                        .each(function (d, i) {

                                            // Get g
                                            const g = d3.select(this);

                                            // Label groups
                                            g.select('.viewfinder_chart_label_g_g_text_g text')
                                                .attr('class', 'viewfinder_chart_label_g_g_text_g')
                                                .attr('fill', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) {
                                                        return 'rgba(255, 255, 255, 1)';
                                                    }
                                                    return 'rgba(255, 255, 255, 0.75)';
                                                })
                                                .attr('font-weight', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) return 'bold';
                                                    return 'normal';
                                                });

                                            // Label group
                                            g.select('.viewfinder_chart_label_g_g_circle')
                                                .attr('fill', Utils.getChannelColor(d.short, d.value, vis.imageViewer,
                                                    vis.channel_list))
                                                .attr('stroke', () => {
                                                    if (vis.channel_list.selections.includes(d.short)) {
                                                        return 'rgba(255, 255, 255, 1)';
                                                    }
                                                    return 'rgba(255, 255, 255, 0)';
                                                });

                                        }),
                                    exit => exit
                                );

                            // Draw path
                            this.vars.el_chartAreaPath
                                .datum(this.vars.cellChannels)
                                .transition()
                                .attr('d', d => this.vars.tool_areaMaker(d));

                            // Draw path
                            this.vars.el_chartAreaPathRef1
                                .datum(this.vars.cellChannels)
                                .transition()
                                .attr('d', d => this.vars.tool_areaMakerRef1(d));
                            this.vars.el_chartAreaPathRef2
                                .datum(this.vars.cellChannels)
                                .transition()
                                .attr('d', d => this.vars.tool_areaMakerRef2(d));

                            // Update nucleus area report
                            this.vars.el_nucleusG
                                .datum(cell)
                                .each(function (d) {
                                    // Define this
                                    const g = d3.select(this);

                                    // Set image channels (whitelist)
                                    if (vis.vars.areaTerm === '') {
                                        vis.vars.areaTerm = Utils.getAreaTerm(d);
                                    }

                                    // Update
                                    g.select('circle')
                                        .transition()
                                        .attr('r', () => {
                                            if (d.hasOwnProperty(vis.vars.areaTerm)) {
                                                return vis.vars.tool_nucleusScale(d[vis.vars.areaTerm]);
                                            }
                                            return vis.vars.tool_nucleusScale(0);
                                        });
                                    g.select('.viewfinder_chart_nucleus_g_text1')
                                        .text(() => {
                                            if (d.hasOwnProperty(vis.vars.areaTerm)) {
                                                return Math.round(d[vis.vars.areaTerm])
                                            }
                                            return '';
                                        });
                                });

                            // Update cell count
                            this.vars.el_textReportG.select('.viewfinder_text_report_text2')
                                .text(() => {
                                    if (this.data.length > 0) return `Cell count: ${this.data.length}`;
                                    return '';
                                })

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