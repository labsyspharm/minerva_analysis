import "regenerator-runtime/runtime.js";

/**
 * @class ViewerManager
 */
export class ViewerManager {

    show_sel = true;
    sel_outlines = false;

    /**
     * @constructor
     * Constructs a ColorManager instance before delegating initialization.
     *
     * @param {Object} _imageViewer
     * @param {Object} _viewer
     * @param {String} _viewerName
     */
    constructor(_imageViewer, _viewer, _viewerName) {
        this.viewer = _viewer;
        this.imageViewer = _imageViewer;
        this.viewerName = _viewerName;
        this.viewerChannels = {};

        this.init();
    }

    /**
     * @function init
     * Setups up the color manager
     *
     * @returns void
     */
    init() {

        // Load label image
        this.loadLabelImage();

        // configure webgl
        this.configWebgl();

    }

    /**
     * @function channel_add
     * Add channel to multi-channel rendering
     *
     * @param srcIdx
     */
    channelAdd(srcIdx) {

        // This is that
        const that = this;

        // If already exists
        if ((srcIdx in this.viewerChannels)) {
            return;
        }

        // Get dzi path
        const src = this.imageViewer.config["imageData"][srcIdx]["src"];

        // Find name
        let name = '';
        let name_short = '';
        for (let k in imageChannels) {
            if (imageChannels.hasOwnProperty(k) && imageChannels[k] === srcIdx) {
                name = k;
                name_short = dataLayer.getShortChannelName(k);
            }
        }

        // let maxLevel = this.imageViewer.config['maxLevel'];
        let maxLevel = this.imageViewer.config['maxLevel'] - 1;

        // Add tiled image
        this.viewer.addTiledImage({
            tileSource: {
                height: this.imageViewer.config['height'],
                width: this.imageViewer.config['width'],
                maxLevel: maxLevel,
                tileWidth: this.imageViewer.config['tileWidth'],
                tileHeight: this.imageViewer.config['tileHeight'],
                getTileUrl: function (level, x, y) {
                    return `${src}${maxLevel - level}/${x}_${y}.png`
                }
            },
            // index: 0,
            opacity: 1,
            preload: true,
            success: (e) => {
                // Define url and suburl
                const itemidx = this.viewer.world.getItemCount() - 1;
                this.viewer.world.getItemAt(itemidx).source['channelUrl'] = src
                const url = src;
                const group = url.split("/");
                const sub_url = group[group.length - 2];
                // Attach
                this.imageViewer.currentChannels[srcIdx] = {
                    "url": url,
                    "sub_url": sub_url,
                    "color": d3.color("white"),
                    "range": dataLayer.getImageBitRange(true)
                };
                this.viewerChannels[srcIdx] = {"url": url, "sub_url": sub_url, 'name': name, 'short_name': name_short};
            }
        });
    }

    /**
     * @function channel_remove
     * Remove channel from multichannel rendering
     *
     * @param srcIdx
     */
    channelRemove(srcIdx) {

        const src = this.imageViewer.config["imageData"][srcIdx]["src"];

        const img_count = this.viewer.world.getItemCount();

        // remove channel
        if ((srcIdx in this.imageViewer.currentChannels)) {

            // remove channel - first find it
            for (let i = 0; i < img_count; i = i + 1) {
                const url = this.viewer.world.getItemAt(i).source['channelUrl'];
                if (url === this.imageViewer.currentChannels[srcIdx]["url"]) {

                    this.viewer.world.removeItem(this.viewer.world.getItemAt(i));

                    delete this.imageViewer.currentChannels[srcIdx];
                    delete this.viewerChannels[srcIdx];
                    break;
                }
            }
        }
    }

    /**
     * @function config_webgl
     *
     * @returns void
     */
    configWebgl() {

        // This is that
        const that = this;

        // Define interface to shaders
        const seaGL = new viaWebGL.openSeadragonGL(this.viewer);
        seaGL.vShader = '/client/src/shaders/vert.glsl';
        seaGL.fShader = '/client/src/shaders/frag.glsl';

        // Events
        seaGL.addHandler('tile-drawing', async function (callback, e) {

            // Read parameters from each tile
            const tile = e.tile;
            const group = e.tile.url.split("/");
            const sub_url = group[group.length - 3];

            let channel = _.find(that.imageViewer.currentChannels, e => {
                return e.sub_url === sub_url;
            })
            if (channel) {
                const color = _.get(channel, 'color', d3.color("white"));
                const floatColor = [color.r / 255., color.g / 255., color.b / 255.];
                const range = _.get(channel, 'range', that.imageViewer.dataLayer.getImageBitRange(true));
                const via = this.viaGL;

                // Store channel color and range to send to shader
                via.color_3fv = new Float32Array(floatColor);
                via.range_2fv = new Float32Array(range);
                let fmt = 0;
                if (tile._format === 'u16') {
                    fmt = 16;
                } else if (tile._format === 'u32') {
                    fmt = 32;
                }
                via.fmt_1i = fmt;

                // Start webGL rendering
                callback(e);

                // After the callback, call the labels
                // await that.drawLabels(e);
            } else {
                if (e.tile._redrawLabel) {
                    that.drawLabelTile(e.tile, e.tile._tileImageData.width, e.tile._tileImageData.height);
                }
                if (e.tile.containsLabel) {
                    e.rendered.putImageData(e.tile._tileImageData, 0, 0);
                }
            }
        });

        seaGL.addHandler('gl-drawing', function () {
            // Send color and range to shader
            this.gl.uniform3fv(this.u_tile_color, this.color_3fv);
            this.gl.uniform2fv(this.u_tile_range, this.range_2fv);
            this.gl.uniform1i(this.u_tile_fmt, this.fmt_1i);

            // Clear before each draw call
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        });

        seaGL.addHandler('gl-loaded', function (program) {

            // Turn on additive blending
            this.gl.enable(this.gl.BLEND);
            this.gl.blendEquation(this.gl.FUNC_ADD);
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE);

            // Uniform variable for coloring
            this.u_tile_color = this.gl.getUniformLocation(program, 'u_tile_color');
            this.u_tile_range = this.gl.getUniformLocation(program, 'u_tile_range');
            this.u_tile_fmt = this.gl.getUniformLocation(program, 'u_tile_fmt');
        });

        seaGL.addHandler('tile-loaded', (callback, e) => {

            const group = e.tile.url.split("/");
            let isLabel = group[group.length - 3] === that.imageViewer.labelChannel.sub_url;

            // Label Tiles We'll view as 32 bits to get the ID values and save that on the tile object so it's cached
            if (isLabel) {
                e.tile._array = new Int32Array(PNG.sync.read(new Buffer(e.tileRequest.response), {colortype: 0}).data.buffer);

                that.drawLabelTile(e.tile, e.image.width, e.image.height);

                // We're hence skipping that OpenseadragonGL callback since we only care about the vales
                return e.getCompletionCallback()();
            } else {

                // This goes to OpenseadragonGL which does the necessary bit stuff.
                return callback(e);
            }
        });

        // Initialize
        seaGL.init();
    }

    /**
     * @function draw_label_tile
     *
     * @param tile
     * @param width
     * @param height
     */
    drawLabelTile(tile, width, height) {

        // This is that
        const that = this;

        // Empty data
        let imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
        tile._tileImageData = imageData;

        // Iterate if selection
        if (that.show_sel && that.imageViewer.selection.size > 0) {

            imageData = tile._tileImageData;

            tile._array.forEach((val, i) => {

                // If direct hit
                if (val !== 0 && that.imageViewer.selection.has(val - 1)) {

                    // Pixel size index
                    let index = i * 4;

                    // If outline
                    this.sel_outlines = true
                    if (this.sel_outlines) {

                        // Init grid and tests (4 pts v 8 working for now)
                        const grid = [
                            i - 1,
                            i + 1,
                            i - width * 1,
                            i + width * 1
                        ];
                        const test = [
                            i % (width) !== 0,
                            i % (width) !== (width - 1),
                            i >= width,
                            i < width * (height - 1)
                        ];

                        // Iterate grid
                        for (let j = 0; j < grid.length; j++) {

                            // If pass test (i.e., not on tile border)
                            if (test[j]) {

                                // Neighbor label value
                                const altLabelValue = tile._array[grid[j]] - 1;

                                // Check and color if edge
                                if (altLabelValue !== val - 1) {
                                    imageData.data[index] = 255;
                                    imageData.data[index + 1] = 255;
                                    imageData.data[index + 2] = 255;
                                    imageData.data[index + 3] = 255;
                                    tile.containsLabel = true;
                                    break;
                                }
                            }
                        }
                    } else  {

                        // If fill
                        imageData.data[index] = 255;
                        imageData.data[index + 1] = 255;
                        imageData.data[index + 2] = 255;
                        imageData.data[index + 3] = 255;
                        tile.containsLabel = true;
                    }

                }
            });
        }
    }

    /**
     * @function evaluate_tf
     *
     * @param val
     * @param tf
     * @returns {*}
     */
    evaluateTf(val, tf) {

        let lerpFactor = Math.round(((val - tf.min) / (tf.max - tf.min)) * (tf.num_bins - 1));

        if (lerpFactor >= tf.num_bins) {
            lerpFactor = tf.num_bins - 1;
        }

        if (lerpFactor < 0) {
            lerpFactor = 0;
        }

        return tf.tf[lerpFactor];
    }

    /**
     * @function force_repaint
     *
     * @returns void
     */
    forceRepaint() {

        // Redraw
        this.viewer.forceRedraw();
    }

    /**
     * @function load_label_image
     *
     * @returns void
     */
    loadLabelImage() {

        const self = this;

        // Load label image in background if it exists
        if (this.imageViewer.config["imageData"][0]["src"] && this.imageViewer.config["imageData"][0]["src"] !== '') {
            let url = this.imageViewer.config["imageData"][0]["src"];
            let maxLevel = this.imageViewer.config['maxLevel'] - 1;
            this.viewer.addTiledImage({
                tileSource: {
                    height: this.imageViewer.config['height'],
                    width: this.imageViewer.config['width'],
                    maxLevel: maxLevel,
                    maxImageCacheCount: 50,
                    tileWidth: this.imageViewer.config['tileWidth'],
                    tileHeight: this.imageViewer.config['tileHeight'],
                    getTileUrl: function (level, x, y) {
                        return `${url}${maxLevel - level}/${x}_${y}.png`
                    }
                },
                index: 0,
                opacity: 1,
                success: (e) => {
                    const url0 = url
                    this.viewer.world.getItemAt(0).source['channelUrl'] = url;
                    this.imageViewer.labelChannel["url"] = url0;
                    const group = url0.split("/");
                    this.imageViewer.labelChannel["sub_url"] = group[group.length - 2];
                    let source = e.item.source;
                    // Open Event is Necessary for ViaWebGl to init
                    self.viewer.raiseEvent('open', {source: source});
                }
            });
        } else {
            this.imageViewer.noLabel = true;
        }
    }

    /**
     * @function update_selection
     *
     * @returns void
     */
    updateSelection() {

        // Reload Label Tiles
        let tileLevels = this.viewer.world.getItemAt(0).tilesMatrix;
        for (const [levelKey, level] of Object.entries(tileLevels)) {
            for (const [levelKey, tile] of Object.entries(level)) {
                for (const [subLevelKey, subTile] of Object.entries(tile)) {
                    subTile._redrawLabel = true;
                }
            }
        }

        // Repaint
        this.forceRepaint();
    }

}
