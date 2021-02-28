/**
 * @class LfSegmentationOutlines
 * Note - useful template implementation for viewfinder functionality without viewerfinder visibility
 */
export class LfSegmentationOutlines {

    // Class vars (and chart 'vars')
    data = [];
    load = [];
    vars = {
        active: false
    };

    /**
     * @constructor
     */
    constructor(_imageViewer) {
        this.imageViewer = _imageViewer;

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
                    name: 'fil_data_segmentation_outlines',
                    vis_name: 'Data Segmentation Outlines',
                    settings: {
                        active: 1,
                        async: false,
                        default: 1,
                        loading: false,
                        max: 1,
                        min: 0,
                        step: 1,
                        vf: true,
                        vf_setup: 'vis_data_segmentation_outlines',
                        iter: 'px'
                    },
                    set_pixel: () => {

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
                        name: 'vis_data_segmentation_outlines',
                        init: () => {

                            // Hide vf
                            const vf = this.imageViewer.viewer.lensing.viewfinder;
                            vf.els.svg.attr('opacity', 0);

                            // Mark filter as active
                            this.vars.active = true;

                            // Trigger channel list data request
                            dataLayer.getChannelCellIds(channelList.sel).then(channelCells => {

                                // Check if still active
                                if (this.vars.active) {

                                    // Show outlines
                                    this.imageViewer.viewerManagerVMain.show_sel = false;
                                    this.imageViewer.viewerManagerVAuxi.show_sel = true;

                                    // Add to selection
                                    dataLayer.addAllToCurrentSelection(channelCells);

                                    // Update selection in viewers
                                    this.imageViewer.updateSelection(dataLayer.getCurrentSelection(), true);
                                }

                            }).catch(err => console.log(err))

                        },
                        wrangle: () => {

                        },
                        render: () => {

                        },
                        destroy: () => {

                            // Show vf
                            const vf = this.imageViewer.viewer.lensing.viewfinder;
                            vf.els.svg.attr('opacity', 1);

                            // Mark as inactive
                            this.vars.active = false;

                            // Hide outlines
                            this.imageViewer.selection = new Map();
                            this.imageViewer.viewerManagerVMain.show_sel = true;
                            this.imageViewer.viewerManagerVAuxi.forceRepaint();

                        }
                    }
                },
            },
        };
    }
}