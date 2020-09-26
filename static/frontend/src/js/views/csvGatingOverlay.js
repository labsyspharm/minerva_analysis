/**
 * @class CsvGatingOverlay
 *
 */

export class CsvGatingOverlay {

    // Vars
    overlay = null;

    // Channels
    channels = [];

    // Configs
    configs = {
        radius: 50,
        px_ratio: 2
    }

    /**
     * @constructor
     *
     * @param _viewer
     */
    constructor(_viewer) {

        // Init vars
        this.viewer = _viewer;
        this.global_channel_list = channelList;
        this.global_gating_list = csv_gatingList;

        this.init();
    }

    /** 1.
     * @function init
     */
    init() {

        // Build overlay and attach event
        this.overlay = new OpenSeadragon.CanvasOverlayHd(this.viewer, {
            onRedraw: e => this.redraw(e)
        });

        // Add id
        this.overlay._canvasdiv.id = 'csvGatingOverlay';

        // Respond to channel list clicks
        this.add_linked_events();
    }

    /**
     * @function add_linked_events
     *
     * TODO - add in slider matching
     *
     * ref
     */
    add_linked_events() {

        // Add events to channel
        const channelListContent = document.querySelectorAll('.channel-list-content');
        const gatingListContent = document.querySelectorAll('.gating-list-content');

        // Attach
        const attach = (targets, matches, target_class, match_class, global) => {
            targets.forEach(cLC => {
                cLC.addEventListener('click', e => {

                    // Get channel name
                    const name = e.target.querySelector(`.${target_class}`).innerText;

                    // Find match el in gating list
                    const match = Array.from(matches).find(
                        gLC => gLC.querySelector(`.${match_class}`).innerText === name);

                    // Emulate click to trigger event in csvGatingList.js
                    if (match) {
                        const fakeEvent = {target: match};
                        const svgCol = match.querySelector('.col-svg-wrapper')
                        global.abstract_click(fakeEvent, svgCol);
                    }
                });
            });
        }
        attach(channelListContent, gatingListContent, 'channel-name', 'gating-name', this.global_gating_list);
        attach(gatingListContent, channelListContent, 'gating-name', 'channel-name', this.global_channel_list);

    }

    /**
     * @function channel_add
     *
     * ref
     */
    channel_add(ref) {
        this.channels.push(ref);
    }

    /**
     * @function redraw
     *
     * @param e
     */
    redraw(e) {

        // Get context
        const ctx = e.context;
        const w = this.overlay._containerWidth * this.configs.px_ratio;
        const h = this.overlay._containerHeight * this.configs.px_ratio;
        const r = this.configs.radius * this.configs.px_ratio

        // Place in
        requestAnimationFrame(() => {

            // Clear rect
            ctx.clearRect(0, 0, w, h);

            // Draw circles
            ctx.strokeStyle = `white`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
            ctx.stroke();


        });

    }


}
