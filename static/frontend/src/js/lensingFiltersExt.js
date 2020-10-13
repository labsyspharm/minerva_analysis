/**
 * @class LensingFiltersExt
 */
export class LensingFiltersExt {

    /**
     * @function getFilters
     *
     * @param _imageViewer
     * @returns array
     */
    static getFilters(_imageViewer) {

        const imageViewer = _imageViewer;

        /////////////////////////////////////////////////////////////////////////////////////// Data load 1 - rgb filter
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

        ///////////////////////////////////////////////////////////////////////////////////// Data load 2 - nearest cell
        const data_nearest_cell = [];
        const dataLoad2 = {
            data: data_nearest_cell,
            config: {
                type: 'object-single',
                filter: 'fil_data_custom',
                vf_ref: 'vis_data_custom',
                bridge: dataLayer.getNearestCell,
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
                    set_pixel: (px) => {
                        // Emulate lenses class setting
                        const vis = imageViewer.viewer.lensing.lenses;

                        if (!dataLoad2.config.filterCode.settings.loading) {

                            // Get position of cell and add to data
                            const pos = vis.lensing.configs.pos_full;

                            // Load
                            dataLoad2.config.filterCode.settings.loading = true;
                            dataLayer.getNearestCell(pos[0], pos[1]).then(d => {

                                // Loaded
                                dataLoad2.config.filterCode.settings.loading = false;

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

                                // Trigger update
                                vis.lensing.viewfinder.setup.wrangle()
                                vis.lensing.viewfinder.setup.render();

                            }).catch(err => console.log(err));

                        }

                    },
                    update: (i, index) => {
                        // Emulate lenses class setting
                        const vis = imageViewer.viewer.lensing.lenses;

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
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Vars
                            vis.data_cells = [];
                            vis.nest_range = [];
                            vis.active_channels = ['DNA'];

                            // Els
                            vis.els.cellsG = null
                            vis.els.textReportG = null
                            vis.els.areachartG = null;

                            // Configs
                            vis.configs.row_spacing = 16;
                            vis.configs.areachartW = 120;
                            vis.configs.areachartH = 20;
                            vis.configs.newBoxH = 80;

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
                            vis.els.blackboardRect.attr('height', vis.configs.newBoxH);

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
                                .attr('class', 'viewfinder_areachart_g')
                                .style('transform',
                                    `translate(${(vis.configs.boxW - vis.configs.areachartW) / 2}px, ${vis.configs.row_spacing * 2}px)`);
                            vis.els.areachartG.append('path')
                                .attr('class', 'viewfinder_areachart_path');

                        },
                        wrangle: () => {
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Get range nest
                            vis.nest_range = [];
                            if (vis.data_cells.length > 0) {

                                const blacklist = ['id', 'CellPosition_X', 'CellPosition_Y', 'NucleusArea', 'phenotype'];
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
                            const vis = imageViewer.viewer.lensing.viewfinder;

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
                                                .attr('stroke-width', 1.5);
                                            g.append('circle')
                                                .attr('r', 3)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'white')
                                                .attr('stroke-width', 0.5);
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
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Remove els
                            vis.els.cellsG.remove();
                            vis.els.textReportG.remove();
                            vis.els.areachartG.remove();
                        }
                    }
                },
            }
        }

        //////////////////////////////////////////////////////////////////////////////////// Data load 3 - nearest cells
        const data_nearest_cells = [];
        const dataLoad3 = {
            data: data_nearest_cells,
            config: {
                type: 'object-single',
                filter: 'fil_data_custom',
                vf_ref: 'vis_data_custom',
                bridge: dataLayer.getNeighborhood,
                filterCode: {
                    data: [],
                    name: 'fil_data_nearest_cells',
                    vis_name: 'Data Nearest Cells',
                    settings: {
                        active: 1,
                        async: true,
                        loading: false,
                        default: 1,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_nearest_cells',
                        iter: 'px'
                    },
                    set_pixel: () => {
                        // Emulate lenses class setting
                        const vis = imageViewer.viewer.lensing.lenses;
                        if (!dataLoad2.config.filterCode.settings.loading) {

                            // Measure relative
                            const screenPt1 = new vis.lensing.osd.Point(0, 0);
                            const screenPt2 = new vis.lensing.osd.Point(vis.lensing.configs.rad / vis.lensing.configs.pxRatio, 0);
                            const contextPt1 = imageViewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt1)
                            const contextPt2 = imageViewer.viewer.world.getItemAt(0).viewerElementToImageCoordinates(screenPt2)
                            let newRad =  Math.round(contextPt2.x - contextPt1.x)
                            if (newRad > 300) {
                                newRad = 300;
                            }

                            // Get position of cell and add to data
                            const pos = vis.lensing.configs.pos_full;

                            //
                            const start = performance.now()

                            // TODO - need to refactor radius to image size
                            dataLoad2.config.filterCode.settings.loading = true;
                            dataLayer.getNeighborhood(newRad, pos[0], pos[1]).then(arr => {
                                const stop = performance.now()
                                const time = stop - start;

                                // Loaded
                                dataLoad2.config.filterCode.settings.loading = false;

                                // Clear data to vis
                                vis.lensing.viewfinder.data_cells = [];

                                arr.forEach(d => {// // Calc offset
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
                                });

                                // Trigger update
                                vis.lensing.viewfinder.setup.wrangle()
                                vis.lensing.viewfinder.setup.render();

                            }).catch(err => console.log(err));
                        }

                    },
                    update: (i, index) => {
                        // Emulate lenses class setting
                        const vis = imageViewer.viewer.lensing.lenses;

                        // Magnify
                        vis.selections.magnifier.update(i, index);
                    },
                    fill: 'rgba(255, 255, 255, 0)',
                    stroke: 'rgba(0, 0, 0, 1)'
                },
                get_vf_setup: () => {
                    return {
                        name: 'vis_data_nearest_cells',
                        init: () => {
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Vars
                            vis.data_cells = [];
                            vis.hist_range = [];
                            vis.active_channels = ['DNA', 'S100'];

                            // Els
                            vis.els.cellsG = null
                            vis.els.textReportG = null
                            vis.els.areachartG = null;
                            vis.els.areachartAxisG = null
                            vis.els.areachartG2 = null;
                            vis.els.areachartAxisG2 = null

                            // Configs
                            vis.configs.row_spacing = 16;
                            vis.configs.areachartW = 120;
                            vis.configs.areachartH = 20;
                            vis.configs.newBoxH = 130;

                            // Tools
                            vis.tools.nestScX = d3.scaleLinear().range([0, vis.configs.areachartW])
                                .domain([0, 2 ** 16]);
                            vis.tools.nestScY = d3.scaleLinear().range([vis.configs.areachartH, 0]);
                            vis.tools.area = d3.area()
                                .x(d => vis.tools.nestScX(d.x0))
                                .y1(d => vis.tools.nestScY(d.length))
                                .y0(vis.configs.areachartH);

                            // Resize box g
                            vis.els.blackboardRect.attr('height', vis.configs.newBoxH);

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
                                .style('font-weight', 'lighter')
                                .text('Neighborhood view');

                            // Add area chart (histogram)
                            vis.els.areachartG = vis.els.boxG.append('g')
                                .attr('class', 'viewfinder_areachart_g')
                                .style('transform',
                                    `translate(${(vis.configs.boxW - vis.configs.areachartW) / 2}px, ${vis.configs.row_spacing * 2}px)`);
                            vis.els.areachartG.append('path')
                                .attr('class', 'viewfinder_areachart_path');
                            // TODO - make dynamic (hardcoded for demo)
                            vis.els.areachartG2 = vis.els.boxG.append('g')
                                .attr('class', 'viewfinder_areachart_g')
                                .style('transform',
                                    `translate(${(vis.configs.boxW - vis.configs.areachartW) / 2}px, 
                                    ${vis.configs.areachartH + vis.configs.row_spacing * 4}px)`);
                            vis.els.areachartG2.append('path')
                                .attr('class', 'viewfinder_areachart_path');

                            // Add area chart axis
                            vis.els.areachartAxisG = vis.els.areachartG.append('g')
                                .attr('class', 'viewfinder_areachart_axis_g')
                                .style('transform', `translateY(${vis.configs.areachartH + 2}px)`);
                            vis.els.areachartAxisG.append('text')
                                .attr('class', 'viewfinder_areachart_label')
                                .attr('x', -4)
                                .attr('y', -(vis.configs.areachartH + 2))
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'normal')
                                .attr('text-anchor', `start`)
                                .text('DNA');
                            vis.els.areachartAxisG.append('line')
                                .attr('class', 'viewfinder_areachart_axis_line viewfinder_areachart__axis_line_left')
                                .attr('x1', 0)
                                .attr('x2', 0)
                                .attr('y1', 0)
                                .attr('y2', 4)
                                .attr('stroke', 'white')
                                .attr('stroke-width', 0.5);
                            vis.els.areachartAxisG.append('line')
                                .attr('class', 'viewfinder_areachart_axis_line viewfinder_areachart_axis_line_right')
                                .attr('x1', vis.configs.areachartW)
                                .attr('x2', vis.configs.areachartW)
                                .attr('y1', 0)
                                .attr('y2', 3)
                                .attr('stroke', 'white')
                                .attr('stroke-width', 0.5);
                            vis.els.areachartAxisG.append('text')
                                .attr('class', 'viewfinder_areachart_axis_text viewfinder_areachart_axis_text_left')
                                .attr('x', 0)
                                .attr('y', 12)
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'lighter')
                                .attr('text-anchor', `middle`)
                                .text(0);
                            vis.els.areachartAxisG.append('text')
                                .attr('class', 'viewfinder_areachart_axis_text viewfinder_areachart_axis_text_right')
                                .attr('x', vis.configs.areachartW)
                                .attr('y', 12)
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'lighter')
                                .attr('text-anchor', `middle`)
                                .text(d3.format(',')(2 ** 16));
                            // TODO - make dynamic (hardcoded for demo)
                            vis.els.areachartAxisG2 = vis.els.areachartG2.append('g')
                                .attr('class', 'viewfinder_areachart_axis_g')
                                .style('transform', `translateY(${vis.configs.areachartH + 2}px)`);
                            vis.els.areachartAxisG2.append('text')
                                .attr('class', 'viewfinder_areachart_label')
                                .attr('x', -4)
                                .attr('y', -(vis.configs.areachartH + 2))
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'normal')
                                .attr('text-anchor', `start`)
                                .text('S100');
                            vis.els.areachartAxisG2.append('line')
                                .attr('class', 'viewfinder_areachart_axis_line viewfinder_areachart__axis_line_left')
                                .attr('x1', 0)
                                .attr('x2', 0)
                                .attr('y1', 0)
                                .attr('y2', 4)
                                .attr('stroke', 'white')
                                .attr('stroke-width', 0.5);
                            vis.els.areachartAxisG2.append('line')
                                .attr('class', 'viewfinder_areachart_axis_line viewfinder_areachart_axis_line_right')
                                .attr('x1', vis.configs.areachartW)
                                .attr('x2', vis.configs.areachartW)
                                .attr('y1', 0)
                                .attr('y2', 3)
                                .attr('stroke', 'white')
                                .attr('stroke-width', 0.5);
                            vis.els.areachartAxisG2.append('text')
                                .attr('class', 'viewfinder_areachart_axis_text viewfinder_areachart_axis_text_left')
                                .attr('x', 0)
                                .attr('y', 12)
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'lighter')
                                .attr('text-anchor', `middle`)
                                .text(0);
                            vis.els.areachartAxisG2.append('text')
                                .attr('class', 'viewfinder_areachart_axis_text viewfinder_areachart_axis_text_right')
                                .attr('x', vis.configs.areachartW)
                                .attr('y', 12)
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif;')
                                .attr('font-size', 8)
                                .attr('font-weight', 'lighter')
                                .attr('text-anchor', `middle`)
                                .text(d3.format(',')(2 ** 16));

                        },
                        wrangle: () => {
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Get range hist
                            vis.hist_range = [];
                            if (vis.data_cells.length > 0) {
                                let index = 0;
                                for (let d in vis.data_cells[0].data) {
                                    if (vis.active_channels.includes(d.split('_')[0])) {
                                        vis.hist_range.push({
                                            key: d,
                                            values: vis.data_cells.map(c => c.data[d])
                                        });
                                        index++;
                                    }
                                }

                                // Histogram
                                vis.hist_range.forEach(d => {
                                    d.bins = d3.histogram()
                                        .domain(vis.tools.nestScX.domain())
                                        .thresholds(vis.tools.nestScX.ticks(20))
                                        (d.values);
                                })

                                // Config
                                let max = 0;
                                vis.hist_range.forEach(d => {
                                    d.bins.forEach(b => {
                                        if (b.length > max) max = b.length;
                                    });
                                });
                                vis.tools.nestScY.domain([0, max]);


                            } else {

                            }

                        },
                        render: () => {
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Update cell count
                            vis.els.textReportG.select('text')
                                .text(`Neighborhood: ${vis.data_cells.length} cells`);

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
                                                .attr('stroke-width', 1.5);
                                            g.append('circle')
                                                .attr('r', 3)
                                                .attr('fill', 'none')
                                                .attr('stroke', 'white')
                                                .attr('stroke-width', 0.5);
                                        }),
                                    update => update
                                        .each(function (d) {
                                            const g = d3.select(this)
                                                .style(`transform`, `translate(${d.offset[0]}px, ${d.offset[1]}px)`);
                                        }),
                                    exit => exit.remove()
                                );

                            // // Update text
                            // const id = vis.data_cells.length > 0 ? vis.data_cells[0].data.id : 'None in range';
                            // vis.els.textReportG.select('.viewfinder_box_text_a')
                            //     .text(`Cell ID: ${id}`);

                            // Build area chart
                            if (vis.hist_range.length > 0) {
                                vis.els.areachartG.selectAll('.viewfinder_areachart_bin')
                                    .data(vis.hist_range[0].bins)
                                    .join(
                                        enter => enter.append('g')
                                            .attr('class', 'viewfinder_areachart_bin')
                                            .each(function (d, i) {
                                                const g = d3.select(this)
                                                    .style('transform',
                                                        `translate(${vis.configs.areachartW / 20 * i}px, ${vis.tools.nestScY(d.length)}px)`);
                                                g.append('rect')
                                                    .attr('width', vis.configs.areachartW / 20 - 2)
                                                    .attr('height', vis.configs.areachartH - vis.tools.nestScY(d.length))
                                                    .attr('fill', 'rgba(255, 255, 255, 1)')
                                            }),
                                        update => update
                                            .each(function (d, i) {
                                                const g = d3.select(this)
                                                    .style('transform',
                                                        `translate(${vis.configs.areachartW / 20 * i}px, ${vis.tools.nestScY(d.length)}px)`);
                                                g.select('rect')
                                                    .attr('width', vis.configs.areachartW / 20 - 2)
                                                    .attr('height', vis.configs.areachartH - vis.tools.nestScY(d.length))
                                                    .attr('fill', 'rgba(255, 255, 255, 1)')
                                            }),
                                        exit => exit.remove()
                                    )
                                // TODO - make dynamic (hardcoded for demo)
                                vis.els.areachartG2.selectAll('.viewfinder_areachart_bin')
                                    .data(vis.hist_range[1].bins)
                                    .join(
                                        enter => enter.append('g')
                                            .attr('class', 'viewfinder_areachart_bin')
                                            .each(function (d, i) {
                                                const g = d3.select(this)
                                                    .style('transform',
                                                        `translate(${vis.configs.areachartW / 20 * i}px, ${vis.tools.nestScY(d.length)}px)`);
                                                g.append('rect')
                                                    .attr('width', vis.configs.areachartW / 20 - 2)
                                                    .attr('height', vis.configs.areachartH - vis.tools.nestScY(d.length))
                                                    .attr('fill', 'rgba(255, 255, 255, 1)')
                                            }),
                                        update => update
                                            .each(function (d, i) {
                                                const g = d3.select(this)
                                                    .style('transform',
                                                        `translate(${vis.configs.areachartW / 20 * i}px, ${vis.tools.nestScY(d.length)}px)`);
                                                g.select('rect')
                                                    .attr('width', vis.configs.areachartW / 20 - 2)
                                                    .attr('height', vis.configs.areachartH - vis.tools.nestScY(d.length))
                                                    .attr('fill', 'rgba(255, 255, 255, 1)')
                                            }),
                                        exit => exit.remove()
                                    )
                            }

                            // // Add markers
                            // const channelArray = vis.nest_range.length > 0 ? vis.active_channels : [];
                            // vis.els.areachartG.selectAll('.viewfinder_areachart_markerG')
                            //     .data(channelArray, d => d)
                            //     .join(
                            //         enter => enter.append('g')
                            //             .attr('class', 'viewfinder_areachart_markerG')
                            //             .each(function (d) {
                            //                 const g = d3.select(this);
                            //                 const findChannel = vis.nest_range.find(c => d === c.key.split('_')[0]);
                            //                 const x = vis.tools.nestScX(d.index);
                            //                 g.style('transform', `translateX(${x}px)`);
                            //                 g.append('line')
                            //                     .attr('y1', vis.configs.areachartH + 3)
                            //                     .attr('y2', vis.configs.areachartH + 6)
                            //                     .attr('stroke', 'white');
                            //                 g.append('text')
                            //                     .attr('class', 'viewfinder_areachart_marker_text')
                            //                     .attr('y', vis.configs.areachartH + 15)
                            //                     .attr('fill', 'white')
                            //                     .attr('font-family', 'sans-serif;')
                            //                     .attr('font-size', 8)
                            //                     .attr('font-weight', 'lighter')
                            //                     .attr('text-anchor', `middle`)
                            //                     .text(d);
                            //             })
                            //     )

                        },
                        destroy: () => {
                            // Define this
                            const vis = imageViewer.viewer.lensing.viewfinder;

                            // Remove els
                            vis.els.cellsG.remove();
                            vis.els.textReportG.remove();
                            vis.els.areachartG.remove();
                            vis.els.areachartAxisG.remove();
                            vis.els.areachartG2.remove();
                            vis.els.areachartAxisG2.remove();
                        }
                    }
                },
            }
        }

        return [dataLoad1, dataLoad2, dataLoad3];

    }
}
