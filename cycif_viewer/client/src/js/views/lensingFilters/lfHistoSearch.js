/**
 * @class LfHistosnap
 */
export class LfHistoSearch {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        config_boxW: 300,
        config_boxH: 80,
        config_boxMargin: {top: 8, right: 6, bottom: 7, left: 6},
        config_fontSm: 9,
        config_fontMd: 11,
        el_boxExtG: null,
        el_radialExtG: null,
        el_textReportG: null,
        el_toggleNoteG: null,
        keydown: e => {
            const lensing = this.image_viewer.viewer.lensing;
            if (!lensing.configs.sensitivity){
                lensing.configs.sensitivity = 0.05;
            }
            if (e.key === 'j'){
                lensing.configs.sensitivity = Math.min(lensing.configs.sensitivity+0.005,1);
                console.log('increased sensitivity to: ' + lensing.configs.sensitivity);
            }
            if (e.key === 'k'){
                lensing.configs.sensitivity =  Math.max(lensing.configs.sensitivity-0.005, 0);
                console.log('decreased sensitivity to: ' + lensing.configs.sensitivity);
            }
            if (e.key === 'H') {

                // Access auxi viewer manager (lensing instance) //lenses was not updated correctly
                const mainManager = this.image_viewer.viewerManagerVMain;
                const channels = [];
                for (let k in mainManager.viewerChannels) {
                    channels.push(mainManager.viewerChannels[k].name);
                }

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

                //create a server query to retrieve contours of areas in the image similar to the current lens area

                const bounds = this.image_viewer.viewer.viewport.getBounds(true);
                const imageItem = this.image_viewer.viewer.viewport.viewer.world.getItemAt(0);
                const topLeft = imageItem.viewportToImageCoordinates(bounds.getTopLeft());
                const bottomRight = imageItem.viewportToImageCoordinates(bounds.getBottomRight());
                const viewportBounds = [topLeft, bottomRight];
                //convert from osd to zarr (but when we are zoomed in further than 0 (negative value), we jump back to 0
                const zoomlevel = Math.max(0,this.image_viewer.config.maxLevel - this.image_viewer.viewer.viewport.getZoom());

                this.data_layer.getHistogramComparison(datasource, channels, pos[0], pos[1], newRad,
                    viewportBounds, zoomlevel, lensing.configs.sensitivity).then(d => {
                    console.log(d)
                    this.data = d;

                    var vis = this;
                    if (this.data != null && vis.data.contours != null) {

                        vis.data.contours.forEach(function(d,i){
                            d.forEach(function(e,j){
                               let point = imageItem.imageToViewportCoordinates(Math.floor(e[0]), Math.floor(e[1]));
                               vis.data.contours[i][j] = [point.x, point.y];
                            })
                        })
                        console.log(vis.data.contours[0]);
                    }
                    //[
                    //     var selPoly = d3.select(this.image_viewer.viewer.svg).selectAll("selectionPolygon").data(vis.data.contours[0]);
                        // selPoly.enter().append("polygon")
                        //     .style('fill', '#f00')
                        //     .attr('id', 'selectionPolygon')
                        //     .attr("points",function(d) {
                        //         return d.map(function(d) { return [d[0],d[1]].join(","); }).join(" ");})
                        //     .attr("stroke","orange")
                        //     .attr("stroke-width",2);



                        d3.select(this.image_viewer.viewer.svg).selectAll("*").remove();
                        var selPoly = d3.select(this.image_viewer.viewer.svg).selectAll("polygon")
                            .data(vis.data.contours)
                          .enter().append("polygon")
                            .attr("points",function(d) {
                                return d.map(function(d) { return [d[1],d[0]].join(","); }).join(" ");})
                            .attr("stroke","orange")
                            .attr("stroke-width",0.0002)
                        .attr("fill", "none");

                        // var d3Rect = d3.select(this.image_viewer.viewer.svg).append("rect")
                        //         .style('fill', '#f00')
                        //         .attr("x", 0.1)
                        //         .attr("width", 0.025)
                        //         .attr("y", 0.5)
                        //         .attr("height", 0.025);


                });
            }
            // Trigger update
            lensing.viewfinder.setup.wrangle()
            lensing.viewfinder.setup.render();
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
                    name: 'fil_data_histosnap',
                    vis_name: 'Data Histosnap',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_histosnap',
                        iter: 'px'
                    },
                    set_pixel: () => {

                        // Lensing ref
                        const lensing = this.image_viewer.viewer.lensing;

                        // Trigger update
                        lensing.viewfinder.setup.wrangle()
                        lensing.viewfinder.setup.render();

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
                        name: 'vis_data_histosnap',
                        init: () => {

                            // Define this
                            const vf = this.image_viewer.viewer.lensing.viewfinder;

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

                            // Append textReportG
                            this.vars.el_textReportG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_text_report_g');
                            this.vars.el_textReportG.append('text')
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
                                .text('HistoSearch')

                            this.vars.el_toggleNoteG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_toggle_note_g')
                                .style('transform', `translate(${this.vars.config_boxW
                                - this.vars.config_boxMargin.right}px, ${this.vars.config_boxMargin.top * 3}px)`);
                            this.vars.el_toggleNoteG.append('text')
                                .attr('class', 'viewfinder_toggle_note_g_char')
                                .attr('x', -10)
                                .attr('y', -3)
                                .attr('text-anchor', 'end')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', 14)
                                .attr('font-weight', 'lighter')
                                .html('&#9740;');
                            this.vars.el_toggleNoteG.append('text')
                                .attr('class', 'viewfinder_toggle_note_g_char')
                                .attr('x', -25)
                                .attr('y', 2)
                                .attr('text-anchor', 'end')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'rgba(255, 255, 255, 0.9)')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', 8)
                                .attr('font-style', 'italic')
                                .attr('font-weight', 'lighter')
                                .html('Countours: SHIFT H -- Increase: j -- Decrease: k');

                            // Add listener
                            this.vars.keydown = this.vars.keydown.bind(this)
                            document.addEventListener('keydown', this.vars.keydown);


                        },
                        wrangle: () => {

                            // Define this
                            const vis = this;


                            //set sensitivity to 0.5
                            if (!vis.image_viewer.viewer.lensing.configs.sensitivity){
                                vis.image_viewer.viewer.lensing.configs.sensitivity = 0.5;
                            }

                            vis.pies = d3.pie()
                                .value( d => d)
                                .sort(null)
                                .startAngle(0 * Math.PI)
	                            .endAngle(0.6 * Math.PI);

                            vis.colors = ["#000000", '#ffffff'];

                            const sens = 1-vis.image_viewer.viewer.lensing.configs.sensitivity;
                            vis.threshold = [100-sens*100, sens*100]
                            vis.ticks = [100-(sens*100), 0, 10,20,30,40,50,60,70,80,90,100]

                            vis.arc = d3.arc()
                                .outerRadius(vis.image_viewer.viewer.lensing.configs.rad + 12)
                                .innerRadius(vis.image_viewer.viewer.lensing.configs.rad + 3)
                        },
                        render: () => {
                            //console.log('render');
                            // // Define this
                            const vis = this;
                            const vf = this.image_viewer.viewer.lensing.viewfinder
                            const f = d3.format(",")

                            vis.vars.el_radialExtG.selectAll("path").remove();

                            this.vars.el_radialExtG.selectAll("path")
                                .data(vis.pies(vis.threshold))
                                .enter()
                                .append("path")
                                .attr("fill", (d, i) => vis.colors[i])
                                .attr("fill-opacity","0.5")
                                .attr("d", vis.arc)

                            this.vars.el_radialExtG.selectAll("line").remove();

                            this.vars.el_radialExtG.selectAll("line")
                                .data(vis.ticks)
                                .enter().append("line")
                                .attr("x2", 0)
                                .attr("y1", function(d,i){
                                    if (i==0){return vis.image_viewer.viewer.lensing.configs.rad + 20+10;}
                                    return vis.image_viewer.viewer.lensing.configs.rad + 20+4;
                                })
                                .attr("stroke-width", function(d,i){
                                    if (i==0){return 5;}
                                    return 1;
                                })
                                .attr("y2", vis.image_viewer.viewer.lensing.configs.rad + 20-2)
                                .attr("stroke", "white")
                                .attr("stroke-opacity","0.75")
                                .attr("transform", function(d) {
                                  return "rotate(" + (d + 270 * Math.PI+0.6 * Math.PI/2 * (180/Math.PI)) + ")" });

                                // Labels erzeugen und positioneren
                            this.vars.el_radialExtG.selectAll("text").remove();
                            this.vars.el_radialExtG.selectAll("text").data(vis.ticks).enter().append("text")
                                .attr("class", "value")
                                .attr("transform", function(d,i) {
                                    let margin = 30
                                    if (i==0){margin=45}
                                return "translate(" + ((vis.image_viewer.viewer.lensing.configs.rad+margin)*Math.cos((d-90)*2*Math.PI/365)) +
                                               "," + ((vis.image_viewer.viewer.lensing.configs.rad+margin)*Math.sin((d-90)*2*Math.PI/365)) + ")" +
                                               "rotate(" + ((d-90)*360/365) + ")";
                                    })

                                .attr("text-anchor", "left")
                                .style("font-size", function(d,i){
                                    if (i==0){return "10px"}
                                    return "6px"
                                })
                                .style('fill', 'white')
                                .text(function(d){
                                  return f(d);
                                });
                            // console.log("zoom level:" +this.image_viewer.viewer.viewport.getZoom());

                            // Update vf box size
                            vf.els.blackboardRect.attr('height', this.vars.config_boxH);
                            vf.configs.boxH = this.vars.config_boxH;

                        },
                        destroy: () => {

                            // Remove handler
                            document.removeEventListener('keydown', this.vars.keydown);

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