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
        snapshotH: 90,
        snapshotW: 90,
        viewerOverlayH: 0,
        viewerOverlayW: 0,
    };
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
    }

    /** 1.
     * @function init
     */
    init() {


    }

    /** 2.
     * @function load
     */
    load() {

        //
        this.buildBasicStructure();

        this.imageViewer = seaDragonViewer;

        // Snapshots
        this.snapshotsSubscription = this.imageViewer.viewer.lensing.snapshots.subject.subscribe(next => {
            this.renderSnapshots();
        });
        this.renderSnapshots()

        // OSD changes
        this.imageViewer.viewer.addHandler('viewport-change', this.eventViewerOnViewportChange.bind(this));


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
     * renderOverlay
     */
    renderOverlay() {

        const data = this.imageViewer.viewer.lensing.snapshots.album;

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
        console.log(this.tools.overlayX.domain(), this.tools.overlayX.range())
        console.log(this.tools.overlayY.domain(), this.tools.overlayY.range())

        const vis = this;

        this.els.viewerOverlay.selectAll('.dotMarker')
            .data(data)
            .join('img')
            .attr('class', 'dotMarker')
            .attr('src', '../client/assets/cycif-marker-mobile.svg')
            .attr('alt', 'Dot marker')
            .style('position', 'absolute')
            .style('height', `${24}px`)
            .each(function (d) {

                const img = d3.select(this);

                // Create new ref point
                const newPt = new OpenSeadragon.Point({x: 0, y: 0})
                newPt.x = d.positionData.refPoint.x
                newPt.y = d.positionData.refPoint.y

                const imgPt = vis.imageViewer.viewer.world.getItemAt(0).viewportToImageCoordinates(newPt);
                console.log(imgPt)
                console.log(vis.tools.overlayX(imgPt.x), vis.tools.overlayY(imgPt.y))

                img.style('left', `${vis.tools.overlayX(imgPt.x)}px`);
                img.style('top', `${vis.tools.overlayY(imgPt.y)}px`)


            });
    }

    /**
     * renderSnapshots
     */
    renderSnapshots() {

        const vis = this;

        const data = this.imageViewer.viewer.lensing.snapshots.album;

        this.els.album.selectAll('.dotter_block')
            .data(data)
            .join(
                enter => enter.append('div')
                    .attr('class', 'dotter_block')
                    .each(function (d, i) {

                        const div = d3.select(this);

                        const canvasContainer = div.append('div')
                            .attr('class', 'dotter_block_canvas_container')
                            .style('width', `${vis.configs.snapshotW + 2}px`)
                            .style('height', `${vis.configs.snapshotH + 2}px`)
                            .on('click', vis.eventCanvasOnClick.bind(vis));

                        const canvas = canvasContainer.append('canvas')
                            .attr('class', 'dotter_block_canvas')
                            .attr('width', vis.configs.snapshotW * d.lensingConfigs.pxRatio)
                            .attr('height', vis.configs.snapshotH * d.lensingConfigs.pxRatio)
                            .style('width', `${vis.configs.snapshotW}px`)
                            .style('height', `${vis.configs.snapshotH}px`)
                            .classed('borderRadius50p', d.lensingConfigs.shape === 'circle');

                        const ctx = canvas.node().getContext('2d');

                        createImageBitmap(d.imgData).then(imgBitmap => {
                            ctx.drawImage(imgBitmap,
                                0,
                                0,
                                vis.configs.snapshotW * d.lensingConfigs.pxRatio,
                                vis.configs.snapshotH * d.lensingConfigs.pxRatio
                            );
                        });

                        const contentContainer = div.append('div')
                            .attr('class', 'dotter_block_content_container');

                        contentContainer.append('h2')
                            .text(d.id);

                        contentContainer.append('p')
                            .text(d.date.toDateString());

                        contentContainer.append('textarea')
                            .attr('placeholder', 'Name');

                        contentContainer.append('textarea')
                            .attr('placeholder', 'Description');

                        const iconContainer = contentContainer.append('div')
                            .attr('class', 'dotter_block_icon_container');

                        // iconContainer.append('img')
                        //     .attr('src', '../static/frontend/assets/cycif-notes.svg')
                        //     .attr('alt', 'Notes')
                        //     .style('width', `${vis.configs.iconW}px`)
                        //     .style('height', `${vis.configs.iconH}px`);

                        iconContainer.append('img')
                            .attr('src', '../client/assets/cycif-download.svg')
                            .attr('alt', 'Download')
                            .style('width', `${vis.configs.iconW}px`)
                            .style('height', `${vis.configs.iconH}px`);

                        iconContainer.append('img')
                            .attr('src', '../client/assets/cycif-remove.svg')
                            .attr('alt', 'Remove')
                            .style('width', `${vis.configs.iconW}px`)
                            .style('height', `${vis.configs.iconH}px`);

                    })
            );

    }

    /**
     * eventCanvasOnClick
     */
    eventCanvasOnClick(e, d) {

        // Zoom main viewer
        const newPt = new OpenSeadragon.Point({x: 0, y: 0})
        newPt.x = d.positionData.refPoint.x
        newPt.y = d.positionData.refPoint.y
        this.imageViewer.viewerManagerVMain.viewer.viewport.panTo(newPt);
        this.imageViewer.viewerManagerVMain.viewer.viewport.zoomTo(d.positionData.zoom);

        // Zoom aux viewer
        this.imageViewer.viewerManagerVAuxi.viewer.viewport.zoomTo(d.positionData.zoomAux);

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
}