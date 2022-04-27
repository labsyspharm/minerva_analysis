import "regenerator-runtime/runtime.js";

function clipTile(tile, fullScale) {
    const { x, y } = tile;
    const width = this.width;
    const height = this.height;
    const tileWidth = this._tileWidth * fullScale;
    const tileHeight = this._tileHeight * fullScale;
    const origin = [x * tileWidth, y * tileHeight];
    const fullWidth = Math.min(width - origin[0], tileWidth);
    const fullHeight = Math.min(height - origin[1], tileHeight);
    return {
        x: (w) => (width * w) / fullWidth,
        y: (h) => (height * h) / fullHeight,
    };
}

const toCenter = (v, size, ratio) => {
    const vCenter = (v + size / 2) % ratio;
    return {
        x: vCenter,
        y: ratio - vCenter,
    };
};

function getLevelSource({ level, x, y }) {
    const deepLevel = this.maxLevel - level - 1;
    const sourceLevel = Math.max(deepLevel, 0);
    const deeper = sourceLevel - deepLevel;
    const tileLevel = level - deeper;
    const ratio = 2 ** deeper;
    const scale = 1 / ratio;
    const mag = this.magnification;
    const xSource = Math.floor(x * scale);
    const ySource = Math.floor(y * scale);
    const fullScale = mag * 2 ** sourceLevel * scale;
    return {
        scale,
        fullScale,
        tileLevel,
        x: xSource,
        y: ySource,
        level: sourceLevel,
    };
}

function toTileBoundary(tile, { scale, fullScale }, key) {
    const ratio = Math.round(1 / scale);
    const shape = { x: "width" }[key] || "height";
    const clipper = this.clipTile(tile, fullScale);
    const size = clipper[key](tile.bounds[shape]);
    const center = toCenter(tile[key], size, ratio)[key];
    const central = (v) => Math.max((v + center) / ratio, 0);
    return [-size / 2, size / 2].map(central);
}

function getLevels(tile) {
    const source = this.getLevelSource(tile);
    return {
        fullScale: source.fullScale,
        scale: source.scale,
        bounds: {
            x: tile._x || toTileBoundary.call(this, tile, source, "x"),
            y: tile._y || toTileBoundary.call(this, tile, source, "y"),
        },
        tile: {
            x: source.x,
            y: source.y,
            level: source.tileLevel,
        },
    };
}

const toTileUrlGetter = (src) => {
    return function (level, x, y) {
        const source = this.getLevelSource({ level, x, y });
        return `${src}${source.level}/${source.x}_${source.y}.png`;
    };
};

/**
 * @class ViewerManager
 */
export class ViewerManager {
    colorConnector = {};
    rangeConnector = {};

    show_sel = true;
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
        this.channelList = channelList;

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
        // If already exists
        if (srcIdx in this.channelList.currentChannels) {
            return;
        }

        // Get dzi path
        const src = this.imageViewer.config["imageData"][srcIdx]["src"];

        // Find name
        let name = "";
        let name_short = "";
        for (let k in imageChannels) {
            if (imageChannels.hasOwnProperty(k) && imageChannels[k] === srcIdx) {
                name = k;
                name_short = dataLayer.getShortChannelName(k);
            }
        }

        let maxLevel = this.imageViewer.config.maxLevel;
        let magnification = 2 ** 1;
        // Add tiled image
        this.viewer.addTiledImage({
            tileSource: {
                height: this.imageViewer.config.height * magnification,
                width: this.imageViewer.config.width * magnification,
                maxLevel: maxLevel,
                magnification: magnification,
                compositeOperation: "lighter",
                tileWidth: this.imageViewer.config.tileWidth,
                tileHeight: this.imageViewer.config.tileHeight,
                getTileUrl: toTileUrlGetter(src),
                getLevelSource: getLevelSource,
                getLevels: getLevels,
                clipTile: clipTile,
                tileFormat: 16,
            },
            // index: 0,
            opacity: 1,
            preload: true,
            success: () => {
                // Define url and suburl
                const itemidx = this.viewer.world.getItemCount() - 1;
                this.viewer.world.getItemAt(itemidx).source["channelUrl"] = src;
                const url = src;
                const group = url.split("/");
                const sub_url = group[group.length - 2];
                // Attach
                this.channelList.currentChannels[srcIdx] = {
                    url: url,
                    sub_url: sub_url,
                    color: this.channelList.colorConnector[srcIdx] ? this.channelList.colorConnector[srcIdx].color : d3.color("white"),
                    range: this.channelList.rangeConnector[srcIdx] || dataLayer.getImageBitRange(true),
                };
                this.viewer_channels[srcIdx] = { url: url, sub_url: sub_url, name: name, short_name: name_short };
            },
        });
    }

    /**
     * @function channel_remove
     * Remove channel from multichannel rendering
     *
     * @param srcIdx
     */
    channel_remove(srcIdx) {
        const img_count = this.viewer.world.getItemCount();

        // remove channel
        if (srcIdx in this.channelList.currentChannels) {
            // remove channel - first find it
            for (let i = 0; i < img_count; i = i + 1) {
                const url = this.viewer.world.getItemAt(i).source["channelUrl"];
                if (url === this.channelList.currentChannels[srcIdx]["url"]) {
                    this.viewer.world.removeItem(this.viewer.world.getItemAt(i));
                    delete this.channelList.currentChannels[srcIdx];
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
        if (this.imageViewer.config["imageData"][0]["src"] && this.imageViewer.config["imageData"][0]["src"] !== "") {
            let url = this.imageViewer.config["imageData"][0]["src"];
            let maxLevel = this.imageViewer.config.maxLevel;
            let magnification = 2 ** 1;
            this.viewer.addTiledImage({
                tileSource: {
                    height: this.imageViewer.config.height * magnification,
                    width: this.imageViewer.config.width * magnification,
                    maxLevel: maxLevel,
                    maxImageCacheCount: 50,
                    magnification: magnification,
                    compositeOperation: "source-over",
                    tileWidth: this.imageViewer.config.tileWidth,
                    tileHeight: this.imageViewer.config.tileHeight,
                    getTileUrl: toTileUrlGetter(url),
                    getLevelSource: getLevelSource,
                    getLevels: getLevels,
                    clipTile: clipTile,
                    tileFormat: 32,
                },
                index: 0,
                opacity: 1,
                success: (e) => {
                    const url0 = url;
                    this.viewer.world.getItemAt(0).source["channelUrl"] = url;
                    this.imageViewer.labelChannel["url"] = url0;
                    const group = url0.split("/");
                    this.imageViewer.labelChannel["sub_url"] = group[group.length - 2];
                    let source = e.item.source;
                    // Open Event is Necessary for ViaWebGl to init
                    self.viewer.raiseEvent("open", { source: source });
                },
            });
        } else {
            this.imageViewer.noLabel = true;
        }
    }
}
