import "regenerator-runtime/runtime.js";

/**
 * @function toIdealTile -- full tile dimension in full image pixels
 * @param fullScale - scale factor to full image
 * @param useY - 0 for x and 1 for y
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
 * @returns Number
 */
function toRealTile(fullScale, v, useY) {
    const shape = [this.width, this.height][useY];
    const tileShape = this.toIdealTile(fullScale, useY);
    return Math.min(shape - v * tileShape, tileShape);
}

/**
 * @function toTileBoundary -- tile start and size in full image pixels
 * @param fullScale - scale factor to full image
 * @param v - x or y index of tile
 * @param useY - x=0 and y=1
 * @typedef {object} Bound
 * @property {number} start - full image pixel start of tile
 * @property {number} size - full image pixel size of tile
 * @returns Bound
 */
function toTileBoundary(fullScale, v, useY) {
    const start = v * this.toIdealTile(fullScale, useY);
    const size = this.toRealTile(fullScale, v, useY);
    return { start, size };
}

/**
 * @function toMagnifiedBounds -- return bounds of magnified tile
 * @param _level - openseadragon tile level
 * @param _x - openseadragon tile x index
 * @param _y - openseadragon tile y index
 * @typedef {object} Bounds
 * @property {Array} x - start and end image x-coordinates
 * @property {Array} y - start and end image y-coordinates
 * @returns Bounds
 */
function toMagnifiedBounds(_level, _x, _y) {
    const tl = this.toTileLevels(_level, _x, _y);
    if (tl.relativeImageScale >= 1) {
        return { x: [0, 1], y: [0, 1] };
    }
    const ownScale = tl.outputFullScale;
    const parentScale = tl.inputFullScale;
    const [x, y] = [tl.outputTile.x, tl.outputTile.y].map((parentOffset, i) => {
        const hd = this.toTileBoundary(ownScale, [_x, _y][i], i);
        const sd = this.toTileBoundary(parentScale, parentOffset, i);
        const start = (hd.start - sd.start) / sd.size;
        const end = start + hd.size / sd.size;
        return [
            [start, end],
            [1 - end, 1 - start],
        ][i];
    });
    return { x, y };
}

/**
 * @function toTileLevels -- measure scaled/non-scaled tile details
 * @param level - openseadragon tile level
 * @param x - openseadragon tile x index
 * @param y - openseadragon tile y index
 * @typedef {object} TileLevels
 * @property {number} inputFullScale - full scale of source tile
 * @property {number} outputFullScale - full scale of renedered tile
 * @property {number} relativeImageScale - scale relative to image pixels
 * @property {object} inputTile - level, x, and y of source tile
 * @property {object} outputTile - level, x, and y of rendered tile
 * @returns TileLevels
 */
function toTileLevels(level, x, y) {
    const { extraZoomLevels } = this;
    const flipped = this.maxLevel - level;
    const relativeLevel = flipped - extraZoomLevels;
    const sourceLevel = Math.max(relativeLevel, 0);
    const extraZoom = sourceLevel - relativeLevel;
    const inputTile = {
        x: Math.floor(x / 2 ** extraZoom),
        y: Math.floor(y / 2 ** extraZoom),
        level: sourceLevel,
    };
    const outputTile = {
        ...inputTile,
        level: level - extraZoom,
    };
    return {
        inputFullScale: 2 ** (flipped + extraZoom),
        relativeImageScale: 2 ** relativeLevel,
        outputFullScale: 2 ** flipped,
        inputTile,
        outputTile,
    };
}

/**
 * @function getTileUrl -- return url for tile
 * @param level - openseadragon tile level
 * @param x - openseadragon tile x index
 * @param y - openseadragon tile y index
 * @returns string
 */
function getTileUrl(level, x, y) {
    const s = this.toTileLevels(level, x, y).inputTile;
    return `${this.src}${s.level}/${s.x}_${s.y}.png`;
}

/**
 * @function getTileKey -- return string key for tile
 * @param level - openseadragon tile level
 * @param x - openseadragon tile x index
 * @param y - openseadragon tile y index
 * @returns string
 */
function getTileKey(level, x, y) {
    const { srcIdx, tileFormat } = this;
    const s = this.toTileLevels(level, x, y).inputTile;
    return `${tileFormat}-${srcIdx}-${s.level}-${s.x}-${s.y}`;
}

/**
 * @function getImagePixel -- return image pixel for screen position
 * @param tiledImage - openseadragon tiled image
 * @param position - screen position
 * @returns array
 */
function getImagePixel(tiledImage, position) {
    const tileScale = 2 ** this.extraZoomLevels;
    const frac = tiledImage.viewport.pointFromPixel(position);
    const zoomed = tiledImage.viewportToImageCoordinates(frac);
    return [zoomed.x, zoomed.y].map((v) => v / tileScale);
}

/**
 * @class ViewerManager
 */
export class ViewerManager {
    colorConnector = {};
    rangeConnector = {};

    show_sel = true;
    sel_outlines = true;

    /**
     * Constructs a ColorManager instance before delegating initialization.
     *
     * @param imageViewer - ImageViewer instance
     * @param channelList - ChannelList instance
     */
    constructor(imageViewer, channelList) {
        this.viewer = imageViewer.viewer;
        this.imageViewer = imageViewer;
        this.channelList = channelList;
        this.init();
    }

    /**
     * @function init
     * Setups up the color manager.
     */
    init() {
        // Load label image
        this.load_label_image();
    }

    /**
     * @function channel_add
     * Add channel to multi-channel rendering
     * @param srcIdx - integer id of channel to add
     */
    channel_add(srcIdx) {
        // If already exists
        if (srcIdx in this.channelList.currentChannels) {
            return;
        }

        const url = this.imageViewer.config["imageData"][srcIdx]["src"];
        const { maxLevel, extraZoomLevels } = this.imageViewer.config;
        const magnification = 2 ** extraZoomLevels;

        // Define url and suburl
        const group = url.split("/");
        const sub_url = group[group.length - 2];
        const range = this.channelList.rangeConnector[srcIdx];
        const { color } = this.channelList.colorConnector[srcIdx] || {};
        const viewerChannel = {
            url: url,
            sub_url: sub_url,
            color: color || d3.color("white"),
            range: range || this.imageViewer.numericData.bitRange,
        };
        this.channelList.currentChannels[srcIdx] = viewerChannel;

        this.viewer.addTiledImage({
            tileSource: {
                height: this.imageViewer.config.height * magnification,
                width: this.imageViewer.config.width * magnification,
                maxLevel: extraZoomLevels + maxLevel - 1,
                compositeOperation: "lighter",
                tileWidth: this.imageViewer.config.tileWidth,
                tileHeight: this.imageViewer.config.tileHeight,
                toMagnifiedBounds: toMagnifiedBounds,
                extraZoomLevels: extraZoomLevels,
                toTileBoundary: toTileBoundary,
                getImagePixel: getImagePixel,
                toTileLevels: toTileLevels,
                toIdealTile: toIdealTile,
                toRealTile: toRealTile,
                getTileUrl: getTileUrl,
                getTileKey: getTileKey,
                tileFormat: 16,
                srcIdx: srcIdx,
                src: url,
            },
            // index: 0,
            opacity: 1,
            preload: true,
        });
    }

    /**
     * @function channel_remove - remove channel from multichannel rendering
     * @param srcIdx - integer id of channel to remove
     */
    channel_remove(srcIdx) {
        const img_count = this.viewer.world.getItemCount();

        // remove channel
        if (srcIdx in this.channelList.currentChannels) {
            // remove channel - first find it
            for (let i = 0; i < img_count; i = i + 1) {
                const url = this.viewer.world.getItemAt(i).source.src;
                if (url === this.channelList.currentChannels[srcIdx]?.url) {
                    this.viewer.world.removeItem(this.viewer.world.getItemAt(i));
                    delete this.channelList.currentChannels[srcIdx];
                    break;
                }
            }
        }
    }

    /**
     * @function evaluateTF - finds color for value in transfer function
     * @param val - input to transfer function
     * @param tf - colors of transfer function
     * @returns object
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
     */
    force_repaint() {
        // Refilter, redraw
        // this.viewer.forceRefilter();
        this.viewer.forceRedraw();
    }

    /**
     * @function load_label_image
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
                    extraZoomLevels: extraZoomLevels,
                    toTileBoundary: toTileBoundary,
                    getImagePixel: getImagePixel,
                    toTileLevels: toTileLevels,
                    toIdealTile: toIdealTile,
                    toRealTile: toRealTile,
                    getTileUrl: getTileUrl,
                    getTileKey: getTileKey,
                    tileFormat: 32,
                    srcIdx: 0,
                    src: url,
                },
                index: 0,
                opacity: 1,
                success: (e) => {
                    // Open Event is Necessary for ViaWebGl to init
                    self.viewer.raiseEvent("open", e.item);
                },
            });
        } else {
            this.imageViewer.noLabel = true;
        }
    }
}
