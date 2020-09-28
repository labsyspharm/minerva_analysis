/**
 * @class CsvGatingOverlay
 *
 */

export class CsvGatingOverlay {

    // Vars
    channels = {};
    data = [];
    data_requested = false;
    force_update = false;
    image_size = null;
    overlay = null;
    rect = null;
    rect_frame = null;

    // Tools
    coord_scale_x = d3.scaleLinear();
    coord_scale_y = d3.scaleLinear();

    // Configs
    configs = {
        radius: 3,
        px_ratio: 2,
        frame_padding: 0.25,
        rect_r_max: 1000
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
            onRedraw: e => this.evaluate(e)
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
                this.rect.x + this.rect.width <= this.rect_frame.x4) {

                // Check y
                if (this.rect.y >= this.rect_frame.y1 &&
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
        const xPad = Math.abs(this.rect.width * this.configs.frame_padding);
        const yPad = Math.abs(this.rect.height * this.configs.frame_padding);

        // Return padding
        const rect_frame = {
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

        // Get r (radius)
        rect_frame.width = rect_frame.x4 - rect_frame.x1;
        rect_frame.height = rect_frame.y4 - rect_frame.y1;
        const a = rect_frame.width / 2;
        const b = rect_frame.height / 2;
        rect_frame.r = Math.sqrt(a ** 2 + b ** 2);

        // Return
        return rect_frame;
    }

    /**
     * @function redraw
     *
     * @param e
     */
    evaluate(e) {

        // Check image bounds if does not exists
        if (!this.image_size) {
            this.image_size_check();
        }

        // Get context
        const ctx = e.context;

        // Get image in viewport rect (pos and dims)
        const bounds = this.viewer.viewport.getBounds();
        this.rect = this.viewer.world.getItemAt(0).viewportToImageRectangle(
            bounds.x, bounds.y, bounds.width, bounds.height, true);

        // If outside of rect_frame
        const inside = this.rect_frame_check();
        console.log('INSIDE?', inside)
        if (!inside || !this.data_requested || this.force_update) {
            console.log('Ding')

            // Reset force update
            this.force_update = false;

            // Save rect (as prev)
            this.rect_frame = this.rect_frame_make();

            // Only submit query if under radius max
            console.log('RF radius', this.rect_frame.r)
            if (this.rect_frame.r <= this.configs.rect_r_max) {
                console.log('Dong')

                // Request channel cells
                this.data_requested = true;
                this.request_ids().then(promise => {

                    // Wait for json
                    promise.json().then(d => {
                        this.data = d;

                        this.redraw(ctx)

                    }).catch(err => console.log(err));

                }).catch(err => console.log(err));

            }
        }

    }

    /**
     * @function redraw
     *
     * @param ctx
     *
     */
    redraw(ctx) {

        // Get dims
        const w = this.overlay._containerWidth * this.configs.px_ratio;
        const h = this.overlay._containerHeight * this.configs.px_ratio;
        const r = this.configs.radius * this.configs.px_ratio;

        // Update scale
        this.coord_scale_x.domain([this.rect.x, this.rect.x + this.rect.width]).range([0, w]);
        this.coord_scale_y.domain([this.rect.y, this.rect.y + this.rect.height]).range([0, h]);
        console.log(this.data)
        console.log(this.rect)

        // Clear rect
        requestAnimationFrame(() => {
            ctx.clearRect(0, 0, w, h);
        });

        //
        this.data.forEach(d => {
            if (d.hasOwnProperty('CellPosition_X') && d.hasOwnProperty('CellPosition_Y')) {
                if (d.CellPosition_X >= this.rect.x && d.CellPosition_X <= this.rect.x + this.rect.width) {
                    if (d.CellPosition_Y >= this.rect.y && d.CellPosition_Y <= this.rect.y + this.rect.height) {

                        ctx.save();

                        // Place in
                        requestAnimationFrame(() => {

                            // Get coords
                            const x = this.coord_scale_x(d.CellPosition_X)
                            const y = this.coord_scale_y(d.CellPosition_Y)

                            // Draw circles - placeholder
                            ctx.strokeStyle = `blue`;
                            ctx.fillStyle = "red";
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.arc(x, y, r, 0, Math.PI * 2);
                            ctx.stroke();
                            ctx.fill();
                        });

                        ctx.restore();
                    }
                }
            }
        })
    }

    /**
     * @function request_ids
     *
     * @param rect
     */
    async request_ids() {

        // Rect vars
        let channel_vars = [];
        let range_min_vars = [];
        let range_max_vars = [];
        Object.entries(this.channels).forEach(c => {
            channel_vars.push(c[0]);
            range_min_vars.push(c[1][0]);
            range_max_vars.push(c[1][1]);
        });

        // String with rect frame padding to pass to server
        const rect_adj = (this.rect_frame.x1 + this.rect_frame.width / 2) + ','
            + (this.rect_frame.y1 + this.rect_frame.height / 2) + ','
            + this.rect_frame.r;

        return fetch(`/get_rect_cells?` + new URLSearchParams({
            datasource: datasource,
            rect: rect_adj,
            channels: channel_vars
        }));
    }


}
