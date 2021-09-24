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

    /**
     * @function renderTFWithLabelsMulti
     * Apply TF on multi-channel tile, also accesses the label image
     *
     * @param context
     * @param callback
     * @param tile
     * @returns {Promise<void>}
     */
    renderTFWithLabelsMulti(context, callback, tile) {
        // console.log('L', tile.url);
        //
        // // Ck for tile
        // if (tile == null) {
        //     console.log("No Tile");
        //     callback();
        //     return;
        // }
        // // Render multi-channel image
        // const group = tile.url.split("/");
        // const somePath = group[group.length - 3];
        // let isLabel = group[group.length - 3] == this.imageViewer.labelChannel.sub_url;
        // if (isLabel) {
        //     return;
        // }
        //
        //
        // // Label data
        // let labelTileAdr = '';
        // let labelTile = '';
        // const labelPath = this.imageViewer.labelChannel["sub_url"];
        // labelTileAdr = tile.url.replace(somePath, labelPath);
        // labelTile = this.imageViewer.tileCache[labelTileAdr];
        // let labelTileData = _.get(labelTile, 'data');
        // // Get 24bit label data
        // // If label tile has not loaded, asynchronously load it, waiting for it to load before proceeding
        // if (labelTile == null && !this.imageViewer.noLabel) {
        //     console.log("Missing Label");
        //     await addTile(labelTileAdr);
        //     labelTile = this.imageViewer.tileCache[labelTileAdr];
        //     labelTileData = _.get(labelTile, 'data');
        //     console.log("Loaded Label");
        // }
        // if (!labelTile.converted) {
        //     let int32Array = new Int32Array(labelTile.data.buffer)
        //     this.imageViewer.tileCache[labelTileAdr].data = int32Array;
        //     this.imageViewer.tileCache[labelTileAdr].converted = true;
        // }
        //
        //
        // // Channel data
        // const channelsTileData = [];
        // const tfs = [];
        // const tfs_min = [];
        // const tileurl = tile.url;
        //
        // // Get tfs for channels
        // for (const key in this.viewer_channels) {
        //
        //     const channelIdx = key;
        //
        //     // First check main
        //     const channelPath = this.viewer_channels[channelIdx]["sub_url"];
        //     const channelTileAdr = tileurl.replace(somePath, channelPath);
        //     let channelTile = this.imageViewer.tileCache[channelTileAdr];
        //
        //     if (channelTile == null) {
        //         console.log("Missing Channel")
        //         await addTile(channelTileAdr);
        //         channelTile = this.imageViewer.tileCache[channelTileAdr];
        //         console.log("Loaded Channel")
        //     }
        //     if (!channelTile.converted) {
        //         // Since my data is 32 bit, but the last 16 bits are all 0, view as 32 bit and then convert to 16 bit for size
        //         let uInt16Array = new Uint16Array(new Int32Array(channelTile.data.buffer));
        //         this.imageViewer.tileCache[channelTileAdr].data = uInt16Array;
        //         this.imageViewer.tileCache[channelTileAdr].converted = true;
        //     }
        //     channelsTileData.push(channelTile.data);
        //     tfs.push(this.imageViewer.channelTF[channelIdx]);
        //     tfs_min.push(this.imageViewer.channelTF[channelIdx].min);
        // }
        //
        // // get screen pixels to write into
        // const screenData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        // const pixels = screenData.data;
        //
        //
        // // Init
        // let labelValue = -1;
        // let channelValue = 0;
        // // iterate over all tile pixels
        // for (let i = 0, len = inputTile.width * inputTile.height * 4; i < len; i = i + 4) {
        //     pixels[i] = 0;
        //     pixels[i + 1] = 0;
        //     pixels[i + 2] = 0;
        //     pixels[i + 3] = 255;
        //     // Iterate over all image channels
        //     for (let channel = 0; channel < channelsTileData.length; channel++) {
        //
        //         // get 16 bit image data (stored in G and B channels)
        //         //                channelValue = channelsTileData[channel][i] + (channelsTileData[channel][i + 1] << 8);
        //         channelValue = channelsTileData[channel][i / 4];
        //
        //         // apply TF
        //         const rgb = this.evaluateTF(channelValue, tfs[channel]);
        //
        //         // if (!this.imageViewer.show_subset) { // render everything with TF
        //         if (channelValue >= tfs_min[channel]) {
        //             pixels[i] += rgb[0];
        //             pixels[i + 1] += rgb[1];
        //             pixels[i + 2] += rgb[2];
        //         }
        //         // Render selection ids as highlighted
        //         if ((this.imageViewer.show_selection || this.show_sel) && this.imageViewer.selection.size > 0) {
        //
        //             if (labelTileData) {
        //                 labelValue = labelTileData[i / 4] - 1;
        //             }
        //             if (labelValue !== -1) {
        //                 if (this.imageViewer.selection.has(labelValue)) {
        //                     let color = [255, 255, 255]
        //
        //                     /************************ new */
        //                         // Init grid and tests (4 pts v 8 working for now)
        //                     const grid = [
        //                             i - 4,
        //                             i + 4,
        //                             i - inputTile.width * 4,
        //                             i + inputTile.width * 4
        //                         ];
        //                     const test = [
        //                         i % (inputTile.width * 4) !== 0,
        //                         i % (inputTile.width * 4) !== (inputTile.width - 1) * 4,
        //                         i >= inputTile.width * 4,
        //                         i < inputTile.width * 4 * (inputTile.height - 1)
        //                     ];
        //
        //                     // If outline
        //                     if (this.sel_outlines) {
        //                         // Iterate grid
        //                         for (let j = 0; j < grid.length; j++) {
        //                             // if pass test (not on tile border)
        //                             if (test[j]) {
        //                                 // Neighbor label value
        //                                 const altLabelValue = labelTileData[grid[j] / 4] - 1;
        //                                 // Color
        //                                 if (altLabelValue !== labelValue) {
        //                                     pixels[i] = 255;
        //                                     pixels[i + 1] = 255;
        //                                     pixels[i + 2] = 255;
        //                                     break;
        //                                 }
        //                             }
        //                         }
        //                     } else {
        //                         pixels[i] = color[0];
        //                         pixels[i + 1] = color[1];
        //                         pixels[i + 2] = color[2];
        //                     }
        //                     /************************ newend */
        //                 }
        //             }
        //         }
        //
        //     }
        // }

        // context.putImageData(screenData, 0, 0);
        callback();

    }


}