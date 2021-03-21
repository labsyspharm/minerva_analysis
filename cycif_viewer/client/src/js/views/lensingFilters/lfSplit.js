import {Utils} from './utils'

/**
 * @class LfSplit
 */
export class LfSplit {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        cellIntensityRange: [0, 65536],
        config_boxW: 300,
        config_boxH: 40,
        config_colorR: 8,
        config_channelExtH: 30,
        config_boxMargin: {top: 7, right: 6, bottom: 7, left: 6},
        config_chartsMargin: {top: 10, right: 30, bottom: 10, left: 30},
        currentChannel: {
            name: '',
            index: 0
        },
        config_fontSm: 9,
        config_fontMd: 11,
        el_boxExtG: null,
        el_cellsG: null,
        el_chartsG: null,
        el_lensContainer: null,
        el_radialExtG: null,
        el_textReportG: null,
        el_viewfinderBoxG: null,
        el_viewfinderDiv: null,
        forceUpdate: false,
        mmOptions: [
            {
                name: 'hande',
                channels: ['HE_r', 'HE_g', 'HE_b'],
                colors: ['255,0,0,1', '0,255,0,1', '0,0,255,1'],
                displayName: 'H&E',
                loaded: false,
                present: false
            }
        ],
        mmSelected: '',
        keydown: e => {
            if (e.key === 'C') {

                // Access auxi viewer manager (lensing instance)
                const mainManager = this.image_viewer.viewerManagerVMain;
                const auxiManager = this.image_viewer.viewerManagerVAuxi;

                // Get keys
                const keys = Object.keys(mainManager.viewerChannels);
                keys.forEach((k, i) => {
                    if (+k === this.vars.currentChannel.index) {
                        if (i < keys.length - 1) {
                            this.vars.currentChannel.name = mainManager.viewerChannels[keys[i + 1]].short_name;
                        } else {
                            this.vars.currentChannel.name = mainManager.viewerChannels[keys[0]].short_name;
                        }
                        this.vars.forceUpdate = true;
                    }
                });
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
                    name: 'fil_data_split',
                    vis_name: 'Data Split',
                    settings: {
                        active: 1,
                        async: true,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_split',
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
                        name: 'vis_data_split',
                        init: () => {

                            // Define this
                            const vf = this.image_viewer.viewer.lensing.viewfinder;

                            // Add extensions (to later remove)
                            this.vars.el_radialExtG = vf.els.radialG.append('g')
                                .attr('class', 'viewfinder_radial_ext_g');
                            this.vars.el_boxExtG = vf.els.boxG.append('g')
                                .attr('class', 'viewfinder_box_ext_g');

                            // Add faux lens
                            this.vars.el_radialExtG.append('circle')
                                .attr('fill', 'none')
                                .attr('stroke', 'white')

                            // Get lens and viewfinder wls
                            this.vars.el_lensContainer = d3.select('.overlay_container_lens');
                            this.vars.el_viewfinderBoxG = d3.select('.viewfinder_box_g');

                            // Add div (remove on destroy)
                            this.vars.el_viewfinderDiv = this.vars.el_lensContainer.append('div')
                                .style('position', 'absolute')
                                .style('transform', 'translate3d(0, 0, 0,)');
                            this.vars.el_viewfinderDiv.append('canvas');

                            // Check channels to look for sets
                            this.vars.mmOptions.forEach(o => {
                                let includes = true;
                                o.channels.forEach(c => {
                                    if (!this.channel_list.columns.includes(c)) {
                                        includes = false
                                    }
                                });
                                if (includes) {
                                    this.vars.mmSelected = o.name;
                                    o.present = true;
                                }
                            });


                        },
                        wrangle: () => {

                            // Get selected mmOption
                            const selMM = this.vars.mmOptions.find(o => o.name === this.vars.mmSelected);

                            // Check current sels
                            const keys = Object.keys(this.image_viewer.viewerManagerVAuxi.viewerChannels);
                            if (selMM && (!selMM.loaded || keys.length > 3)) {
                                // Empty
                                const items = Object.keys(this.image_viewer.viewerManagerVMain.viewerChannels);
                                items.forEach(item => {
                                    this.image_viewer.viewerManagerVAuxi.channelRemove(+item);
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
                            const styleW = this.vars.el_lensContainer.select('canvas').style('width');
                            const styleH = this.vars.el_lensContainer.select('canvas').style('height');
                            const attrW = this.vars.el_lensContainer.select('canvas').attr('width');
                            const attrH = this.vars.el_lensContainer.select('canvas').attr('height');
                            vf.els.blackboardRect.attr('width', 0);
                            vf.els.blackboardRect.attr('height',0);
                            vf.configs.boxW = +styleW.replace('px', '');
                            vf.configs.boxH = +styleH.replace('px', '');

                            // Place a faux lens
                            this.vars.el_radialExtG.select('circle')
                                .attr('r', vf.configs.boxW / 2);

                            // Move viewfinderDiv (that holds lens)
                            const vfBoxGTransform = this.vars.el_viewfinderBoxG.style('transform')
                                .split('(')[1].split(')')[0].split(', ');
                            const vfBoxGLeft = +vfBoxGTransform[0].replace('px', '');
                            const vfBoxGTop = +vfBoxGTransform[1].replace('px', '');
                            const vfBoxGOffsetW = vf.configs.boxW / 2;
                            const vfBoxGOffsetH = vf.configs.boxH / 2;
                            this.vars.el_viewfinderDiv.style('left', `${vfBoxGLeft + vfBoxGOffsetW}px`);
                            this.vars.el_viewfinderDiv.style('top', `${vfBoxGTop + vfBoxGOffsetH}px`);

                            // Hide lens canvas (Fix on destroy)
                            const lensCanvas = this.vars.el_lensContainer.select('canvas');
                            lensCanvas.style('visibility', 'hidden');

                            // Size and draw new canvas
                            const vfCanvas = this.vars.el_viewfinderDiv.select('canvas');
                            vfCanvas.style('width', styleW);
                            vfCanvas.style('height', styleH);
                            vfCanvas.attr('width', attrW);
                            vfCanvas.attr('height', attrH);
                            const vfContext = vfCanvas.node().getContext('2d');
                            vfContext.drawImage(lensCanvas.node(), 0, 0);


                            // Update canvas
                            this.vars.el_viewfinderDiv.node()

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

                            // Return visibility
                            this.vars.el_lensContainer.select('canvas').style('visibility', 'visible');

                            // Remove
                            this.vars.el_viewfinderDiv.remove()
                            this.vars.el_radialExtG.remove();
                            this.vars.el_boxExtG.remove();
                        }
                    }
                },
            }
        }

    }
}