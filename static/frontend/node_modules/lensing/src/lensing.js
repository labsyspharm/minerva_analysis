/*
Lensing
 */

import Controls from './controls';
import Lenses from './lenses';
import Viewfinder from './viewfinder';

/*
TODO -
  - Add in rotate
*/

/**
 * @class Lensing
 *
 * @constructor
 */
export default class Lensing {

    // Class refs
    controls = null;
    lenses = null;
    viewfinder = null;

    // Components
    overlay = null;
    viewer_aux = null;
    viewer_aux_canvas = null;
    viewer = null;
    viewer_canvas = null;

    // Position data
    position_data = {
        centerPoint: null,
        currentEvent: '',
        refPoint: null,
        eventPoint: null,
        screenCoords: [],
        zoom: 0,
        zoomAux: 0
    };

    // Configs
    configs = {
        counter: 0,
        counter_control: 2,
        counter_exception: false,
        mag: 1,
        on: true,
        placed: false,
        pos: [],
        px: '',
        pxData: null,
        pxRatio: 1,
        rad: 100,
        rad_default: 100,
        rad_inc: 10,
        rad_min: 0,
        rad_max: 400,
        shape: 'circle',
    }

    /*
    CONSTRUCTOR
     */
    constructor(_osd, _viewer, _viewer_config, _data = [], _data_config = null) {
        this.osd = _osd;
        this.viewer = _viewer;
        this.viewer_config = _viewer_config;
        this.data = _data;

        // Set lensing configs
        this.device_config();

        // Init
        this.init();
    }

    /**
     * 1.
     * @function init
     * Initializes the viewers, overlay and lenses
     *
     * @returns void
     */
    init() {

        // Build magnifier viewer (hidden viewer)
        this.viewer_aux = this.build_hidden_viewer();

        // Get actual canvas els
        this.viewer_canvas = this.viewer.canvas.querySelector('canvas');
        this.viewer_aux_canvas = this.viewer_aux.canvas.querySelector('canvas');

        // Add event listeners to viewer
        this.attach_events();

        // Build overlay
        this.overlay = this.build_overlay('lens',
            [this.viewer.canvas.clientWidth, this.viewer.canvas.clientHeight]);

        // Instantiate Filters
        this.lenses = new Lenses(this);

        // Instantiate controls
        this.controls = new Controls(this);

        // Instantiate Viewfinder
        this.viewfinder = new Viewfinder(this);

    }

    /**
     * @function attach_events
     * Attaches event listeners to both viewers and the document
     *
     * @returns void
     */
    attach_events() {

        // Click (or open)
        this.viewer_aux.addHandler('click', this.handle_viewer_aux_click.bind(this));
        this.viewer_aux.addHandler('open', this.handle_viewer_aux_open.bind(this));
        this.viewer_aux.addHandler('animation', this.handle_viewer_animation.bind(this));

        // Zoom-ing or pan-ing
        this.viewer.addHandler('animation', this.handle_viewer_animation.bind(this));
        this.viewer.addHandler('open', this.handle_viewer_open.bind(this));
        this.viewer.addHandler('pan', this.handle_viewer_pan.bind(this));
        this.viewer.addHandler('zoom', this.handle_viewer_zoom.bind(this));
        this.viewer.addHandler('canvas-drag', this.handle_viewer_canvasdrag.bind(this));

        // Mouse-ing
        this.viewer.canvas.addEventListener('mouseover', this.handle_viewer_mouseover.bind(this));
        this.viewer.canvas.addEventListener('mousemove', this.handle_viewer_mousemove.bind(this));
        this.viewer.canvas.addEventListener('mouseout', this.handle_viewer_mouseout.bind(this));

        // Key-ing
        document.addEventListener('keydown', this.handle_viewer_keydown.bind(this));
    }

    /**
     * @function build_hidden_viewer
     * Builds a hidden (aux) viewer that is used to project filtered / magnified data
     *
     * @returns any
     */
    build_hidden_viewer() {

        // Update viewer positions
        const viewerEl = document.querySelector(`#${this.viewer_config.id}`)
        viewerEl.style.position = 'relative';

        // Instantiate viewer_magnify
        const viewer_aux = new this.osd(this.viewer_config);

        // Position
        const containers = viewerEl.querySelectorAll(`.openseadragon-container`);
        containers[0].classList.add('o-c_main');
        containers[0].style.position = 'relative';
        containers[1].classList.add('o-c_aux')
        containers[1].style.position = 'absolute';
        containers[1].style.visibility = 'hidden';

        return viewer_aux;
    }

    /**
     * @function build_overlay
     * Builds overlay, including canvas and svg
     *
     * @param {string} id
     * @param {array} dims
     *
     * @returns any
     */
    build_overlay(id, dims) {

        // Build container
        const container = document.createElement('div');
        container.setAttribute('class', `overlay_container_${id} overlay_container`);
        container.setAttribute('style',
            `height: ${dims[0]}px; pointer-events: none; position: absolute; width: ${dims[1]}px;`);

        // Append container
        this.viewer.canvas.append(container);

        // Build actualCanvas
        const actualCanvas = document.createElement('canvas');
        actualCanvas.setAttribute('width', `${dims[0] * this.configs.pxRatio}`);
        actualCanvas.setAttribute('height', `${dims[1] * this.configs.pxRatio}`);
        actualCanvas.setAttribute('style',
            'height: 100%; pointer-events: none; position: absolute; width: 100%;');

        // Append actualCanvas to container, container to viewer
        container.append(actualCanvas);

        // Return
        return {
            canvas: actualCanvas,
            container: container,
            context: actualCanvas.getContext('2d')
        };
    }

    /**
     * @function device_config
     * Updates configurations using device pixel ratio
     *
     * @returns void
     */
    device_config() {

        // Pixel ratio
        const pxRatio = window.devicePixelRatio;

        // Configs
        this.configs.pxRatio = pxRatio;
        this.configs.rad = Math.round(50 * pxRatio);
        this.configs.rad_default = Math.round(50 * pxRatio);
        this.configs.rad_inc = Math.round(5 * pxRatio);
        this.configs.rad_max = Math.round(200 * pxRatio);
    }

    /**
     * @function draw_lens
     * Paints the overlay
     *
     * @param {any} data
     *
     * @returns void
     */
    draw_lens(data) {

        if (this.configs.counter % this.configs.counter_control === 0 || this.configs.counter_exception) {

            // Reset
            this.configs.counter_exception = false;

            // Place in
            requestAnimationFrame(() => {

                // Update viewfinder
                this.viewfinder.wrangle();

                // Update overlay dims and position
                this.overlay.canvas.setAttribute('width', this.configs.rad * 2 + 'px');
                this.overlay.canvas.setAttribute('height', this.configs.rad * 2 + 'px');
                this.overlay.canvas.style.width = Math.ceil(this.configs.rad * 2 / this.configs.pxRatio) + 'px';
                this.overlay.canvas.style.height = Math.ceil(this.configs.rad * 2 / this.configs.pxRatio) + 'px';
                this.overlay.container.style.left = Math.round((data.x - this.configs.rad) / this.configs.pxRatio) + 'px';
                this.overlay.container.style.top = Math.round((data.y - this.configs.rad) / this.configs.pxRatio) + 'px';

                // Clear s
                this.overlay.context.clearRect(0, 0,
                    this.overlay.canvas.width, this.overlay.canvas.height);

                if (this.configs.on) {

                    // Save
                    this.overlay.context.save();

                    // Filter
                    let filteredD = this.lenses.modify(data.d);

                    // Convert to bitmap
                    createImageBitmap(filteredD).then(imgBitmap => {

                        // Clip
                        if (this.configs.shape === 'circle') {
                            this.overlay.context.beginPath();
                            this.overlay.context.arc(this.configs.rad, this.configs.rad, this.configs.rad, 0, Math.PI * 2);
                            this.overlay.context.clip();
                        }

                        // Draw
                        if (this.lenses.selections.magnifier.name === 'mag_standard') {
                            this.overlay.context.drawImage(imgBitmap,
                                0,
                                0,
                                this.configs.rad * 2,
                                this.configs.rad * 2
                            );
                        } else if (this.lenses.selections.magnifier.name === 'mag_fisheye') {
                            this.overlay.context.scale(1 / this.configs.mag, 1 / this.configs.mag)
                            this.overlay.context.drawImage(imgBitmap,
                                0,
                                0,
                                this.configs.rad * 2 * this.configs.mag,
                                this.configs.rad * 2 * this.configs.mag
                            );
                        }

                        // Restore
                        this.overlay.context.restore();

                        // Lens border / stroke
                        this.overlay.context.strokeStyle = `white`;
                        this.overlay.context.lineWidth = 1;
                        this.overlay.context.beginPath();
                        if (this.configs.shape === 'circle') {
                            this.overlay.context.arc(this.configs.rad, this.configs.rad, this.configs.rad - 1, 0, Math.PI * 2);
                        } else if (this.configs.shape === 'square') {
                            this.overlay.context.strokeRect(1, 1, (this.configs.rad - 1) * 2, (this.configs.rad - 1) * 2);
                        }
                        this.overlay.context.stroke();
                    });

                }
            });
        }
        this.configs.counter++;
    }

    /**
     * @function handle_viewer_animation
     * Manages hidden viewer zooming / positioning during zoom / pan events
     *
     * @returns void
     */
    handle_viewer_animation(e) {

        // Update some position data
        this.position_data.zoom = this.viewer.viewport.getZoom();
        this.position_data.zoomAux = this.viewer_aux.viewport.getZoom();

        // If panning (dragging)
        if (this.position_data.screenCoords.length > 0) {
            this.set_position(this.position_data.screenCoords);
        } else {
            this.manage_lens_update();
        }
    }

    /**
     * @function handle_viewer_canvasdrag
     * Manages drag
     *
     * @param {Event} e
     *
     * @returns void
     */
    handle_viewer_canvasdrag(e) {

        // Get pos data from event
        this.position_data.currentEvent = 'pan';
        this.position_data.screenCoords = [Math.round(e.position.x), Math.round(e.position.y)];
    }

    /**
     * @function handle_viewer_keydown
     * Handles keyboard shortcuts
     *
     * @param {Event} e
     *
     * @returns void
     */
    handle_viewer_keydown(e) {

        // Lens filter
        const keys_filter = ['{', '}', '|'];
        if (keys_filter.includes(e.key)) {
            // Specifics
            if (e.key === '{') {
                this.lenses.change_lens('prev', 'filter');
            } else if (e.key === '}') {
                this.lenses.change_lens('next', 'filter');
            } else if (e.key === '|') {
                this.lenses.change_lens('none', 'filter');
            }
            // Generics
            this.configs.counter_exception = true;
            this.manage_slider_update();
            this.manage_viewfinder_update();
            this.controls.update_report();
            this.manage_lens_update();
        }

        // Lens shape
        const keys_shape = ['L'];
        if (keys_shape.includes(e.key)) {
            // Specifics
            if (e.key === 'L') {
                if (this.configs.shape === 'circle') {
                    this.configs.shape = 'square';
                } else if (this.configs.shape === 'square') {
                    this.configs.shape = 'circle';
                }
            }
            // Generics
            this.manage_lens_update();
        }

        // Lens on
        const keys_onOff = ['l'];
        if (keys_onOff.includes(e.key)) {
            // Specifics
            if (e.key === 'l') {
                this.configs.on = !this.configs.on;
            }
            // Generics
            this.manage_lens_update();
        }

        // Lens sizing
        const keys_size = ['[', ']', '\\'];
        if (keys_size.includes(e.key)) {
            // Specifics
            if (e.key === '[') {
                if (this.configs.rad - this.configs.rad_inc >= this.configs.rad_min) {
                    this.configs.rad -= this.configs.rad_inc;
                }
            } else if (e.key === ']') {
                if (this.configs.rad + this.configs.rad_inc <= this.configs.rad_max) {
                    this.configs.rad += this.configs.rad_inc;
                }
            } else if (e.key === '\\') {
                this.configs.rad = this.configs.rad_default;
            }
            // Generics
            this.manage_lens_update();
        }

        // Lens placement
        const keys_dropFetch = ['p'];
        if (keys_dropFetch.includes(e.key)) {
            // Specifics
            if (e.key === 'p') {
                this.configs.placed = !this.configs.placed;
            }
            // Generics
            this.manage_lens_update();
        }

        // Lens magnification
        const keys_mag = ['m', ',', '.', '/'];
        if (keys_mag.includes(e.key)) {
            // Specifics
            if (e.key === 'm') {
                this.lenses.change_lens('next', 'magnifier');
                this.configs.mag = this.lenses.selections.magnifier.settings.active =
                    this.lenses.selections.magnifier.settings.default;
            } else if (e.key === ',') {
                if (this.configs.mag - this.lenses.selections.magnifier.settings.step >=
                    this.lenses.selections.magnifier.settings.min) {
                    this.configs.mag -= this.lenses.selections.magnifier.settings.step;
                    this.lenses.selections.magnifier.settings.active = this.configs.mag;
                }
            } else if (e.key === '.') {
                if (this.configs.mag + this.lenses.selections.magnifier.settings.step <=
                    this.lenses.selections.magnifier.settings.max) {
                    this.configs.mag += this.lenses.selections.magnifier.settings.step;
                    this.lenses.selections.magnifier.settings.active = this.configs.mag;
                }
            } else if (e.key === '/') {
                this.configs.mag = this.lenses.selections.magnifier.settings.default;
                this.lenses.selections.magnifier.settings.active = this.configs.mag;
            }
            // Generics
            this.configs.counter_exception = true;
            this.position_data.refPoint = this.position_data.eventPoint;
            this.position_data.zoom = this.viewer.viewport.getZoom(true);
            this.controls.update_report();
            this.viewer_aux.raiseEvent('click', {eventType: 'zoom', immediately: true});
        }
    }

    /**
     * @function handle_viewer_mouseover
     * Turns on lens (if off), updates overlay and hidden viewer positions
     *
     * @param {Event} e
     *
     * @returns void
     */
    handle_viewer_mouseover(e) {

        // Turn on lens
        this.configs.on = true;

        // Set hidden viewer and overlay pos
        this.position_data.screenCoords = [
            e.clientX - this.viewer_aux_canvas.getBoundingClientRect().x,
            e.clientY - this.viewer_aux_canvas.getBoundingClientRect().y
        ];
        this.set_position(this.position_data.screenCoords);

        // Update if not placed
        if (!this.configs.placed) {
            this.manage_lens_update();
        }
    }

    /**
     * @function handle_viewer_mousemove
     * Updates overlay and hidden viewer positions
     *
     * @param {Event} e
     *
     * @returns void
     */
    handle_viewer_mousemove(e) {

        // Set hidden viewer and overlay pos
        this.position_data.screenCoords = [
            e.clientX - this.viewer_aux_canvas.getBoundingClientRect().x,
            e.clientY - this.viewer_aux_canvas.getBoundingClientRect().y
        ];
        this.set_position(this.position_data.screenCoords);

        // If not placed
        if (!this.configs.placed) {
            this.manage_lens_update();
        }
    }

    /**
     * @function handle_viewer_mouseout
     * Turns off lens if not placed when mouse is outsider viewer
     *
     * @returns void
     */
    handle_viewer_mouseout() {

        // If outside of viewer, turn off mouse
        if (!this.configs.placed) {
            this.configs.on = false;
        }
    }

    /**
     * @function handle_viewer_open
     * Initializes position settings from center
     *
     * @returns void
     */
    handle_viewer_open() {

        // Defaults
        this.position_data.refPoint = this.viewer.viewport.getCenter(false);
        this.position_data.centerPoint = this.viewer.viewport.getCenter(false);
        this.position_data.eventPoint = this.viewer.viewport.getCenter(false);
        this.position_data.zoom = this.viewer.viewport.getZoom(true);
    }

    /**
     * @function handle_viewer_zoom
     * Configures position data for zoom and raises hidden viewer click event
     *
     * @param {Event} e
     *
     * @returns null
     */
    handle_viewer_zoom(e) {

        // Update zoom data
        this.position_data.zoom = e.zoom;
        if (e.refPoint && e.refPoint.hasOwnProperty('x') && e.refPoint.hasOwnProperty('y')) {

            // Config
            this.position_data.currentEvent = 'zoom';
            //this.position_data.refPoint = e.refPoint;
            this.position_data.screenCoords = [];
            //this.set_position(e.refPoint, true);

            // Emulate event
            this.position_data.refPoint = e.refPoint;
            this.viewer_aux.raiseEvent('click', {eventType: 'zoom', immediately: false});
        } else {
            this.position_data.refPoint = this.viewer.viewport.getCenter(false);
            //this.set_position(this.viewer.viewport.getCenter(false), true);
        }
    }

    /**
     * @function handle_viewer_pan
     * Configures position data for pan
     *
     * @param {Event} e
     *
     * @returns null
     */
    handle_viewer_pan(e) {

    }

    /**
     * @function handle_viewer_aux_click
     * Adjusts zoom or pan based on an emulated event from scroll
     *
     * @param {Event} e
     *
     * @returns void
     */
    handle_viewer_aux_click(e) {

        // Check if zoom or pan
        if (e.eventType === 'zoom' || !e.eventType) {
            if (this.position_data.zoom && this.position_data.refPoint
                && this.position_data.refPoint.hasOwnProperty('x')
                && this.position_data.refPoint.hasOwnProperty('y')) {

                // Zoom
                this.viewer_aux.viewport.zoomTo(
                    this.position_data.zoom * this.configs.mag,
                    this.position_data.refPoint,
                    e.immediately
                );
            }
        } else if (e.eventType === 'pan') {
            if (this.position_data.refPoint) {

                // Pan
                this.viewer_aux.viewport.panTo(this.position_data.refPoint, e.immediately);
            }
        }
        // Events
        this.manage_lens_update();
    }

    /*
    handle_viewer_aux_open
     */
    handle_viewer_aux_open(e) {

        // Fire click event
        this.handle_viewer_aux_click(e);
    }

    /**
     * @function manage_lens_update
     * Defines position configurations before redraw
     *
     * @returns void
     */
    manage_lens_update() {

        // Check pos and placement
        if (this.configs.pos.length > 0 && !this.configs.placed) {

            // Get context, init data
            const ctx = this.viewer_aux_canvas.getContext('2d');
            let d = null;

            // Respond to magnifaction
            if (this.lenses.selections.magnifier.name === 'mag_standard') {
                let xy = this.configs.rad * 2;
                d = ctx.getImageData(
                    this.configs.pos[0] - this.configs.rad,
                    this.configs.pos[1] - this.configs.rad,
                    xy,
                    xy
                );
            } else if (this.lenses.selections.magnifier.name === 'mag_fisheye') {
                let xy = Math.round(this.configs.rad * 2 * this.configs.mag);
                d = ctx.getImageData(
                    this.configs.pos[0] - this.configs.rad * this.configs.mag,
                    this.configs.pos[1] - this.configs.rad * this.configs.mag,
                    xy,
                    xy
                );
            }

            // If data config to color
            if (this.data.length > 0) {
                this.set_pixel(ctx);
            }

            // Draw
            this.draw_lens({
                x: this.configs.pos[0],
                y: this.configs.pos[1],
                d: d
            });
        }
    }

    /**
     * @function manage_slider_update
     * Updates slider in controls bar
     *
     * @returns null
     */
    manage_slider_update() {

        // Get filter
        const filter = this.lenses.selections.filter;
        filter.settings.active = filter.settings.default;

        // Update controls slider
        this.controls.slider.max = filter.settings.max;
        this.controls.slider.value = filter.settings.default;
        this.controls.slider.step = filter.settings.step;
    }

    /**
     * @function manage_viewfinder_update
     * Updates viewfinder visibility
     *
     * @returns null
     */
    manage_viewfinder_update() {

        // Update viewfinder
        this.viewfinder.on = this.lenses.selections.filter.settings.vf;
    }

    /**
     * @function set_pixel
     * Sets pixel for data configured for color
     *
     * @return void
     */
    set_pixel(ctx) {

        // Get single pixel info TODO - PoC work
        const px = ctx.getImageData(
            this.configs.pos[0],
            this.configs.pos[1],
            1,
            1
        );
        this.configs.px = px.data[0] + '_' + px.data[1] + '_' + px.data[2]
        let sel = null;
        let diff = 255 * 3;
        let range = 0;
        this.data.forEach(d => {
            // Measure difference
            // const currentDiff = Math.abs(px.data[0] + px.data[1] + px.data[2] - (+d.r + +d.g + +d.b));
            const r_mean = (px.data[0] + +d.r) / 2;
            const r_diff = px.data[0] - +d.r;
            const g_diff = px.data[1] - +d.g;
            const b_diff = px.data[2] - +d.b;
            const cDiff = Math.sqrt(
                (2 + r_mean / 256) * r_diff ** 2
                + 4 * g_diff ** 2
                + (2 + (255 - r_mean) / 256) * b_diff ** 2
            );
            // If smaller difference - TODO: linked to filter lens 'dataRgb' optimization
            if (cDiff <= diff) {
                range = diff;
                diff = cDiff;
                sel = d;
            }
        });
        this.configs.pxData = {
            sel: sel,
            range: diff
        };
    }

    /**
     * @function set_position
     * Converts mouse coords to viewport point for hidden layer if mag on, sets coordinate config for overlay
     *
     * @param {array} coords
     * @param {boolean} isPoint
     *
     * @returns void
     */
    set_position(coords, isPoint = false) {

        // Get some cords for overlay
        const x = Math.round(coords[0] * this.configs.pxRatio);
        const y = Math.round(coords[1] * this.configs.pxRatio);
        this.configs.pos = [x, y];
        if (isPoint) {
            const reCoords = this.viewer.viewport.pixelFromPoint(coords);
            const x = Math.round(reCoords.x * this.configs.pxRatio);
            const y = Math.round(reCoords.y * this.configs.pxRatio);
            this.configs.pos = [x, y];
        }

        // Transform coordinates to scroll point
        const point = new this.osd.Point(coords[0], coords[1]);
        this.position_data.eventPoint = isPoint ? coords : this.viewer.viewport.viewerElementToViewportCoordinates(point);

        // Check for event point before calulating reference point
        this.position_data.centerPoint = this.viewer.viewport.getCenter(true);
        const gap = this.position_data.centerPoint.minus(this.position_data.eventPoint).divide(this.configs.mag);
        this.position_data.refPoint = this.position_data.eventPoint.plus(gap);

        // Emulate event
        this.viewer_aux.raiseEvent('click', {eventType: 'pan', immediately: true});
    }

}

/*
Ref.
https://stackoverflow.com/questions/38384001/using-imagedata-object-in-drawimage
https://stackoverflow.com/questions/39665545/javascript-how-to-clip-using-drawimage-putimagedata
https://stackoverflow.com/questions/32681929/hook-into-openseadragon-with-custom-user-interface-device
 */