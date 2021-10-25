/**
 * @class ViewerOverlay
 */
export class ViewerOverlay {

    // Class vars
    configs = {
        h: 0,
        w: 0
    }
    els = {
        viewerOverlayEl: null
    }

    /**
     * @constructor
     */
    constructor(_imageViewer) {
        this.imageViewer = _imageViewer;

        this.init();
    }

    /**
     * @function init
     *
     * @returns void
     */
    init() {

        // Add container div
        const osd = d3.select('#openseadragon').select('.openseadragon-canvas');
        this.viewerOverlayEl = osd.append('div')
            .attr('id', 'viewerOverlay')
            .style('position', 'absolute')
            .style('top', 0)
            .style('left', 0);

        // Add resize listenter
        const resizeObserver = new ResizeObserver(() => {

            // Update dims
            this.configs.w = osd.clientWidth;
            this.configs.h = osd.clientHeight;

        });
        resizeObserver.observe(osd.node());

    }

}