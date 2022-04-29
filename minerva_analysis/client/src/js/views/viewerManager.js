import "regenerator-runtime/runtime.js";

/**
 * @function toIdealTile -- full tile dimension in full image pixels
 * @param fullScale - scale factor to full image
 * @param useY - 0 for x and 1 for y
 *
 * @returns Number
 */
function toIdealTile(fullScale, useY) {
    const { _tileWidth, _tileHeight } = this;
    return [_tileWidth, _tileHeight][useY] * fullScale;
}

/**
 * @function toIdealTile -- clipped tile dimension in full image pixels
 * @param fullScale - scale factor to full image
 * @param v - x or y index of tile
 * @param useY - x=0 and y=1
 *
 * @returns Number
 */
function toRealTile(fullScale, v, useY) {
    const shape = [this.width, this.height][useY];
    const tileShape = this.toIdealTile(fullScale, useY);
    return Math.min(shape - (v * tileShape), tileShape);
}

/**
 * @function toTileBoundary -- tile start and size in full image pixels
 * @param fullScale - scale factor to full image
 * @param v - x or y index of tile
 * @param useY - x=0 and y=1
 *
 * @returns {{
 *    x: Array,
 *    y: Array
 * }}
 */
function toTileBoundary(fullScale, v, useY) {
    const start = v * this.toIdealTile(fullScale, useY);
    const size = this.toRealTile(fullScale, v, useY);
    return [start, size];
}

/**
 * @function toMagnifiedBounds -- return bounds of magnified tile
 * @param level - openseadragon tile level
 * @param x - openseadragon tile x index
 * @param y - openseadragon tile y index
 *
 * @returns {{
 *    x: Array,
 *    y: Array
 * }}
 */
function toMagnifiedBounds(...tileArgs) {
    const tl = this.toTileLevels(...tileArgs);
    if (tl.imageScale >= 1) {
      return { x: [0, 1], y: [0, 1] };
    }
    const ownScale = tl.fullScale;
    const parentScale = tl.tileScale;
    const [x, y] = [tl.imageTile.x, tl.imageTile.y].map((parentOffset, i) => {
        const [startHD, sizeHD] = this.toTileBoundary(ownScale, tileArgs[i + 1], i);
        const [startSD, sizeSD] = this.toTileBoundary(parentScale, parentOffset, i);
        const start = (startHD - startSD) / sizeSD;
        const end = start + (sizeHD) / sizeSD;
        return [
            [ start, end ],
            [ 1 - end, 1 - start ],
        ][i];
    })
    return {x, y};
}

/**
 * @function toTileLevels -- measure scaled/non-scaled tile details
 * @param level - openseadragon tile level
 * @param x - openseadragon tile x index
 * @param y - openseadragon tile y index
 *
 * @returns {{
 *   tileScale: Number,
 *   sourceScale: Number,
 *   imageScale: Number,
 *   fullScale: Number,
 *   imageSource: Object,
 *   imageTile: Object,
 * }}
 */
function toTileLevels(level, x, y) {
    const { extraZoomLevels } = this;
    const flipped = this.maxLevel - level; 
    const deepLevel = flipped - extraZoomLevels;
    const sourceLevel = Math.max(deepLevel, 0);
    const extraZoom = sourceLevel - deepLevel;
    const imageSource = {
        x: Math.floor(x / (2 ** extraZoom)),
        y: Math.floor(y / (2 ** extraZoom)),
        level: sourceLevel
    };
    const imageTile = {
        ...imageSource,
        level: level - extraZoom
    };
    return {
        tileScale: 2 ** (flipped + extraZoom),
        sourceScale: 2 ** sourceLevel,
        imageScale: 2 ** deepLevel,
        fullScale: 2 ** flipped,
        imageSource,
        imageTile
    };
}

const toTileUrlGetter = (src) => {
    return function (level, x, y) {
        const s = this.toTileLevels(level, x, y).imageSource;
        return `${src}${s.level}/${s.x}_${s.y}.png`;
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

        // Find name
        let name = "";
        let name_short = "";
        for (let k in imageChannels) {
            if (imageChannels.hasOwnProperty(k) && imageChannels[k] === srcIdx) {
                name = k;
                name_short = dataLayer.getShortChannelName(k);
            }
        }

        const src = this.imageViewer.config["imageData"][srcIdx]["src"];
        const { maxLevel, extraZoomLevels } = this.imageViewer.config;
        const magnification = 2 ** extraZoomLevels;
        this.viewer.addTiledImage({
            tileSource: {
                height: this.imageViewer.config.height * magnification,
                width: this.imageViewer.config.width * magnification,
                maxLevel: extraZoomLevels + maxLevel - 1,
                compositeOperation: "lighter",
                tileWidth: this.imageViewer.config.tileWidth,
                tileHeight: this.imageViewer.config.tileHeight,
                toMagnifiedBounds: toMagnifiedBounds,
                getTileUrl: toTileUrlGetter(src, 0),
                extraZoomLevels: extraZoomLevels,
                toTileBoundary: toTileBoundary,
                toTileLevels: toTileLevels,
                toIdealTile: toIdealTile,
                toRealTile: toRealTile,
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
            const { maxLevel, extraZoomLevels } = this.imageViewer.config;
            const magnification = 2 ** extraZoomLevels;
            this.viewer.addTiledImage({
                tileSource: {
                    height: this.imageViewer.config.height * magnification,
                    width: this.imageViewer.config.width * magnification,
                    maxLevel: extraZoomLevels + maxLevel - 1,
                    maxImageCacheCount: 50,
                    compositeOperation: "source-over",
                    tileWidth: this.imageViewer.config.tileWidth,
                    tileHeight: this.imageViewer.config.tileHeight,
                    toMagnifiedBounds: toMagnifiedBounds,
                    getTileUrl: toTileUrlGetter(url),
                    extraZoomLevels: extraZoomLevels,
                    toTileBoundary: toTileBoundary,
                    toTileLevels: toTileLevels,
                    toIdealTile: toIdealTile,
                    toRealTile: toRealTile,
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
