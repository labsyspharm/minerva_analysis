import "regenerator-runtime/runtime.js";

/**
 * @class ViewerManager
 */
export class ViewerManager {

    show_sel = false;
    sel_outlines = true;

    /**
     * @constructor
     * Constructs a ColorManager instance before delegating initialization.
     *
     * @param {Object} _viewer
     */
    constructor(_imageViewer, _viewer, _viewerName) {
        this.viewer = _viewer;
        this.imageViewer = _imageViewer;
        this.viewer_name = _viewerName;
        this.viewer_channels = {};

        this.init();
    }

    /**
     * @function init
     * Setups up the color manager.
     *
     * @returns void
     */
    init() {
        // Load label image
        this.load_label_image();


    }


    /**
     * @function channel_add
     * Add channel to multi-channel rendering
     *
     * @param srcIdx
     */
    channel_add(srcIdx) {
        const self = this;

        // If already exists
        if ((srcIdx in this.imageViewer.currentChannels)) {
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
                this.viewer_channels[srcIdx] = {"url": url, "sub_url": sub_url, 'name': name, 'short_name': name_short};
            }
        });
    }

    /**
     * @function channel_remove
     * Remove channel from multichannel rendering
     *
     * @param srcIdx
     */
    channel_remove(srcIdx) {

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
                    delete this.viewer_channels[srcIdx];
                    break;
                }
            }
        }
    }


    /**
     * @function evaluateTF
     *
     * @param val
     * @param tf
     * @returns {*}
     */
    evaluateTF(val, tf) {

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
    force_repaint() {

        // Refilter, redraw
        // this.viewer.forceRefilter();
        this.viewer.forceRedraw();
    }

    /**
     * @function load_label_image
     *
     * @returns void
     */
    load_label_image() {
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




}