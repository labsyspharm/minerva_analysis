/**
 * viewer.js.
 *
 * @class ImageViewer to render multiplexed imaging data (based on OpenSeadragon)
 */

/* todo
 1. major - the viewer managers should not be looking up the same renderTF
 */

class ImageViewer {
    // Vars
    viewerManagers = [];

    /**
     * Constructor for ImageViewer.
     *
     * @param config - the cinfiguration file (json)
     * @param imgMetadata - image metadata from ome
     * @param numericData - custom numeric data layer
     * @param eventHandler - the event handler for distributing interface and data updates
     */
    constructor(config, imgMetadata, numericData, eventHandler) {
        this.ready = false;
        this.config = config;
        this.gatingList = null;
        this.channelList = null;
        this.imgMetadata = imgMetadata;
        this.numericData = numericData;
        this.eventHandler = eventHandler;
        this._cacheKeys = {};
        this.pickedId = -1;

        // Viewer
        this.viewer = {};

        // OSD plugins
        this.show_scalebar = true;

        // Transfer function constant
        this.numTFBins = 1024;

        // Transfer function per channel (min,max, start color, end color)
        this.channelTF = [];

        for (let i = 0; i < this.config["imageData"].length; i = i + 1) {
            const start_color = d3.rgb(0, 0, 0);
            const end_color = d3.rgb(255, 255, 255);

            const tf_def = this.createTFArray(0, 65535, start_color, end_color, this.numTFBins);
            tf_def.name = this.config["imageData"][i].name;

            this.channelTF.push(tf_def);
        }

        // Applying TF to selection, subset, or all
        this.show_subset = false;
        this.show_selection = true;

        // Hide Loader
        document.getElementById("openseadragon_loader").style.display = "none";

        // Config viewer
        const viewer_config = {
            id: "openseadragon",
            prefixUrl: "/client/external/openseadragon-bin-2.4.0/openseadragon-flat-toolbar-icons-master/images/",
            maxZoomPixelRatio: 15,
            compositeOperation: "lighter",
            loadTilesWithAjax: true,
            immediateRender: false,
            maxImageCacheCount: 100,
            timeout: 90000,
            collectionMode: false,
            preload: false,
            homeFillsViewer: true,
            visibilityRatio: 1.0,
        };

        // Instantiate viewer with the ViaWebGL Version of OSD
        this.viewer = viaWebGL.OpenSeadragon(viewer_config);
        this.addScaleBar();

        // Flexible use of textures
        const constantTextures = ["ids", "centers", "gatings"];
        const otherOffset = 32 - constantTextures.length;
        const seaGL = new viaWebGL.openSeadragonGL(this.viewer);
        const nMarkers = 4;
        const markerOffset = otherOffset - nMarkers;
        const nTiles = markerOffset;
        const tileTextureKeys = [...Array(nTiles).keys()];
        const markerTextureKeys = [...Array(nMarkers).keys()];
        seaGL.viaGL._otherOffset = otherOffset;
        seaGL.viaGL._markerOffset = markerOffset;
        seaGL.viaGL._tileTextures = tileTextureKeys.map(() => "");
        seaGL.viaGL._markerTextures = markerTextureKeys.map(() => "");
        seaGL.viaGL._constantTextures = constantTextures;
        seaGL.viaGL._activeMarkerTexture = 0;
        seaGL.viaGL._nextMarkerTexture = 0;
        seaGL.viaGL._activeTileTexture = 0;
        seaGL.viaGL._nextTileTexture = 0;
        this.viaGL = seaGL.viaGL;

        const getTileTexture = this.getTileTexture.bind(this);
        const indexOfTexture = this.indexOfTexture.bind(this);
        const selectTexture = this.selectTexture.bind(this);

        seaGL.viaGL.loadArray = function (e, w, h) {
            // Allow for custom drawing in webGL
            var gl = this.gl;
            const { source } = e.tiledImage;
            const tileArgs = [e.tile.level, e.tile.x, e.tile.y];
            const format = e.tile._format || `u${source.format}`;
            const okFormat = ["u16", "u32"].includes(format);
            const tKey = source.getTileKey(...tileArgs);
            const pixels = e.tile._array;

            // Clear before starting all the draw calls
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            // Reset texture for GLSL
            const oldKey = getTileTexture();
            // Only transfer texture if needed
            if (oldKey != tKey && okFormat) {
                this._activeTileTexture = indexOfTexture(tKey, "T");
                selectTexture(gl, this.texture, this._activeTileTexture);
                const textureArgs = {
                    u16: [gl.RG8UI, w, h, 0, gl.RG_INTEGER],
                    u32: [gl.RGBA8UI, w, h, 0, gl.RGBA_INTEGER],
                }[format];

                // Send the tile into the texture.
                gl.texImage2D(gl.TEXTURE_2D, 0, ...textureArgs, gl.UNSIGNED_BYTE, pixels);
            }

            this.gl_arguments.tile_shape_2fv = new Float32Array([w, h]);

            // Call gl-drawing after loading
            this["gl-drawing"].call(this);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            return gl.canvas;
        };

        seaGL.vShader = "/client/src/shaders/vert.glsl";
        seaGL.fShader = "/client/src/shaders/frag.glsl";

        // Overwrite tile-drawing method
        seaGL.io["tile-drawing"] = function (e) {
            var w = e.rendered.canvas.width;
            var h = e.rendered.canvas.height;
            var gl_w = this.viaGL.width;
            var gl_h = this.viaGL.height;

            // Render a webGL canvas to an input canvas
            var output = this.viaGL.loadArray(e, w, h);
            e.rendered.drawImage(output, 0, 0, gl_w, gl_h, 0, 0, w, h);
        };

        const { floatRange } = this.numericData;
        const findCurrentChannel = this.findCurrentChannel.bind(this);
        const selectCenterProps = this.selectCenterProps.bind(this);
        // Draw handler for viaWebGL
        seaGL.addHandler("tile-drawing", async function (callback, e) {
            // Read parameters from each tile
            const { source } = e.tiledImage;
            const { tileFormat } = source;
            const group = e.tile.url.split("/");
            const sub_url = group[group.length - 3];
            const centerProps = selectCenterProps(e.tile, source);

            const via = this.viaGL;

            if (tileFormat != 32) {
                const channel = findCurrentChannel(sub_url);
                const range = _.get(channel, "range", floatRange);
                const color = _.get(channel, "color", d3.color("white"));
                const floatColor = toFloatColor(color);
                // Store channel color and range to send to shader
                via.gl_arguments = {
                    ...centerProps,
                    centers: [],
                    id_end_1i: 0,
                    color_3fv: new Float32Array(floatColor),
                    range_2fv: new Float32Array(range),
                    fmt_1i: 16,
                };
            } else {
                if (!e.tile._array) {
                    console.log("Missing Array", e.tile.url);
                }
                // Use new parameters for this tile
                via.gl_arguments = {
                    ...centerProps,
                    color_3fv: new Float32Array([1, 1, 1]),
                    range_2fv: new Float32Array([0, 1]),
                    fmt_1i: 32,
                };
            }

            // Clear the rendered tile
            var w = e.rendered.canvas.width;
            var h = e.rendered.canvas.height;
            e.rendered.fillStyle = "black";
            e.rendered.fillRect(0, 0, w, h);

            // Start webGL rendering
            callback(e);
        });

        seaGL.addHandler("gl-drawing", function () {
            const args = this.gl_arguments;

            // Send color and range to shader
            this.gl.uniform2fv(this.u_tile_shape, args.tile_shape_2fv);
            this.gl.uniform4iv(this.u_marker_sample, args.marker_sample_4iv);
            this.gl.uniform2iv(this.u_magnitude_shape, args.magnitude_2iv);
            this.gl.uniform1f(this.u_tile_fraction, args.tile_fraction_1f);
            this.gl.uniform1f(this.u_tile_scale, args.tile_scale_1f);
            this.gl.uniform1f(this.u_pie_radius, args.pie_radius_1f);
            this.gl.uniform1i(this.u_picked_id, args.picked_id_1i);
            this.gl.uniform2fv(this.u_tile_origin, args.origin_2fv);
            this.gl.uniform3fv(this.u_tile_color, args.color_3fv);
            this.gl.uniform2fv(this.u_tile_range, args.range_2fv);
            this.gl.uniform2iv(this.u_draw_mode, args.modes_2i);
            this.gl.uniform2fv(this.u_x_bounds, args.x_bounds_2fv);
            this.gl.uniform2fv(this.u_y_bounds, args.y_bounds_2fv);
            this.gl.uniform1i(this.u_tile_fmt, args.fmt_1i);
            this.gl.uniform1i(this.u_id_end, args.id_end_1i);
        });

        seaGL.addHandler("gl-loaded", function (program) {
            // Uniform variables for coloring
            this.u_ids_shape = this.gl.getUniformLocation(program, "u_ids_shape");
            this.u_tile_shape = this.gl.getUniformLocation(program, "u_tile_shape");
            this.u_gating_shape = this.gl.getUniformLocation(program, "u_gating_shape");
            this.u_center_shape = this.gl.getUniformLocation(program, "u_center_shape");
            this.u_marker_sample = this.gl.getUniformLocation(program, "u_marker_sample");
            this.u_magnitude_shape = this.gl.getUniformLocation(program, "u_magnitude_shape");
            this.u_tile_fraction = this.gl.getUniformLocation(program, "u_tile_fraction");
            this.u_tile_scale = this.gl.getUniformLocation(program, "u_tile_scale");
            this.u_pie_radius = this.gl.getUniformLocation(program, "u_pie_radius");
            this.u_tile_origin = this.gl.getUniformLocation(program, "u_tile_origin");
            this.u_tile_range = this.gl.getUniformLocation(program, "u_tile_range");
            this.u_tile_color = this.gl.getUniformLocation(program, "u_tile_color");
            this.u_draw_mode = this.gl.getUniformLocation(program, "u_draw_mode");
            this.u_x_bounds = this.gl.getUniformLocation(program, "u_x_bounds");
            this.u_y_bounds = this.gl.getUniformLocation(program, "u_y_bounds");
            this.u_tile_fmt = this.gl.getUniformLocation(program, "u_tile_fmt");
            this.u_picked_id = this.gl.getUniformLocation(program, "u_picked_id");
            this.u_id_end = this.gl.getUniformLocation(program, "u_id_end");

            // Texture for colormap
            const u_ids = this.gl.getUniformLocation(program, "u_ids");
            const u_gatings = this.gl.getUniformLocation(program, "u_gatings");
            const u_centers = this.gl.getUniformLocation(program, "u_centers");
            this.gl.uniform1i(u_ids, indexOfTexture("ids", null));
            this.gl.uniform1i(u_gatings, indexOfTexture("gatings", null));
            this.gl.uniform1i(u_centers, indexOfTexture("centers", null));
            for (const i of [0, 1, 2, 3]) {
                const u_mag_i = this.gl.getUniformLocation(program, `u_mag_${i}`);
                this.gl.uniform1i(u_mag_i, i + this._markerOffset);
            }
        });

        const matchTile = (e, { x, y, level }) => {
            const grid = e.tiledImage.tilesMatrix[level];
            return ((grid || {})[x] || {})[y] || {};
        };

        const forceRepaint = this.forceRepaint.bind(this);
        seaGL.addHandler("tile-loaded", (callback, e) => {
            const { source } = e.tiledImage;
            const { tileFormat } = source;
            try {
                e.tile._blobUrl = e.image?.src;
                if (tileFormat == 32) {
                    e.tile._isLabel = true;
                    if (!e.tile?._array && e.image?._array) {
                        const responseArray = e.tileRequest?.response || e.image._array;
                        const pngBuffer = new Buffer(responseArray);
                        const pngArray = PNG.sync.read(pngBuffer, { colortype: 0 });
                        e.tile._array = new Int32Array(pngArray.data.buffer);
                    }
                }
                // Trigger loading of image
                const tileArgs = [e.tile.level, e.tile.x, e.tile.y];
                const tl = source.toTileLevels(...tileArgs);
                if (tl.relativeImageScale < 1) {
                    const tile = matchTile(e, tl.outputTile);
                    if (tile?._array && tile?._format) {
                        e.tile._format = tile._format;
                        e.tile._array = tile._array;
                    }
                } else {
                    return callback(e);
                }
            } catch (err) {
                console.log("Load Error, Refreshing", err, e.tile.url);
                forceRepaint();
            }
        });

        this.viewer.addHandler("tile-drawn", (e) => {
            let count = _.size(e.tiledImage._tileCache._tilesLoaded);
            e.tiledImage._tileCache._imagesLoadedCount = count;
            const canvas = e.eventSource.drawer.canvas;
            const context = canvas.getContext("2d");
            context.mozImageSmoothingEnabled = false;
            context.webkitImageSmoothingEnabled = false;
            context.msImageSmoothingEnabled = false;
            context.imageSmoothingEnabled = false;
        });

        this.viewer.addHandler("tile-unloaded", (e) => {
            if (e.tile._blobUrl) {
                (window.URL || window.webkitURL).revokeObjectURL(e.tile._blobUrl);
            }
            delete e.tile._array;
        });

        seaGL.init();

        this.viewer.scalebar({
            location: 3,
            minWidth: "100px",
            type: "Microscopy",
            stayInsideImage: true,
            pixelsPerMeter: 0,
            fontColor: "rgb(255, 255, 255)",
            color: "rgb(255, 255, 255)",
        });

        // Add listener for scalebar
        const controls_scalebar = document.querySelector("#controls_scalebar");
        controls_scalebar.addEventListener("change", (e) => {
            this.show_scalebar = e.target.checked;
            this.eventHandler.trigger(ImageViewer.events.addScaleBar);
        });

        // Add event mouse handler (cell selection)
        this.viewer.addHandler("canvas-nonprimary-press", (e) => {
            // Right click (cell selection)
            if (event.button === 2) {
                const { numericData } = this;
                const { source } = e.eventSource;
                const tiledImage = this.viewer.world.getItemAt(0);
                const imageCoords = source.getImagePixel(tiledImage, e.position);
                return numericData.getNearestCell(...imageCoords).then((item) => {
                    if (item !== null && item !== undefined) {
                        // Check if user is doing multi-selection or not
                        let clearPriors = true;
                        if (e.originalEvent.ctrlKey) {
                            clearPriors = false;
                        }
                        // Trigger event
                        const imageClick = ImageViewer.events.imageClickedMultiSel;
                        this.eventHandler.trigger(imageClick, { item, clearPriors });
                    }
                });
            }
        });
    }

    /**
     * @function init - initializes OSD channel and gating options
     * @param viewerManager - Viewer Manager Instance
     * @param channelList - ChannelList instance
     * @param gatingList - CSVGatingList instance
     * @param centers - List of image pixel coordinates per cell
     * @param ids - List of integer ids per cell
     */
    async init(viewerManager, channelList, gatingList, centers, ids) {
        this.channelList = channelList;
        this.gatingList = gatingList;
        // Instantiate viewer managers
        this.viewerManagerVMain = viewerManager;
        this.viewerManagers.push(this.viewerManagerVMain);
        const via = this.viaGL;
        via.texture_mag = [via.gl.createTexture(), via.gl.createTexture(), via.gl.createTexture(), via.gl.createTexture()];
        via.texture_ids = via.gl.createTexture();
        via.texture_mask = via.gl.createTexture();
        via.texture_gatings = via.gl.createTexture();
        via.texture_centers = via.gl.createTexture();
        this.bindCenters(via, centers);
        this.bindLabels(via, ids);
        this.idCount = ids.length;
        this.ready = true;
        await this.forceRepaint();
    }

    /**
     * @function indexOfTexture - return integer for named texture
     * @param label - the texture key label
     * @param scope - type of texture
     * @returns number
     */
    indexOfTexture(label, scope = null) {
        const via = this.viaGL;
        // image tiles
        if (scope == "T") {
            const index = via._tileTextures.indexOf(label);
            if (index > -1) {
                return index;
            }
            const newIndex = via._nextTileTexture;
            const maximum = via._tileTextures.length;
            via._nextTileTexture = (newIndex + 1) % maximum;
            via._tileTextures[newIndex] = label;
            return newIndex;
        }
        // magnitudes
        if (scope == "M") {
            const index = via._markerTextures.indexOf(label);
            if (index > -1) {
                return index;
            }
            const newIndex = via._nextMarkerTexture;
            const maximum = via._markerTextures.length;
            via._nextMarkerTexture = (newIndex + 1) % maximum;
            via._markerTextures[newIndex] = label;
            return newIndex + via._markerOffset;
        }
        // other
        const index = via._constantTextures.indexOf(label);
        if (index > -1) {
            return index + via._otherOffset;
        }
        return -1;
    }

    /**
     * @function getTileTexture - Most recently bound tile texture label.
     * @returns string
     */
    getTileTexture() {
        const via = this.viaGL;
        return via._tileTextures[via._activeTileTexture];
    }

    /**
     * @function findMarkerTexture - Check if texture label is active.
     * @param label - marker texture label
     * @returns number
     */
    findMarkerTexture(label) {
        const via = this.viaGL;
        return via._markerTextures.indexOf(label);
    }

    /**
     * @function findCurrentChannel - Return given channel for partial url
     * @param sub_url - partial url
     * @returns - current channel
     */
    findCurrentChannel(sub_url) {
        const channels = Object.values(this.currentChannels);
        return channels.find((e) => e.sub_url == sub_url);
    }

    /**
     * Flag for webGL rendering.
     *
     * @type {boolean}
     */
    get ready() {
        return this._ready || false;
    }

    set ready(bool) {
        this._ready = bool;
        this.viewerManagers.forEach(({ viewer }) => {
            viewer.world._needsDraw = bool;
        });
    }

    /**
     * Flags for mode of webGL rendering.
     *
     * @typedef {object} ModeFlags
     * @property {boolean} edge - render outlines
     * @property {boolean} or - render pie charts
     * @type {ModeFlags}
     */
    get modeFlags() {
        return {
            edge: !!this.viewerManagerVMain?.sel_outlines,
            or: this.gatingList?.eval_mode == "or",
        };
    }

    /**
     * Gating Keys for webGL rendering.
     *
     * @type {Array}
     */
    get gatingKeys() {
        const keys = Object.keys(this.gatingSelections);
        return [...keys.sort()];
    }

    /**
     * Gating selections.
     *
     * @type {Array}
     */
    get gatingSelections() {
        return this.gatingList?.selections || {};
    }

    /**
     * Channel selections.
     *
     * @type {Array}
     */
    get currentChannels() {
        return this.channelList.currentChannels || {};
    }

    /**
     * @function toCacheKey - generate cache keys of gl properties
     * @param keys - active marker channels
     * @param markerLists - data for each marker
     * @returns string
     */
    toCacheKey(keys, markerLists) {
        const precisions = [2 ** 25, 2 ** 25, 255, 255, 255];
        const tuples = keys.map((channel, i) => {
            const idx = 1 + this.selectMaskIndex(channel);
            const keyData = markerLists[i] || [];
            const hashes = keyData.map((r, j) => {
                // use precision for each item
                const integral = r * precisions[j];
                return parseInt(integral).toString(36);
            });
            return [idx, ...hashes].join("-");
        });
        return tuples.join("-");
    }

    /**
     * Cache key for gating webGL buffer.
     *
     * @type {string}
     */

    get gatingCacheKey() {
        return this._cacheKeys.gating;
    }

    set gatingCacheKey(key) {
        this._cacheKeys.gating = key;
    }

    /**
     * Cache key for most webGL buffers.
     *
     * @type {string}
     */

    get markerCacheKey() {
        return this._cacheKeys.main;
    }

    set markerCacheKey(key) {
        this._cacheKeys.main = key;
    }

    /**
     * @function loadBuffers - loads segmentation mask data to WebGL
     */
    async loadBuffers() {
        const keys = this.gatingKeys;
        const gatingLists = this.selectGatings(keys);
        const changes = this.updateCache(keys, gatingLists);
        const { markersChanged, gatingChanged } = changes;

        // Bind buffers per-channel
        if (gatingChanged) {
            const gatings = [];
            for (const gating of gatingLists) {
                for (const gatingValue of gating) {
                    gatings.push(gatingValue);
                }
            }
            this.bindGatings(this.viaGL, gatings, 5);
        }
        // Bind or-mode buffers per-cell
        if (markersChanged) {
            const newKeys = keys.filter((k) => {
                return this.findMarkerTexture(k) == -1;
            });
            const m = await this.numericData.getAllFloat32Entries(newKeys);
            const nNew = newKeys.length;
            newKeys.forEach((k, ki) => {
                const mk = m.filter((_, i) => i % nNew == ki);
                // Attempt to bind marker magnitude texture
                try {
                    this.bindMagnitudes(this.viaGL, mk, k);
                } catch (e) {
                    if (e instanceof TypeError) {
                        console.warn(`Unable to bind ${k} marker texture.`);
                    } else {
                        throw e;
                    }
                }
            });
        }
    }

    /**
     * @function selectCenterProps - return cell centers properties
     * @param tile - openseadragon tile
     * @param source - openseadragon tile source
     * @typedef {object} CenterProps
     * @property {number} picked_id_1i - specific id to pick
     * @property {number} pie_radius_1f - radius of or-mode circles
     * @property {number} magnitude_2iv - the shape of each magnitude array
     * @property {number} id_end_1i - the last id in list of ids
     * @property {number} marker_sample_4iv - indices of magnitudes
     * @property {number} modes_2i - the currently active mode flags
     * @property {number} tile_fraction_1f - subtile fraction <=1
     * @property {number} tile_scale_1f - image tile scale >=1
     * @property {Array} x_bounds_2fv - subtile start/end in x
     * @property {Array} y_bounds_2fv - subtile start/end in y
     * @property {Array} origin_2fv - origin at texture resolution
     * @returns CenterProps
     */
    selectCenterProps(tile, source) {
        const via = this.viaGL;
        const modes = this.modeFlags;
        const w = this.config.tileWidth;
        const h = this.config.tileHeight;
        const lastId = (this.idCount || 0) - 1;
        const tileArgs = [tile.level, tile.x, tile.y];
        const tl = source.toTileLevels(...tileArgs);
        const { outputTile, relativeImageScale } = tl;
        const origin = [outputTile.x * w, outputTile.y * h];
        const bounds = source.toMagnifiedBounds(...tileArgs);
        // Assume uniform shape of all magnitude buffers
        const magnitude_2iv = this.toTextureShape(via.gl, this.idCount);
        const markerSamples = [0, 1, 2, 3].map((i) => {
            const label = via._markerTextures[i];
            return this.gatingKeys.indexOf(label);
        });
        return {
            pie_radius_1f: 8.5,
            picked_id_1i: this.pickedId,
            magnitude_2iv: magnitude_2iv,
            id_end_1i: Math.max(lastId, 0),
            modes_2i: [modes.edge, modes.or],
            key_end_1i: this.gatingKeys.length,
            marker_sample_4iv: markerSamples,
            tile_scale_1f: Math.max(relativeImageScale, 1.0),
            tile_fraction_1f: Math.min(relativeImageScale, 1.0),
            x_bounds_2fv: new Float32Array(bounds.x),
            y_bounds_2fv: new Float32Array(bounds.y),
            origin_2fv: new Float32Array(origin),
        };
    }

    /**
     * @function selectGatings - select gating ranges
     * @param keys - active marker channels
     * @returns - lists of min, max, r, g, b gating values
     */
    selectGatings(keys) {
        const gatingLists = [];
        const selections = this.gatingSelections;
        for (const key of keys) {
            const range = selections[key].map((x) => parseFloat(x));
            const color = this.selectMaskColor(key);
            const floatColor = toFloatColor(color);
            const gating = range.concat(floatColor);
            gatingLists.push(gating);
        }

        return gatingLists;
    }

    /**
     * @function updateCache - update cache keys
     * @param keys - active marker channels
     * @param gatingLists - lists of min, max, r, g, b gating values
     * @typedef {object} Changes
     * @property {boolean} markersChanged - if marke lists have changed
     * @property {boolean} gatingChanged - if gating parameters changed
     * @returns Changes
     */
    updateCache(keys, gatingLists) {
        const markerCacheKey = this.toCacheKey(keys, []);
        const markersChanged = this.markerCacheKey !== markerCacheKey;
        if (markersChanged) {
            this.markerCacheKey = markerCacheKey;
        }
        const gatingCacheKey = this.toCacheKey(keys, gatingLists);
        const gatingChanged = this.gatingCacheKey !== gatingCacheKey;
        if (gatingChanged) {
            this.gatingCacheKey = gatingCacheKey;
        }

        return { markersChanged, gatingChanged };
    }

    /**
     * @function selectMaskColor - select color for mask
     * @param channel - the channel label
     * @typedef {object} Color
     * @property {number} r - 0-255
     * @property {number} g - 0-255
     * @property {number} b - 0-255
     * @returns Color
     */
    selectMaskColor(channel) {
        const white = {
            r: 255,
            g: 255,
            b: 255,
        };
        if (!channel) {
            return white;
        }
        const channels = this.currentChannels;
        const idxString = (this.selectMaskIndex(channel) + 1).toString();
        if (idxString == "0" || !Object.keys(channels).includes(idxString)) {
            return white;
        }
        const data = channels[idxString];
        return data.color;
    }

    /**
     * @function selectMaskIndex - select index for mask
     * @param channel - the channel label
     * @returns number
     */
    selectMaskIndex(channel) {
        const columns = this.channelList?.columns || [];
        return columns.indexOf(channel);
    }

    /**
     * @function selectTexture - activate a WebGL texture
     * @param gl - the WebGL2 context
     * @param texture - the WebGL2 texture
     * @param idx - the texture index
     */
    selectTexture(gl, texture, idx) {
        if (texture === undefined) {
            throw new TypeError(`Cannot bind undefined to texture ${idx}.`);
        }
        // Set texture for GLSL
        gl.activeTexture(gl["TEXTURE" + idx]);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        // Assign texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }

    /**
     * @function toTextureShape - shape of texture data
     * @param gl - the WebGL2 context
     * @param length - the 1D length of the data
     * @returns Array
     */
    toTextureShape(gl, length) {
        const width = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const height = Math.ceil(length / width);
        return [width, height];
    }

    /**
     * @function packFloat32 - pack Float32 Texture
     * @param a - the texture data as an array
     * @param width - the texture width
     * @param height - the texture height
     * @returns array
     */
    packFloat32(a, width, height) {
        // Create 2D array of pixels
        const full_size = width * height;
        const arr = new ArrayBuffer(4 * full_size);
        const view = new DataView(arr);
        for (const i in a) {
            view.setFloat32(4 * i, a[i], true);
        }
        return new Float32Array(arr);
    }

    /**
     * @function packUint32 - pack Uint32 Texture
     * @param a - the texture data as an array
     * @param width - the texture width
     * @param height - the texture height
     * @returns array
     */
    packUint32(a, width, height) {
        // Create 2D array of pixels
        const full_size = width * height;
        const arr = new ArrayBuffer(4 * full_size);
        const view = new DataView(arr);
        for (const i in a) {
            view.setUint32(4 * i, a[i], true);
        }
        return new Uint8Array(arr);
    }

    /**
     * @function setIntegerTexture - set an integer texture
     * @param gl - the WebGL2 context
     * @param idx - texture index
     * @param texture - the WebGL2 texture
     * @param values - the texture data as 2d array
     */
    setIntegerTexture(gl, idx, texture, values) {
        const [width, height] = this.toTextureShape(gl, values.length);
        const pixels = this.packUint32(values, width, height);
        // Set texture for GLSL
        this.selectTexture(gl, texture, idx);
        // Send an empty array to the texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, width, height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, pixels);
    }

    /**
     * @function setFloatTexture - set a floating point texture
     * @param gl - the WebGL2 context
     * @param idx - texture index
     * @param texture - the WebGL2 texture
     * @param values - the texture data as 2d array
     * @param width - the texture width
     * @param height - the texture height
     */
    setFloatTexture(gl, idx, texture, values, width, height) {
        this.selectTexture(gl, texture, idx);
        const pixels = this.packFloat32(values, width, height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, pixels);
    }

    /**
     * @function bindLabels - bind segmentation mask ids
     * @param via - the viaGL context
     * @param values - the texture data as 2d array
     */
    bindLabels(via, values) {
        // Add id mask map
        const idx = this.indexOfTexture("ids", null);
        const ids_2iv = this.toTextureShape(via.gl, values.length);
        via.gl.uniform2iv(via.u_ids_shape, ids_2iv);
        this.setIntegerTexture(via.gl, idx, via.texture_ids, values);
    }

    /**
     * @function bindMagnitudes - bind segmentation mask magnitudes
     * @param via - the viaGL context
     * @param values - the texture data as 2d array
     * @param key - the marker label
     */
    bindMagnitudes(via, values, key) {
        // Add a mask magnitude map
        const idx = this.indexOfTexture(key, "M");
        const texture = via.texture_mag[idx - via._markerOffset];
        const [width, height] = this.toTextureShape(via.gl, values.length);
        this.setFloatTexture(via.gl, idx, texture, values, width, height);
    }

    /**
     * @function bindCenters - bind segmentation mask centers
     * @param via - the viaGL context
     * @param values - the texture data as 2d array
     */
    bindCenters(via, values) {
        // Add a mask center map
        const idx = this.indexOfTexture("centers", null);
        const [width, height] = this.toTextureShape(via.gl, values.length);
        via.gl.uniform3iv(via.u_center_shape, [width, height, 2]);
        this.setFloatTexture(via.gl, idx, via.texture_centers, values, width, height);
    }

    /**
     * @function bindGatings - bind segmentation mask gating
     * @param via - the viaGL context
     * @param values - the texture data as 2d array
     * @param width - the texture width
     */
    bindGatings(via, values, width) {
        // Add a mask gating map
        const idx = this.indexOfTexture("gatings", null);
        const height = Math.floor(values.length / width);
        const gating_2iv = [width, height];
        via.gl.uniform2iv(via.u_gating_shape, gating_2iv);
        this.setFloatTexture(via.gl, idx, via.texture_gatings, values, width, height);
    }

    // =================================================================================================================
    // Tile cache management
    // =================================================================================================================

    /**
     * @function createTFArray - creates an array of colors as a transfer/lookup table for pixel values.
     * @param min - the minimum value
     * @param max - the maximum value
     * @param rgb1 - the start color (min)
     * @param rgb2 - the end color (max)
     * @param numBins - the bins for the color interpolation steps
     * @typedef {object} TF
     * @property {Array} tf - color list
     * @property {number} min - min cutoff
     * @property {number} max - max cutoff
     * @property {number} num_bins - number of bins
     * @property {object} start_color - lower limit color
     * @property {object} end_color - upper limit color
     * @returns TF
     */
    createTFArray(min, max, rgb1, rgb2, numBins) {
        const tfArray = [];

        const numBinsF = parseFloat(numBins);
        const col1 = d3.rgb(rgb1);
        const col2 = d3.rgb(rgb2);

        for (let i = 0; i < numBins; i++) {
            const rgbTupel = {};
            const lerpFactor = i / (numBinsF - 1.0);

            rgbTupel.r = col1.r + (col2.r - col1.r) * lerpFactor;
            rgbTupel.g = col1.g + (col2.g - col1.g) * lerpFactor;
            rgbTupel.b = col1.b + (col2.b - col1.b) * lerpFactor;

            const lerpCol = d3.rgb(rgbTupel.r, rgbTupel.g, rgbTupel.b);
            tfArray.push(lerpCol);
        }

        return {
            min: min,
            max: max,
            start_color: rgb1,
            end_color: rgb2,
            num_bins: numBins,
            tf: tfArray,
        };
    }

    /**
     * @function forceRepaint - for all active viewers repaint the canvas
     */
    async forceRepaint() {
        if (this.ready && this.idCount) {
            this.ready = false;
            await this.loadBuffers();
            this.ready = true;
            // Trigger change of full cache
            this.viewerManagers.forEach(({ viewer }) => {
                viewer.forceRedraw();
            });
        }
    }

    /**
     * @function updateActiveChannels
     * @param name - image channel name
     * @param action - "add" or "remove"
     */
    updateActiveChannels(name, action) {
        const channelIdx = imageChannels[name];

        if (action == "add") {
            this.viewerManagers.forEach((vM) => {
                vM.channel_add(channelIdx);
            });
        } else {
            this.viewerManagers.forEach((vM) => {
                vM.channel_remove(channelIdx);
            });
        }

        this.forceRepaint();
    }

    /**
     * @function updateChannelRange
     * @param name - image channel name
     * @param tfmin - minimum
     * @param tfmax - maximum
     */
    updateChannelRange(name, tfmin, tfmax) {
        let range = this.numericData.intRange;
        const channelIdx = imageChannels[name];
        if (this.currentChannels[channelIdx]) {
            let channelRange = [tfmin / range[1], tfmax / range[1]];
            this.currentChannels[channelIdx].range = channelRange;
            this.channelList.rangeConnector[channelIdx] = channelRange;
        }
        this.forceRepaint();
    }

    /**
     * @function updateChannelColors
     * @param name - image channel name
     * @param color - rgb object with values 0-255
     */
    updateChannelColors(name, color) {
        const channelIdx = imageChannels[name];
        if (this.currentChannels[channelIdx]) {
            this.channelList.colorConnector[channelIdx] = { color: color };
            this.currentChannels[channelIdx].color = color;
        }
        this.forceRepaint();
    }

    /**
     * @function updateRenderingMode
     * @param mode - subset or selection
     */
    updateRenderingMode(mode) {
        // Mode is a string: 'show-subset', 'show-selection'
        if (mode === "show-subset") {
            this.show_subset = !this.show_subset;
        }
        if (mode === "show-selection") {
            this.show_selection = !this.show_selection;
        }

        this.forceRepaint();
    }

    addScaleBar() {
        let pixelsPerMeter;
        if (this.show_scalebar) {
            let unitConvert;
            if (this.imgMetadata.physical_size_x_unit === "µm" || this.imgMetadata.physical_size_x_unit === "um") {
                unitConvert = 1000000;
            } else if (this.imgMetadata.physical_size_x_unit === "nm") {
                unitConvert = 1000000000;
            } else if (this.imgMetadata.physical_size_x_unit === "cm") {
                unitConvert = 100;
            } else if (this.imgMetadata.physical_size_x_unit === "m") {
                unitConvert = 1;
            } else {
                unitConvert = 0;
            }
            pixelsPerMeter = unitConvert * this.imgMetadata.physical_size_x;
        } else {
            pixelsPerMeter = 0;
        }

        this.viewer.scalebar({
            pixelsPerMeter: pixelsPerMeter,
        });
    }
}

// Static vars
ImageViewer.events = {
    imageClickedMultiSel: "image_clicked_multi_selection",
    renderingMode: "renderingMode",
    addScaleBar: "addScaleBar",
};

/**
 * @function toFloatColor - convert 0-255 rgb color to 0-1 float array
 * @param color - rgb object with values 0-255
 * @returns array
 */
function toFloatColor(color) {
    return [color.r / 255, color.g / 255, color.b / 255];
}
