class Scatterplot {
    clusters;

    constructor(id, canvasId, eventHandler, dataLayer, neighborhoodTable, colorScheme, small = false, image = false, dataset = '', infoSvgId = null, width = null, height = null) {
        this.id = id;
        this.canvasId = canvasId;
        this.dataset = dataset;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;
        this.neighborhoodTable = neighborhoodTable;
        this.lastLasso = null;
        this.numResults = null
        this.pValue = null;
        this.small = small;
        this.image = image;
        this.infoSvgId = infoSvgId;
        this.width = width;
        this.height = height;
        this.labels = []
        this.patternNames = []
    }

    init() {
        const self = this;
        window.devicePixelRatio = 1;
        const canvas = document.querySelector(`#${self.canvasId}`);
        let {width, height} = canvas.getBoundingClientRect();
        let ratio = window.devicePixelRatio;
        width = self.width;
        height = self.height;
        self.lassoActive = false;
        self.editMode = false;
        self.customClusterDiv = document.getElementById('custom_cluster');
        self.saveLassoButton = document.getElementById('save_lasso');
        self.plot = null;
        self.colorMap = _.map(_.range(_.size(self.colorScheme.colorMap) / 2), i => {
            return hexToRGBA(self.colorScheme.colorMap[_.toString(i)].hex, 0.1)
        });
        self.orangeMap = _.map(_.range(_.size(self.colorScheme.colorMap) / 2), i => {
            return hexToRGBA('#ffa500', 0.1)
        });
        self.greyMap = _.map(_.range(_.size(self.colorScheme.colorMap) / 2), i => {
            if (flaskVariables.mode == 'single') {
                return hexToRGBA('#fffff', 0.025)
            } else {
                return hexToRGBA('#fffff', 0.008)
            }
        });

        if (self.image) {
            self.plot = createScatterplot({
                canvas,
                width,
                height,
                pointColor: self.greyMap,
                pointColorActive: self.orangeMap,
                pointColorHover: self.orangeMap,
                xScale: d3.scaleLinear().domain([-1, 1]),
                yScale: d3.scaleLinear().domain([-1, 1]),
                // opacityBy: 'density',
                colorBy: 'valueB',
                // opacityBy: 'density',
                // opacityBy: 'density',
                // pointColorActive: hexToRGBA('#ffa500', 0.2),
                // backgroundColor: [0, 0, 0, 0],
                pointSize: 1,
                lassoColor: hexToRGBA('#ffa500', 0.2),
                pointOutlineWidth: 0,
                pointSizeSelected: 1
            });
        } else {
            self.plot = createScatterplot({
                canvas,
                // width,
                // height,
                pointColor: self.greyMap,
                pointColorActive: self.orangeMap,
                pointColorHover: self.orangeMap,
                xScale: d3.scaleLinear().domain([-1, 1]),
                yScale: d3.scaleLinear().domain([-1, 1]),
                // opacityBy: 'density',
                colorBy: 'valueB',
                // cameraView: new Float32Array([1.9322417974472046, 0, 0, 0, 0, 1.9322417974472046, 0, 0, 0, 0, 1, 0, -0.4586012661457062, -0.6524205207824707, 0, 1]),
                cameraView: new Float32Array([1.5264194011688232, 0, 0, 0, 0, 1.5264194011688232, 0, 0, 0, 0, 1, 0, -0.5449246764183044, 0.040881987661123276, 0, 1]),
                // pointColorActive: hexToRGBA('#ffa500', 0.2),
                backgroundColor: [0, 0, 0, 0],
                pointSize: 1,
                lassoColor: hexToRGBA('#ffa500', 0.2),
                pointOutlineWidth: 0,
                pointSizeSelected: 0
            });
        }
        scatterplot.plot.subscribe('view', ({xScale, yScale}) => {
            self.displayLabels(xScale, yScale);
        });
        // if (self.image) {
        //
        //
        //     if (mode === 'single') {
        //         self.plot.set({
        //             lassoColor: hexToRGBA('#000000', 0.0)
        //         })
        //     }
        // }


        self.plot.subscribe('select', self.select.bind(self));
        self.plot.subscribe('lassoStart', self.lassoStart.bind(self));
        self.plot.subscribe('lassoEnd', self.lassoEnd.bind(self));

        let editButton = document.getElementById('edit_clustering');
        if (editButton) {
            editButton.addEventListener('click', self.switchEditMode.bind(self));
        }

        // Custom Cluster Submit
        if (self.id == "scatterplot_display") {
            let button = document.getElementById("custom_cluster_submit");
            if (button) {
                button.addEventListener('click', self.customCluster.bind(self));
            }
        }

        if (self.saveLassoButton) {
            self.saveLassoButton.addEventListener('click', self.saveLasso.bind(self));
        }


        //   Add overlay canvas
        self.textOverlayEl = document.createElement('canvas');
        self.textOverlayEl.style.position = 'absolute';
        self.textOverlayEl.style.top = 0;
        self.textOverlayEl.style.right = 0;
        self.textOverlayEl.style.bottom = 0;
        self.textOverlayEl.style.left = 0;
        self.textOverlayEl.style.pointerEvents = 'none';
        document.getElementById(self.id).appendChild(self.textOverlayEl);
        self.resizeTextOverlay = () => {
            self.textOverlayEl.width = self.width * window.devicePixelRatio;
            self.textOverlayEl.height = self.height * window.devicePixelRatio;
            self.textOverlayEl.style.width = `${self.width}px`;
            self.textOverlayEl.style.height = `${self.height}px`;
        };
        self.resizeTextOverlay();
        window.addEventListener('resize', self.resizeTextOverlay);
        self.overlayFontSize = 48;
        self.textOverlayCtx = self.textOverlayEl.getContext('2d');
        self.textOverlayCtx.font = `${
            self.overlayFontSize * window.devicePixelRatio
        }px sans-serif`;
        self.textOverlayCtx.textAlign = 'center';

    }

    saveLasso() {
        const self = this;
        if (self.lastLasso) {
            return dataLayer.saveLasso(self.lastLasso)
                .then((rows) => {
                    neighborhoodTable.drawRows(rows);
                })
        }
    }


    async wrangle(data, initialSelection = null) {
        const self = this;
        if (data) {
            self.visData = data;
        } else {
            self.visData = await dataLayer.getScatterplotData();
            self.visData = self.visData.data;
        }
        // if (colorByCellType) {
        //     let colorMap = _.map(_.range(_.size(self.colorScheme.colorMap) / 2), i => {
        //         return hexToRGBA(self.colorScheme.colorMap[_.toString(i)].hex, 0.08)
        //     });
        //     let activeColorMap = _.map(_.range(_.size(colorMap)), i => {
        //         return hexToRGBA('#ffa500', 1);
        //     })
        //
        //     self.plot.set({
        //         pointColor: colorMap,
        //         pointColorActive: activeColorMap,
        //         pointColorHover: activeColorMap,
        //         colorBy: 'valueB',
        //     });
        //
        // } else {
        //     self.plot.set({
        //         pointColor: hexToRGBA('#b2b2b2', 0.08),
        //         pointColorActive: hexToRGBA('#ffa500', 0.2),
        //     });
        // }
        if (!self.image) {
            await self.plot.draw(self.visData);
        } else {
            await self.plot.draw(self.visData);
        }
        if (self.image || mode === 'multi') {
            if (searching) {
                let datasetName = self.dataset;
                self.imageSelection = await self.dataLayer.getImageSearchResults(datasetName);
                self.dataLayer.currentRawSelection[self.dataset] = {
                    'num_results': self.imageSelection[self.dataset]['num_results'],
                    'p_value': self.imageSelection[self.dataset]['p_value']
                }
                // self.numResults = ;
                // self.pValue = ;
                self.recolor(self.imageSelection[self.dataset].cells);
            } else {
                self.dataLayer.currentRawSelection[self.dataset] = {
                    'num_results': null,
                    'p_value': null
                }
                self.recolor([])
            }
        } else if (initialSelection) {
            self.imageSelection = initialSelection;

            self.numResults = self.imageSelection.numResults;
            self.pValue = self.imageSelection.pValue;
            self.recolor(self.imageSelection.cells);
            self.addImageResultInfo()
        }
    }

    addImageResultInfo() {
        const self = this;
        self.svg = d3.select(`#${self.infoSvgId}`)
        self.svg.selectAll(`.info-svg-g`).remove()
        if (!self.numResults) {
            return;
        }
        let width = self.svg.node().getBoundingClientRect().width;
        let maxVal = 500000
        let g = self.svg.append('g')
            .attr('class', 'info-svg-g')

        g.append('rect')
            .attr('class', 'num-results-rect')
            .attr('x', 10)
            .attr('y', 0)
            .attr('width', (self.numResults / maxVal) * width)
            .attr('height', 18)
            .attr('stroke-width', 1)
            .attr('stroke', 'white')
            .attr('fill', '#ff8a00')
            .attr('fill-opacity', 1);
        // .attr('fill-opacity', 1 - self.pValue); //TODO REPLACE

        // self.svg.append('text')
        //     .attr('x', (self.numResults / maxVal) * width + 40)
        //     .attr('y', 16)
        //     .attr('text-anchor', 'start')
        //     .attr('class', 'result-info-text')
        //     .text(`P = ${self.pValue}`);

        g.append('text')
            .attr('x', 13)
            .attr('y', 14)
            .attr('text-anchor', 'start')
            .attr('class', 'result-info-text')
            .text(`${self.numResults} results`);


        // d3.select(`#${self.id}`).selectAll('.image_result_info').remove()
        // let absoluteContainer = d3.select(`#${self.id}`).append('div')
        //     .classed('image_result_info', true)
        // let row1 = absoluteContainer.append('div').classed('row', true)
        // let row1col1 = row1.append('div')
        //     .classed('col-6', true)
        // row1col1.append('span')
        //     .classed('image_result_info', true)
        //     .text('Results')
        // let row1col2 = row1.append('div')
        //     .classed('col-6', true)
        // row1col2.append('span')
        //     .classed('image_result_value', true)
        //     .text(self.numResults)
        //
        // let row2 = absoluteContainer.append('div').classed('row', true)
        // let row2col1 = row2.append('div')
        //     .classed('col-6', true)
        // row2col1.append('span')
        //     .classed('image_result_info', true)
        //     .text('P Value')
        // let row2col2 = row2.append('div')
        //     .classed('col-6', true)
        // row2col2.append('span')
        //     .classed('image_result_value', true)
        //     .text(Number((self.pValue).toFixed(1)))


    }

    recolor(selection = null, showCentroid = false) {
        const self = this;
        console.log('recoloring', self.id)
        if (!selection) {
            let cells = this.dataLayer.getCurrentRawSelection().cells || this.dataLayer.getCurrentRawSelection()?.[datasource]?.cells
            selection = _.map(cells, e => e.id)
            console.log('Finding Selection Because Not Specified', selection)
        } else {
            console.log('set selection', selection);
        }
        self.selection = selection;

        self.plot.select(selection, {preventEvent: true});
        if (searching && (self.image || self.infoSvgId == 'search-info-svg')) {
            self.numResults = self.dataLayer.getCurrentRawSelection()[self.dataset]?.num_results ||
                self.dataLayer.getCurrentRawSelection()?.num_results;
            self.pValue = self.dataLayer.getCurrentRawSelection()[self.dataset]?.p_value || self.dataLayer.getCurrentRawSelection()?.p_value;
            self.addImageResultInfo();
        } else if (self.infoSvgId) {
            d3.select(`#${self.infoSvgId}`).selectAll(`.info-svg-g`).remove()
        }
        // let selectedPoints = _.at(self.plot.get('points'), selection);
        // if (showCentroid) {
        //     self.showCentroid = true;
        //     self.labels.push(self.dataLayer.getCurrentRawSelection()['centroid']);
        //     self.patternNames.push(self.dataLayer.getCurrentRawSelection()['patternName']);
        // } else {
        //     self.showCentroid = false;
        // }
        // self.plot.select([...this.dataLayer.getCurrentSelection().keys()]);
    }

    changeColoring(colorByCellType) {
        const self = this;
        if (colorByCellType) {
            self.plot.set({
                pointColorActive: self.colorMap,
                pointColorHover: self.colorMap,
            })
        } else {
            self.plot.set({
                pointColorActive: self.orangeMap,
                pointColorHover: self.orangeMap
            })
        }


    }

    displayLabels(xScale, yScale) {
        const self = this;
        if (self.showCentroid) {
            self.textOverlayCtx.fillStyle = 'rgb(16,255,0)';
            self.labels.forEach((e, i) => {
                self.textOverlayCtx.fillText(
                    self.patternNames[i],
                    xScale(e[0]) * window.devicePixelRatio,
                    yScale(e[1]) * window.devicePixelRatio -
                    self.overlayFontSize * 1.2 * window.devicePixelRatio
                );
            })
        } else {
            self.textOverlayCtx.clearRect(0, 0, self.width, self.height);

        }

    }

    select(args) {
        const self = this;
        console.log('Selection Size', _.size(args.points), args.points.sort());
        // TODO: remove any points that aren't in
        // self.plot.select(_.sampleSize(args.points, 100), {preventEvent: true});
        if (self.lassoActive && (!self.image || mode === 'multi')) {
            return dataLayer.getCells(args, self.dataset, self.image)
                .then(cells => {
                    if (self.image) {
                        self.eventHandler.trigger(Scatterplot.events.selectFromScatterplot, {
                            'selection': cells,
                            'selectionSource': 'Multi Image',
                            'dataset': self.dataset
                        })
                    } else {
                        self.eventHandler.trigger(Scatterplot.events.selectFromScatterplot, {
                            'selection': cells,
                            'selectionSource': 'Embedding'
                        })
                    }
                });
        } else if (self.image && mode === 'single') {
            self.plot.select([], {preventEvent: true});
        }
        console.log('Selection Done', self.id)
    }

    lassoStart() {
        const self = this;
        self.lassoActive = true;
    }

    lassoEnd(args) {
        const self = this;
        console.log(args);
        self.lastLasso = args;
        self.lassoActive = false;
    }

    async applyLasso(points) {
        return dataLayer.getCellsInPolygon(points, false, true)
            .then((cells) => {
                return cells;
            });

    }

    switchEditMode() {
        const self = this;
        self.editMode = !self.editMode;
        if (self.editMode) {
            self.customClusterDiv.style.visibility = "visible";
        } else {
            self.customClusterDiv.style.visibility = "hidden";
        }
    }

    async customCluster() {
        const self = this;
        let numberOfClusters = document.getElementById('custom_cluster_number')
        if (!numberOfClusters || !numberOfClusters.value) {
            return;
        }
        numberOfClusters = _.toInteger(numberOfClusters.value);
        // document.getElementById('custom_cluster_loading').innerHTML += '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
        try {
            let updatedNeighborhoods = await self.dataLayer.customCluster(numberOfClusters)
            self.neighborhoodTable.updateNeighborhoods(updatedNeighborhoods);
        } catch (e) {
        }
        // document.getElementById('custom_cluster_loading').innerHTML = '';
    }

    rewrangle() {
        const self = this;
        // let parent = document.getElementById(self.id).getBoundingClientRect()
        // const canvas = document.querySelector(`#${self.canvasId}`);
        // canvas.width = parent.width;
        // canvas.height = parent.height;
        // let {width, height} = canvas.getBoundingClientRect();
        // let ratio = window.devicePixelRatio;
        // width = width / ratio;
        // height = height / ratio;
        // scatterplot.set({width, height, canvas});
        self.plot.reset();
    }

    async destroy() {
        const self = this;
        await self.plot.destroy();
    }
}

// https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
function

hexToRGBA(hex, alpha) {
    hex = _.toUpper(hex);
    const h = "0123456789ABCDEF";
    let r = h.indexOf(hex[1]) * 16 + h.indexOf(hex[2]);
    let g = h.indexOf(hex[3]) * 16 + h.indexOf(hex[4]);
    let b = h.indexOf(hex[5]) * 16 + h.indexOf(hex[6]);
    let rgba = [r / 255, g / 255, b / 255, alpha]
    return rgba;

}

Scatterplot
    .events = {
    selectFromScatterplot: 'selectFromScatterplot'
};

