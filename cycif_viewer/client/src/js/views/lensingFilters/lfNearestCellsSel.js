import {Utils} from "./utils";

/**
 * @class LfNearestCellsSel
 */
export class LfNearestCellsSel {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        areaTerm: '',
        cellIntensityRange: [0, 65536],
        channelSelections: [],
        config_colorR: 4,
        config_boxW: 300,
        config_boxH: 50,
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_channelExtH: 50,
        config_chartsMargin: {top: 10, right: 30, bottom: 10, left: 30},
        config_fontSm: 9,
        config_fontMd: 11,
        config_rectPad: 0.25,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartsG: null,
        el_radialExtG: null,
        el_textReportG: null,
        histRange: [],
        tickCt: 25,
        tool_rCellScale: d3.scalePow()
            .exponent(0.5)
            .range([0.5, 10]),
        tool_scX: d3.scaleLinear(),
        tool_scY: d3.scaleLinear(),
        tool_normalScale: d3.scaleLinear()
            .domain([0, 1])
            .range([0, 65536]),
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
                    name: 'fil_data_nearest_cells',
                    vis_name: 'Data Nearest Cells',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_nearest_cells',
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
                                if (pos[0] !== lensing.positionData.posFull[0] &&
                                    pos[1] !== lensing.positionData.posFull[1]) {
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
                        name: 'vis_data_nearest_cells',
                        init: () => {

                            // Define this
                            const vf = this.imageViewer.viewer.lensing.viewfinder;

                            // Update viewfinder
                            vf.els.blackboardRect.attr('width', this.vars.config_boxW);
                            vf.configs.boxW = this.vars.config_boxW;

                            // Configurations
                            this.vars.tool_scX.range([0, this.vars.config_boxW - (this.vars.config_chartsMargin.right
                                + this.vars.config_chartsMargin.left)])
                                .domain(this.vars.cellIntensityRange);
                            this.vars.tool_scY.range([0.5, this.vars.config_channelExtH -
                            (this.vars.config_chartsMargin.top + this.vars.config_chartsMargin.bottom)]);
                            this.vars.tool_rCellScale.domain([this.imageViewer.viewer.viewport.getMinZoom(),
                                this.imageViewer.viewer.viewport.getMaxZoom()]);

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
                                .text('Multiplex histograms (selections)');
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
                            this.vars.el_chartsG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_charts_g')
                                .style('transform', `translate(${this.vars.config_chartsMargin.left}px, 
                                    ${this.vars.config_chartsMargin.top}px)`);

                        },
                        wrangle: () => {

                            // Set image channels (whitelist)
                            this.vars.channelSelections = this.channel_list.selections;

                            // Set area term
                            if (this.vars.areaTerm === '') {
                                this.vars.areaTerm = Utils.getAreaTerm(this.data[0].data);
                            }

                            // TODO - nucleus ave
                            let aveNucleus = 0;

                            // Get range hist
                            this.vars.histRange = [];
                            if (this.data.length > 0) {
                                for (let k in this.data[0].data) {

                                    const short = this.data_layer.getShortChannelName(k);

                                    // Add channels
                                    if (this.data[0].data.hasOwnProperty(k) &&
                                        this.vars.channelSelections.includes(short)) {

                                        const pMin = this.imageViewer.databaseDescription[k]['1%'];
                                        const pMax = this.imageViewer.databaseDescription[k]['99%'];
                                        const histogram = this.imageViewer.databaseDescription[k]['histogram'];

                                        const map = this.data.map(c => {
                                            if (c.data[k] > pMin && c.data[k] < pMax) {
                                                return c.data[k]
                                            }
                                        });
                                        this.vars.histRange.push({
                                            histogram: histogram,
                                            histogramScaleY: d3.scaleLinear()
                                                .domain([0, d3.max(histogram, bin => bin.y)])
                                                // .domain([0, 1])
                                                .range([0.5, this.vars.config_channelExtH -
                                                (this.vars.config_chartsMargin.top +
                                                    this.vars.config_chartsMargin.bottom)]),
                                            key: k,
                                            scaleX: d3.scaleLinear()
                                                .domain([pMin, pMax])
                                                .range([0, this.vars.config_boxW - (this.vars.config_chartsMargin.right
                                                    + this.vars.config_chartsMargin.left)]),
                                            scaleY: d3.scaleLinear()
                                                .range([0.5, this.vars.config_channelExtH -
                                                (this.vars.config_chartsMargin.top +
                                                    this.vars.config_chartsMargin.bottom)]),
                                            short: short,
                                            values: map,
                                        });
                                    }

                                    // Update nucleus
                                    const nucArray = this.data.map(c => c.data.NucleusArea)
                                    const nucTotal = nucArray.reduce((acc, cur) => acc + cur);
                                    aveNucleus = nucTotal / nucArray.length;

                                }

                                // Histogram
                                this.vars.histRange.forEach(d => {

                                    const step = (d.scaleX.domain()[1] - d.scaleX.domain()[0]) / this.vars.tickCt;

                                    d.bins = d3.bin()
                                        .domain(d.scaleX.domain())
                                        .thresholds(d3.range(d.scaleX.domain()[0], d.scaleX.domain()[1], step))
                                        (d.values);
                                })

                                // Config
                                this.vars.histRange.forEach(d => {
                                    let max = 0;
                                    d.bins.forEach(b => {
                                        if (b.length > max) max = b.length;
                                    });
                                    d.scaleY.domain([0, max]);
                                });

                            }
                        },
                        render: () => {

                            // Define this
                            const vis = this;
                            const vf = this.imageViewer.viewer.lensing.viewfinder;

                            // Update vf box size
                            vf.els.blackboardRect.attr('width', this.vars.config_boxW);
                            vf.els.blackboardRect.attr('height', this.vars.config_boxH
                                + this.vars.channelSelections.length * this.vars.config_channelExtH);
                            vf.configs.boxH = this.vars.config_boxH + this.vars.channelSelections.length *
                                this.vars.config_channelExtH;

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
                            outer func :: joinLabel
                             */
                            function joinLabel(chart, bins) {

                                let labelG = chart.select('.viewfinder_charts_g_chart_g_label_g');
                                if (labelG.size() === 0) {
                                    labelG = chart.append('g')
                                        .attr('class', 'viewfinder_charts_g_chart_g_label_g')
                                        .style('transform',
                                            `translate(${-vis.vars.config_chartsMargin.left / 2}px, 
                                                        ${-vis.vars.config_chartsMargin.top / 2}px)`);

                                    // Append label
                                    labelG.append('circle')
                                        .attr('class', 'viewfinder_charts_g_chart_g_circle')
                                        .attr('r', vis.vars.config_colorR)
                                        .attr('cy', -vis.vars.config_colorR)
                                        .attr('stroke-width', 0.5);
                                    labelG.append('text')
                                        .attr('class', 'viewfinder_charts_g_chart_g_text')
                                        .attr('x', vis.vars.config_colorR * 2)
                                        .attr('fill', 'rgba(255, 255, 255, 0.95)')
                                        .attr('font-family', 'sans-serif')
                                        .attr('font-size', 9)
                                        .attr('text-anchor', 'start');
                                }
                                labelG.select('circle')
                                    .attr('fill', Utils.getChannelColor(bins.short,
                                        vis.vars.cellIntensityRange[1],
                                        vis.imageViewer, vis.channel_list))
                                    .attr('stroke', () => {
                                        if (vis.vars.channelSelections.includes(bins.short)) {
                                            return 'rgba(255, 255, 255, 1)';
                                        }
                                        return 'rgba(255, 255, 255, 0)';
                                    });
                                labelG.select('text')
                                    .text(bins.short);

                            }

                            /*
                            outer func :: nestedJoin
                             */
                            function nestedJoin(chart, bins) {

                                // Config
                                let w = bins.scaleX.range()[1] / vis.vars.tickCt;
                                const pad = w * vis.vars.config_rectPad;

                                // Build bars
                                chart.selectAll('.viewfinder_charts_g_chart_g_bin_g_bkgd')
                                    .data(bins.histogram)
                                    .join('rect')
                                    .transition()
                                    .attr('class', 'viewfinder_charts_g_chart_g_bin_g_bkgd')
                                    .attr('x', (d, i) => (w * i) + (pad / 2))
                                    .attr('y', d => {
                                        return (bins.histogramScaleY.range()[1] - bins.histogramScaleY(d.y)) / 2;
                                    })
                                    .attr('width', w - pad)
                                    .attr('height', d => bins.histogramScaleY(d.y))
                                    .attr('fill', d => {
                                        if (d.y > 0) return 'rgba(255, 160, 0, 0.5)';
                                        return 'rgba(255, 160, 0, 0.25)';
                                    });

                                // Build bars
                                chart.selectAll('.viewfinder_charts_g_chart_g_bin_g')
                                    .data(bins.bins)
                                    .join('rect')
                                    .transition()
                                    .attr('class', 'viewfinder_charts_g_chart_g_bin_g')
                                    .attr('x', (d, i) => w * i + pad)
                                    .attr('y', d => {
                                        return (bins.scaleY.range()[1] - bins.scaleY(d.length)) / 2;
                                    })
                                    .attr('width', w - pad * 2)
                                    .attr('height', d => bins.scaleY(d.length))
                                    .attr('fill', d => {
                                        if (d.length > 0) return 'rgba(255, 255, 255, 1)';
                                        return 'rgba(255, 255, 255, 0.5)';
                                    });
                            }

                            // Append chart for each channel
                            this.vars.el_chartsG.selectAll('.viewfinder_charts_g_chart_g')
                                .data(vis.vars.channelSelections)
                                .join(
                                    enter => enter
                                        .append('g')
                                        .attr('class', 'viewfinder_charts_g_chart_g')
                                        .each(function (d, i) {
                                            const g = d3.select(this)
                                                .style('transform', `translateY(${i * vis.vars.config_channelExtH +
                                                vis.vars.config_boxH}px)`);

                                            // Find histogram
                                            const bins = vis.vars.histRange.find(h => d === h.short);
                                            if (bins) {

                                                // Join label
                                                joinLabel(g, bins)

                                                // Join bins
                                                nestedJoin(g, bins);
                                            }

                                        }),
                                    update => update
                                        .each(function (d, i) {
                                            const g = d3.select(this)
                                                .style('transform', `translateY(${i * vis.vars.config_channelExtH +
                                                vis.vars.config_boxH}px)`);

                                            // Find histogram
                                            const bins = vis.vars.histRange.find(h => d === h.short);
                                            if (bins) {

                                                // Join label
                                                joinLabel(g, bins)

                                                // Join bins
                                                nestedJoin(g, bins);
                                            }

                                        }),
                                    exit => exit.remove()
                                );

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