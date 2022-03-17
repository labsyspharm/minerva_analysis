class Scatterplot {
    clusters;

    constructor(id, canvasId, eventHandler, dataLayer, neighborhoodTable, small = false, image = false, dataset = '') {
        this.id = id;
        this.canvasId = canvasId;
        this.dataset = dataset;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.neighborhoodTable = neighborhoodTable;
        this.lastLasso = null;
        this.small = small;
        this.image = image;
    }

    init() {
        const self = this;
        window.devicePixelRatio = 1;
        const canvas = document.querySelector(`#${self.canvasId}`);
        let {width, height} = canvas.getBoundingClientRect();
        let ratio = window.devicePixelRatio;
        width = width / ratio;
        height = height / ratio;
        self.lassoActive = false;
        self.editMode = false;
        self.customClusterDiv = document.getElementById('custom_cluster');
        self.saveLassoButton = document.getElementById('save_lasso');


        self.plot = createScatterplot({
            canvas,
            // width,
            // height,
            pointColor: hexToRGBA('#b2b2b2', 1),
            opacityBy: 'density',
            pointColorActive: hexToRGBA('#ffa500', 0.2),
            pointSize: 1,
            lassoColor: hexToRGBA('#ffa500', 0.2),
            pointOutlineWidth: 0,
            pointSizeSelected: 0
        });
        if (self.image && mode === 'single') {
            self.plot.set({
                lassoColor: hexToRGBA('#000000', 0.0)
            })
        }


        self.plot.subscribe('select', self.select.bind(self));
        self.plot.subscribe('lassoStart', self.lassoStart.bind(self));
        self.plot.subscribe('lassoEnd', self.lassoEnd.bind(self));

        let editButton = document.getElementById('edit_clustering');
        if (editButton) {
            editButton.addEventListener('click', self.switchEditMode.bind(self));
        }

        // Custom Cluster Submit
        let button = document.getElementById("custom_cluster_submit");
        if (button) {
            button.addEventListener('click', self.customCluster.bind(self));
        }

        if (self.saveLassoButton) {
            self.saveLassoButton.addEventListener('click', self.saveLasso.bind(self));
        }
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


    async wrangle(data) {
        const self = this;
        if (data) {
            self.visData = data;
        } else {
            self.visData = await dataLayer.getScatterplotData();
            self.visData = self.visData.data;
        }
        self.plot.draw(self.visData);
        if (self.image) {
            if (searching) {
                self.imageSelection = await self.dataLayer.getImageSearchResults(self.dataset);
                self.recolor(self.imageSelection[self.dataset]);
            }
            searching = false;
        }
    }

    recolor(selection = null) {
        const self = this;
        if (!selection) {
            selection = _.map(this.dataLayer.getCurrentRawSelection().cells, e => e.id)
        }
        // console.log('Recolor Size', _.size(selection), selection.sort());
        self.selection = selection;
        self.plot.select(selection, {preventEvent: true});
        // self.plot.select([...this.dataLayer.getCurrentSelection().keys()]);
    }

    select(args) {
        const self = this;
        // console.log('Selection Size', _.size(args.points), args.points.sort());
        // TODO: remove any points that aren't in
        // self.plot.select(_.sampleSize(args.points, 100), {preventEvent: true});
        if (self.lassoActive && (!self.image || mode === 'multi')) {
            return dataLayer.getCells(args, self.dataset, self.image)
                .then(cells => {
                    if (self.image) {
                        self.eventHandler.trigger(Scatterplot.events.selectFromEmbedding, {
                            'selection': cells,
                            'selectionSource': 'Multi Image',
                            'dataset': self.dataset
                        })
                    } else {
                        self.eventHandler.trigger(Scatterplot.events.selectFromEmbedding, {
                            'selection': cells,
                            'selectionSource': 'Embedding'
                        })
                    }
                });
        } else if (self.image && mode === 'single') {
            self.plot.select([]);
        }
    }

    lassoStart() {
        const self = this;
        self.lassoActive = true;
    }

    lassoEnd(args) {
        const self = this;
        // console.log(args);
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
        // FIXME - could not find this element
        // document.getElementById('custom_cluster_loading').innerHTML += '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
        try {
            let updatedNeighborhoods = await self.dataLayer.customCluster(numberOfClusters)
            self.neighborhoodTable.updateNeighborhoods(updatedNeighborhoods);
        } catch (e) {
        }
        // FIXME - could not find this element
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

    destroy() {
        const self = this;
        self.plot.destroy();
    }
}

// https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
    function hexToRGBA(hex, alpha) {
        hex = _.toUpper(hex);
        const h = "0123456789ABCDEF";
        let r = h.indexOf(hex[1]) * 16 + h.indexOf(hex[2]);
        let g = h.indexOf(hex[3]) * 16 + h.indexOf(hex[4]);
        let b = h.indexOf(hex[5]) * 16 + h.indexOf(hex[6]);
        if (alpha == 1) {
            let rgb = [r / 255, g / 255, b / 255]
            return rgb;
        } else {
            let rgba = [r / 255, g / 255, b / 255, alpha]
            return rgba;
        }
    }

Scatterplot.events = {
    selectFromEmbedding: 'selectFromEmbedding'
};

