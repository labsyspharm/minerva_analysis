/**
 * @class PtDotter
 */
export class PtDotter {

    // Class vars
    configs = {
        iconH: 12,
        iconW: 12,
        snapshotH: 90,
        snapshotW: 90
    }
    els = {
        album: null,
        container: null
    }
    imageViewer = null;
    snapshotsSubscription = null

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

        this.buildBasicStructure();

        this.imageViewer = seaDragonViewer;
        this.snapshotsSubscription = this.imageViewer.viewer.lensing.snapshots.subject.subscribe(next => {
            this.renderSnapshots()
        });
        this.renderSnapshots()


    }

    /**
     * @function buildBasicStructure
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
                            .style('height', `${vis.configs.snapshotH + 2}px`);

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
                            .attr('src', '../static/frontend/assets/cycif-download.svg')
                            .attr('alt', 'Download')
                            .style('width', `${vis.configs.iconW}px`)
                            .style('height', `${vis.configs.iconH}px`);

                        iconContainer.append('img')
                            .attr('src', '../static/frontend/assets/cycif-remove.svg')
                            .attr('alt', 'Remove')
                            .style('width', `${vis.configs.iconW}px`)
                            .style('height', `${vis.configs.iconH}px`);

                    })
            )

    }
}