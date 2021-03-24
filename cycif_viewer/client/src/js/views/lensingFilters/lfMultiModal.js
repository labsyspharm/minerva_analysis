import {Utils} from './utils'

/**
 * @class LfMultiModal
 */
export class LfMultiModal {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        cellIntensityRange: [0, 65536],
        config_boxW: 350,
        config_boxH: 40,
        config_colorR: 8,
        config_channelExtH: 20,
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_chartsMargin: {top: 10, right: 30, bottom: 10, left: 30},
        currentOption: {
            name: '',
            index: 0
        },
        config_fontSm: 9,
        config_fontMd: 11,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartsG: null,
        el_radialExtG: null,
        el_textReportG: null,
        el_toggleNoteG: null,
        forceUpdate: false,
        mmOptions: [
            {
                name: 'hande',
                channels: ['HE_r', 'HE_g', 'HE_b'],
                colors: ['255,0,0,1', '0,255,0,1', '0,0,255,1'],
                displayName: 'H&E',
                loaded: false,
                present: false
            },
            {
                name: 'bip',
                channels: ['CD45_PE', 'anti_CD3', 'CD20_488', 'CD163_488'],
                colors: ['255,255,255,1', '255,0,0,1', '0,255,0,1', '0,0,255,1'],
                displayName: 'Broad immune pop. (CD45-white, CD3-red, CD20-green, CD163-blue)',
                loaded: false,
                present: false
            },
            {
                name: 'bcl',
                channels: ['Keratin_570', 'aSMA_660', 'CD31_647', 'CD45_PE'],
                colors: ['255,255,255,1', '255,0,0,1', '0,255,0,1', '0,0,255,1'],
                displayName: 'Broad cell lin. (CD45-white, SMA-red, CD31-green, CD45-blue)',
                loaded: false,
                present: false
            },
        ],
        mmSelected: 'hande',
        keydown: e => {
            if (e.key === 'C') {

                // Access auxi viewer manager (lensing instance)
                const mainManager = this.image_viewer.viewerManagerVMain;
                const auxiManager = this.image_viewer.viewerManagerVAuxi;

                // Get index of currentSelected
                const idx = this.vars.mmOptions.findIndex(d => d.name === this.vars.mmSelected);
                let newIdx = idx === this.vars.mmOptions.length - 1 ? 0 : idx + 1;
                this.vars.mmSelected = this.vars.mmOptions[newIdx].name;
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
                    name: 'fil_data_multimodal',
                    vis_name: 'Data Multimodal',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_multimodal',
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
                        name: 'vis_data_multimodal',
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
                                .text('Multimodal options');

                            this.vars.el_toggleNoteG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_toggle_note_g')
                                .style('transform', `translate(${this.vars.config_boxW
                                - this.vars.config_boxMargin.right}px, ${this.vars.config_boxMargin.top * 3}px)`);
                            this.vars.el_toggleNoteG.append('text')
                                .attr('class', 'viewfinder_toggle_note_g_char')
                                .attr('x', 15)
                                .attr('y', 0)
                                .attr('text-anchor', 'end')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'white')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', 14)
                                .attr('font-weight', 'lighter')
                                .style('transform', 'rotate(90deg)')
                                .html('&#10234;');
                            this.vars.el_toggleNoteG.append('text')
                                .attr('class', 'viewfinder_toggle_note_g_char')
                                .attr('x', -15)
                                .attr('y', 2)
                                .attr('text-anchor', 'end')
                                .attr('dominant-baseline', 'hanging')
                                .attr('fill', 'rgba(255, 255, 255, 0.9)')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', 8)
                                .attr('font-style', 'italic')
                                .attr('font-weight', 'lighter')
                                .html('SHIFT C');


                            // Append chartG
                            this.vars.el_chartsG = this.vars.el_boxExtG.append('g')
                                .attr('class', 'viewfinder_charts_g')
                                .style('transform', `translate(${this.vars.config_chartsMargin.left}px, 
                                    ${this.vars.config_chartsMargin.top}px)`);

                            // Add listener
                            this.vars.keydown = this.vars.keydown.bind(this)
                            document.addEventListener('keydown', this.vars.keydown);

                            // Check channels to look for sets
                            this.vars.mmOptions.forEach(o => {
                                let includes = true;
                                o.channels.forEach(c => {
                                    if (!this.channel_list.columns.includes(c)) {
                                        includes = false
                                    }
                                });
                                if (includes) {
                                    o.present = true;
                                }
                            });


                        },
                        wrangle: () => {

                            // Get selected mmOption
                            const selMM = this.vars.mmOptions.find(o => o.name === this.vars.mmSelected);

                            // Check current sels
                            const keys = Object.keys(this.image_viewer.viewerManagerVAuxi.viewerChannels);
                            if (selMM && (!selMM.loaded)) {
                                // Empty
                                let items = Object.keys(this.image_viewer.viewerManagerVMain.viewerChannels);
                                keys.forEach(key => {
                                    this.image_viewer.viewerManagerVAuxi.channelRemove(+key);
                                })
                                // Loads
                                selMM.channels.forEach((c, i) => {

                                    // Push new colors
                                    // const channelTF = this.image_viewer.channelTF.find(tf => tf.name === c);
                                    const rgba = selMM.colors[i].split(',');
                                    const d3rgba = d3.rgb(+rgba[0], +rgba[1], +rgba[2], +rgba[3]);
                                    this.image_viewer.viewerManagerVAuxi.updateChannelColor(c, d3rgba);

                                    // Add channels
                                    const index = Utils.getChannelIndex(c, this.image_viewer);
                                    this.image_viewer.viewerManagerVAuxi.channelAdd(index);
                                });
                                // Mark as loaded
                                selMM.loaded = true;
                            }


                        },
                        render: () => {

                            // Define this
                            const vis = this;
                            const vf = this.image_viewer.viewer.lensing.viewfinder;

                            // Get channels
                            const channels = this.channel_list.selections;

                            // Update vf box size
                            vf.els.blackboardRect.attr('height', this.vars.config_boxH + (this.vars.mmOptions.length + 1)
                                * this.vars.config_channelExtH);
                            vf.configs.boxH = this.vars.config_boxH + this.vars.mmOptions.length *
                                this.vars.config_channelExtH;


                            this.vars.el_chartsG.selectAll('.viewfinder_charts_g_chart_g')
                                .data(this.vars.mmOptions)
                                .join('text')
                                .attr('class', 'viewfinder_charts_g_chart_g')
                                .attr('x', 0)
                                .attr('y', (d, i) => i * vis.vars.config_channelExtH + vis.vars.config_boxH)
                                .attr('fill', 'rgba(255, 255, 255, 0.95)')
                                .attr('font-family', 'sans-serif')
                                .attr('font-size', this.vars.config_fontSm)
                                .attr('text-anchor', 'start')
                                .attr('dominant-baseline', 'middle')
                                .attr('opacity', d => {
                                    if (d.name === vis.vars.mmSelected) {
                                        return 1;
                                    }
                                    return 0.75;
                                })
                                .text(d => d.displayName);


                        },
                        destroy: () => {

                            // Remove handler
                            document.removeEventListener('keydown', this.vars.keydown);

                            // Clear prev channels and reload from main
                            const itemsAuxi = Object.keys(this.image_viewer.viewerManagerVAuxi.viewerChannels);
                            itemsAuxi.forEach(item => {
                                this.image_viewer.viewerManagerVAuxi.channelRemove(+item);
                            });
                            const itemsMain = Object.keys(this.image_viewer.viewerManagerVMain.viewerChannels);
                            itemsMain.forEach(item => {

                                // Color from main
                                if (this.image_viewer.viewerManagerVMain.colorConnector[`${item}`]) {
                                    this.image_viewer.viewerManagerVAuxi.colorConnector[`${item}`] = {
                                        color: this.image_viewer.viewerManagerVMain.colorConnector[`${item}`].color
                                    }
                                }

                                // Add channel
                                this.image_viewer.viewerManagerVAuxi.channelAdd(+item);

                            });

                            // Mark all as not loaded
                            const selMM = this.vars.mmOptions.find(o => o.name === this.vars.mmSelected);
                            if (selMM !== null && selMM !== undefined) {
                                selMM.loaded = false;
                            }


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