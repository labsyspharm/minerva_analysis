/**
 * @class PtDotter
 */
export class PtDotter {

    // Class vars
    configs = {
        iconH: 12,
        iconW: 12,
        imageX: [0, 0],
        imageY: [0, 0],
        isOpen: false,
        justOpened: false,
        markerDims: 24,
        snapshotH: 90,
        snapshotW: 90,
        viewerOverlayH: 0,
        viewerOverlayW: 0,
    };
    data = [];
    dataIdsMap = [];
    els = {
        album: null,
        container: null,
        openseadragon: null,
        viewerOverlay: null,
    };
    imageViewer = null;
    snapshotsSubscription = null;
    tools = {
        overlayX: d3.scaleLinear(),
        overlayY: d3.scaleLinear(),
    };

    /**
     * @constructor
     */
    constructor(_parent) {
        this.parent = _parent;

        // Some globals
        this.imageViewer = seaDragonViewer;
    }

    /** 1.
     * @function init
     */
    init() {
    }

    /** 2.
     * @function load
     */
    async load() {

        // Show
        this.configs.isOpen = true;

        //
        this.buildBasicStructure();

        // Set as just opened
        this.configs.justOpened = true;

        // Reset zooms
        this.imageViewer.viewer.viewport.zoomTo(Math.round(this.imageViewer.viewer.viewport.getZoom()));

        // Load Screenshots from the DB
        let dbDots = await dataLayer.loadDots();
        if (dbDots && _.size(dbDots) > 0) {
            this.imageViewer.viewer.lensing.snapshots.album = this.imageViewer.viewer.lensing.snapshots.album.concat(dbDots);
            _.each(dbDots, dot => {
                this.data.push(dot);
                this.dataIdsMap.push(dot.id);
            })
        }


        // Snapshots
        this.snapshotsSubscription = this.imageViewer.viewer.lensing.snapshots.subject.subscribe(datum => {
            this.wrangleSnapshots([datum]);
        });
        console.log("Other Datum", this.imageViewer.viewer.lensing.snapshots.album);
        this.wrangleSnapshots(this.imageViewer.viewer.lensing.snapshots.album);

        // OSD changes
        this.imageViewer.viewer.addHandler('viewport-change', this.eventViewerOnViewportChange.bind(this));


    }

    /** 3.
     * @function destroy
     */
    destroy() {

        // Hide
        this.configs.isOpen = false;

        // Unsubscribe
        this.snapshotsSubscription.unsubscribe();
    }

    /**
     * buildBasicStructure
     */
    buildBasicStructure() {

        // Clear
        this.parent.els.toolboxEl.selectAll('*').remove();

        // Add container
        this.els.container = this.parent.els.toolboxEl.append('div')
            .attr('class', 'toolboxContainer')
        this.els.container.append('h1')
            .text('Dotter');
        this.els.album = this.els.container.append('div')
            .attr('class', 'dotter_album');

    }

    /**
     * wrangleSnapshots
     */
    wrangleSnapshots(data) {

        // Iterate data and form new obj to add to class var
        data.forEach((d, i) => {

            if (!this.dataIdsMap.includes(d.id)) {

                // Add id
                this.dataIdsMap.push(d.id);

                // Init zoom
                let zoom = d.positionData.zoom;
                let zoomAux = d.positionData.zoomAux;

                // Check zoom
                if (this.configs.justOpened && i === data.length - 1) {
                    zoom = this.imageViewer.viewer.viewport.getZoom();
                    zoomAux = this.imageViewer.viewer.lensing.viewer.viewport.getZoom();
                }

                // Data structure
                const obj = {
                    channelsViewerMain: JSON.parse(JSON.stringify(this.imageViewer.viewerManagerVMain.viewerChannels)),
                    channelsViewerAuxi: JSON.parse(JSON.stringify(this.imageViewer.viewerManagerVMain.viewerChannels)),
                    date: d.date,
                    description: '',
                    id: d.id,
                    imageData: d.imgData,
                    lensRadius: d.lensingConfigs.rad,
                    lensShape: d.lensingConfigs.shape,
                    name: '',
                    pointerPositionOnFullImage: d.positionData.posFull,
                    pointerOsdRefPointX: d.positionData.refPoint.x,
                    pointerOsdRefPointY: d.positionData.refPoint.y,
                    zoomViewerMain: d.positionData.zoom,
                    zoomViewerAuxi: d.positionData.zoomAux,
                    zoomViewerMainDisplay: zoom,
                    zoomViewerAuxiDisplay: zoomAux
                };

                // Append to data
                this.data.push(obj);
            }

        });

        // Render snapshots
        this.renderSnapshots();
        this.renderOverlay();
    }

    /**
     * renderOverlay
     */
    renderOverlay() {

        // Get image bounds
        const viewportBounds = this.imageViewer.viewer.viewport.getBounds(true);
        const imageBounds = this.imageViewer.viewer.world.getItemAt(0).viewportToImageRectangle(viewportBounds);
        this.configs.imageX = [imageBounds.x, imageBounds.x + imageBounds.width];
        this.configs.imageY = [imageBounds.y, imageBounds.y + imageBounds.height];

        // Get overlay container bounds
        this.els.viewerOverlay = d3.select('#viewerOverlay');
        this.els.openseadragon = d3.select('#openseadragon');
        this.configs.viewerOverlayW = this.els.openseadragon.node().clientWidth;
        this.configs.viewerOverlayH = this.els.openseadragon.node().clientHeight;

        // Set x and y scale
        this.tools.overlayX.domain(this.configs.imageX)
            .range([0, this.configs.viewerOverlayW]);
        this.tools.overlayY.domain(this.configs.imageY)
            .range([0, this.configs.viewerOverlayH]);

        // This vis
        const vis = this;

        // Dots
        this.els.viewerOverlay.selectAll('.dotDrop')
            .data(this.configs.isOpen ? this.data : [])
            .join('canvas')
            .attr('class', 'dotDrop')
            .style('position', 'absolute')
            .style('border', '1px solid white')
            .style('border-radius', d => d.lensShape === 'circle' ? '50%' : '0')
            .style('padding', `1px`)
            .style('pointer-events', 'none')
            .each(function (d) {

                // Canvas el
                const canvas = d3.select(this);

                // Get main viewer zoom
                const currentZoom = vis.imageViewer.viewer.viewport.getZoom();
                const multiplier = currentZoom / d.zoomViewerMainDisplay;

                // W and H
                const w = (d.imageData.width / window.devicePixelRatio) * multiplier;
                const h = (d.imageData.height / window.devicePixelRatio) * multiplier;
                canvas
                    .attr('width', w * window.devicePixelRatio)
                    .attr('height', h * window.devicePixelRatio)
                    .style('width', `${w}px`)
                    .style('height', `${h}px`)

                // Translate to overlay
                canvas.style('left',
                    `${vis.tools.overlayX(d.pointerPositionOnFullImage[0]) - (w / 2)}px`);
                canvas.style('top',
                    `${vis.tools.overlayY(d.pointerPositionOnFullImage[1]) - (h / 2)}px`)

                // Change opacity if magnifying
                if (multiplier > 1) {
                    canvas.style('opacity', `${1 / multiplier}`);
                } else {
                    canvas.style('opacity', `1`);
                }

                // Draw
                const context = canvas.node().getContext('2d');
                context.save();
                createImageBitmap(d.imageData).then(imgBitmap => {
                    context.clearRect(0, 0, w * window.devicePixelRatio, h * window.devicePixelRatio)
                    context.scale(multiplier, multiplier)
                    context.drawImage(imgBitmap, 0, 0);
                    context.restore();
                }).catch(err => console.log(err));

            });

        // Markers
        this.els.viewerOverlay.selectAll('.dotMarker')
            .data(this.configs.isOpen ? this.data : [])
            .join('img')
            .attr('class', 'dotMarker')
            .attr('src', '../client/assets/cycif-marker-mobile.svg')
            .attr('alt', 'Dot marker')
            .style('position', 'absolute')
            .style('height', `${this.configs.markerDims}px`)
            .style('point-events', 'none')
            .each(function (d) {

                const img = d3.select(this);

                // Translate to overlay
                img.style('left',
                    `${vis.tools.overlayX(d.pointerPositionOnFullImage[0]) - vis.configs.markerDims / 2}px`);
                img.style('top',
                    `${vis.tools.overlayY(d.pointerPositionOnFullImage[1]) - vis.configs.markerDims}px`)


            })
            .on('click', this.onMarkerClick.bind(this));
    }

    /**
     * renderSnapshots
     */
    renderSnapshots(redraw = false) {

        const vis = this;
        let data;
        // const data = this.imageViewer.viewer.lensing.snapshots.album;
        if (redraw) {
            data = [];
        } else {
            data = this.data;
        }

        this.els.album.selectAll('.dotter_block')
            .data(data)
            .join(
                enter => enter.append('div')
                    .attr('class', 'dotter_block')
                    .each(function (d, i) {
                        console.log("Dat", d, i);
                        const div = d3.select(this);

                        const canvasContainer = div.append('div')
                            .attr('class', 'dotter_block_canvas_container')
                            .style('width', `${vis.configs.snapshotW + 2}px`)
                            .style('height', `${vis.configs.snapshotH + 2}px`)
                            .on('click', vis.eventCanvasOnClick.bind(vis));

                        const canvas = canvasContainer.append('canvas')
                            .attr('class', 'dotter_block_canvas')
                            .attr('width', vis.configs.snapshotW * window.devicePixelRatio)
                            .attr('height', vis.configs.snapshotH * window.devicePixelRatio)
                            .style('width', `${vis.configs.snapshotW}px`)
                            .style('height', `${vis.configs.snapshotH}px`)
                            .classed('borderRadius50p', d.lensShape === 'circle');

                        const ctx = canvas.node().getContext('2d');

                        createImageBitmap(d.imageData).then(imgBitmap => {
                            ctx.drawImage(imgBitmap,
                                0,
                                0,
                                vis.configs.snapshotW * window.devicePixelRatio,
                                vis.configs.snapshotH * window.devicePixelRatio,
                            );
                        });

                        const contentContainer = div.append('div')
                            .attr('class', 'dotter_block_content_container');

                        contentContainer.append('h2')
                            .text(d.id);

                        contentContainer.append('p')
                            .text(d.date.toDateString());

                        contentContainer.append('textarea')
                            .attr('class', 'textarea_name')
                            .attr('placeholder', 'Name');

                        contentContainer.append('textarea')
                            .attr('class', 'textarea_descript')
                            .attr('placeholder', 'Description');

                        const iconContainer = contentContainer.append('div')
                            .attr('class', 'dotter_block_icon_container');

                        iconContainer.append('a')
                            .attr('class', (d, i) => {
                                if (d.fromDb) {
                                    return 'dotter_block_icon_container_from_db';
                                } else {
                                    return 'dotter_block_icon_container_save';
                                }
                            })
                            .text((d, i) => {
                                if (d.fromDb) {
                                    return 'DELETE FROM DB';
                                } else {
                                    return 'SAVE';
                                }
                            })
                            .on('click', vis.saveToDb.bind(vis));

                        // iconContainer.append('img')
                        //     .attr('src', '../static/frontend/assets/cycif-notes.svg')
                        //     .attr('alt', 'Notes')
                        //     .style('width', `${vis.configs.iconW}px`)
                        //     .style('height', `${vis.configs.iconH}px`);

                        // iconContainer.append('img')
                        //     .attr('src', '../client/assets/cycif-download.svg')
                        //     .attr('alt', 'Download')
                        //     .style('width', `${vis.configs.iconW}px`)
                        //     .style('height', `${vis.configs.iconH}px`);

                        // iconContainer.append('img')
                        //     .attr('src', '../client/assets/cycif-remove.svg')
                        //     .attr('alt', 'Remove')
                        //     .style('width', `${vis.configs.iconW}px`)
                        //     .style('height', `${vis.configs.iconH}px`);

                    }),
                update => update,
                //     .each(function (dat, i) {
                //         const div = d3.select(this);
                //         // div.select('.dotter_block_icon_container')
                //         //     .select('a')
                //         //     .attr('class', () => {
                //         //         if (dat.fromDb) {
                //         //             return 'dotter_block_icon_container_from_db';
                //         //         } else {
                //         //             return 'dotter_block_icon_container_save';
                //         //         }
                //         //     })
                //         //     .text(() => {
                //         //         if (dat.fromDb) {
                //         //             return 'DELETE FROM DB';
                //         //         } else {
                //         //             return 'SAVE';
                //         //         }
                //         //     })
                //     }),

                exit => exit
                    .call(e => e.remove())
            );

    }

    /**
     * eventCanvasOnClick
     */
    eventCanvasOnClick(e, d) {

        // Zoom main viewer
        const newPt = new OpenSeadragon.Point({x: 0, y: 0})
        newPt.x = d.pointerOsdRefPointX
        newPt.y = d.pointerOsdRefPointY
        const viewportPt = this.imageViewer.viewer.world.getItemAt(0).imageToViewportCoordinates(
            new OpenSeadragon.Point({x: d.pointerPositionOnFullImage[0], y: d.pointerPositionOnFullImage[1]}))
        this.imageViewer.viewerManagerVMain.viewer.viewport.panTo(newPt);
        this.imageViewer.viewerManagerVMain.viewer.viewport.zoomTo(d.zoomViewerMainDisplay);

        // Zoom aux viewer
        this.imageViewer.viewerManagerVAuxi.viewer.viewport.zoomTo(d.zoomViewerAuxiDisplay);

    }

    /**
     * eventViewerOnViewportChange
     */
    eventViewerOnViewportChange() {
        this.renderOverlay();
    }

    /**
     * eventViewerOKeydown
     */
    eventViewerOnKeydown() {
        this.renderOverlay();
    }

    /**
     * onMarkerClick
     */
    onMarkerClick(e, d) {

        // Clear old TODO - this is pretty inefficient (don't remove/load already matched channels
        const itemsMainOld = Object.keys(this.imageViewer.viewerManagerVMain.viewerChannels);
        itemsMainOld.forEach(i => {
            this.imageViewer.viewerManagerVMain.channelRemove(+i);
        })
        const itemsAuxiOld = Object.keys(this.imageViewer.viewerManagerVAuxi.viewerChannels);
        itemsAuxiOld.forEach(i => {
            this.imageViewer.viewerManagerVAuxi.channelRemove(+i);
        })

        // Add new
        const itemsMainNew = Object.keys(d.channelsViewerMain);
        itemsMainNew.forEach(i => {
            this.imageViewer.viewerManagerVMain.colorConnector[i] = {
                color: d.channelsViewerMain[i].color
            }
            this.imageViewer.viewerManagerVMain.channelAdd(+i);
        })
        const itemsAuxiNew = Object.keys(d.channelsViewerMain);
        itemsAuxiNew.forEach(i => {
            this.imageViewer.viewerManagerVAuxi.colorConnector[i] = {
                color: d.channelsViewerAuxi[i].color
            }
            this.imageViewer.viewerManagerVAuxi.channelAdd(+i);
        })

        // Update configurations in lensing
        this.imageViewer.viewer.lensing.events.remoteLensUpdate({
            lensingConfigs: {
                rad: d.lensRadius,
                shape: d.lensShape
            }
        });
    }

    /**
     * saveToDb
     */
    async saveToDb(e, d) {
        if (!d.fromDb) {
            await dataLayer.saveDot(d);
            _.find(this.imageViewer.viewer.lensing.snapshots.album, elem => elem.id == d.id).fromDb = true;
            _.find(this.data, elem => elem.id == d.id).fromDb = true;
        } else {
            await dataLayer.deleteDot(d.id);
            this.imageViewer.viewer.lensing.snapshots.album = _.remove(this.imageViewer.viewer.lensing.snapshots.album, elem => {
                return elem.id != d.id;
            })
            this.data = _.remove(this.data, elem => {
                return elem.id != d.id
            })
        }
        this.renderSnapshots(true);
        this.renderSnapshots();

    }


}