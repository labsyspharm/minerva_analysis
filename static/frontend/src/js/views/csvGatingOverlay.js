/**
 * @class CsvGatingOverlay
 *
 */

export class CsvGatingOverlay {

    // Vars
    image_size = null;
    force_update = false;
    overlay = null;
    rect = null;
    rect_frame = null;

    // Channels
    channels = {};

    // Configs
    configs = {
        radius: 50,
        px_ratio: 2,
        frame_padding: 0.5
    }

    /**
     * @constructor
     *
     * @param _viewer
     */
    constructor(_viewer, _imageViewer) {

        // Init vars
        this.viewer = _viewer;
        this.imageViewer = _imageViewer;
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

        // Add events
        this.add_events();

        // Respond to channel list clicks
        this.add_linked_events();
    }

    /**
     * @function add_events
     *
     * TODO - perhaps transfer overlay control to viewer events to reduce server reqs
     */
    add_events() {

        this.viewer.addHandler('animation-start', () => {
            this.animating = true;
        });
        this.viewer.addHandler('animation', () => {
            this.animating = true;
        });
        this.viewer.addHandler('animation-finish', () => {
            this.animating = false;
        });
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

                    // Check for name in channels
                    if (this.channels.hasOwnProperty(name)) {
                        delete this.channels[name];
                    } else {
                        // TODO - range should update dynamically
                        this.channels[name] = [0, 65536];
                    }

                    // Indicate a force update
                    this.force_update = true;
                });
            });
        }
        attach(channelListContent, gatingListContent, 'channel-name', 'gating-name',
            this.global_gating_list);
        attach(gatingListContent, channelListContent, 'gating-name', 'channel-name',
            this.global_channel_list);

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
     * @function image_size_check
     *
     */
    image_size_check() {

        // Get image bounds
        this.image_size = this.viewer.world.getItemAt(0).getContentSize();
    }

    /**
     * @function rect_frame_check
     *
     */
    rect_frame_check() {

        // Check for existence
        if (this.rect_frame) {

            // Check x
            if (this.rect.x >= this.rect_frame.x1 &&
                this.rect.x <= this.rect_frame.x2 &&
                this.rect.x + this.rect.width >= this.rect_frame.x3 &&
                this.rect.x + this.rect.width <= this.rect_frame.x4) {

                // Check y
                if (this.rect.y >= this.rect_frame.y1 &&
                    this.rect.y <= this.rect_frame.y2 &&
                    this.rect.y + this.rect.height >= this.rect_frame.y3 &&
                    this.rect.y + this.rect.height <= this.rect_frame.y4) {

                    // Inside
                    return true;

                }
            }
        }

        // Outside
        return false;
    }

    /**
     * @function rect_frame_make
     *
     */
    rect_frame_make() {

        // Calc padding
        const xPad = Math.abs(this.rect.x - this.rect.width * this.configs.frame_padding);
        const yPad = Math.abs(this.rect.y - this.rect.height * this.configs.frame_padding);

        // Return padding
        return {
            x1: this.rect.x - xPad < 0 ? 0 : this.rect.x - xPad,
            x2: this.rect.x,
            x3: this.rect.x + this.rect.width,
            x4: this.rect.x + this.rect.width + xPad > this.image_size.x
                ? this.image_size.x
                : this.rect.x + this.rect.width + xPad,
            y1: this.rect.y - yPad < 0 ? 0 : this.rect.y - yPad,
            y2: this.rect.y,
            y3: this.rect.y + this.rect.height,
            y4: this.rect.y + this.rect.height + yPad > this.image_size.y
                ? this.image_size.y
                : this.rect.y + this.rect.height + yPad,
        }
    }

    /**
     * @function redraw
     *
     * @param e
     */
    redraw(e) {

        // Check image bounds if does not exists
        if (!this.image_size) {
            this.image_size_check();
        }

        // Get context
        const ctx = e.context;
        const w = this.overlay._containerWidth * this.configs.px_ratio;
        const h = this.overlay._containerHeight * this.configs.px_ratio;
        const r = this.configs.radius * this.configs.px_ratio

        // Get image in viewport rect (pos and dims)
        const bounds = this.viewer.viewport.getBounds();
        this.rect = this.viewer.world.getItemAt(0).viewportToImageRectangle(
            bounds.x, bounds.y, bounds.width, bounds.height, true);

        // If outside of rect_frame
        const inside = this.rect_frame_check();
        if (!inside || this.force_update) {

            // Reset force update
            this.force_update = false;

            // Place ins
            requestAnimationFrame(() => {

                // Clear rect
                ctx.clearRect(0, 0, w, h);

                // Save rect (as prev)
                this.rect_frame = this.rect_frame_make();

                // Request channel cells
                this.request_ids().then(promise => {

                    // Wait for json
                    promise.json().then(d => {
                        console.log(d)

                        // Draw circles - placeholder
                        ctx.strokeStyle = `white`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
                        ctx.stroke();

                    }).catch(err => console.log(err));

                }).catch(err => console.log(err));

            });
        }

    }

    /**
     * @function request_ids
     *
     * @param rect
     */
    async request_ids() {

        // Rect vars
        let rect_vars = [this.rect.x, this.rect.y, this.rect.width, this.rect.height];
        let channel_vars = [];
        let range_min_vars = [];
        let range_max_vars = [];
        Object.entries(this.channels).forEach(c => {
            channel_vars.push(c[0]);
            range_min_vars.push(c[1][0]);
            range_max_vars.push(c[1][1]);
        })
        rect_vars = rect_vars.length === 0 ? null : rect_vars;
        channel_vars = channel_vars.length === 0 ? null : channel_vars;
        range_min_vars = range_min_vars.length === 0 ? null : range_min_vars;
        range_max_vars = range_max_vars.length === 0 ? null : range_max_vars;

        return fetch(`/get_rect_cells?` + new URLSearchParams({
            datasource: datasource,
            rect: rect_vars,
            channels: channel_vars
        }));
    }


}
