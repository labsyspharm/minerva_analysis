class Scatterplot {
    clusters;

    constructor(id, canvasId, eventHandler, dataLayer, neighborhoodTable, small = false) {
        this.id = id;
        this.canvasId = canvasId;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.neighborhoodTable = neighborhoodTable;
        this.lastLasso = null;
        this.small = small;
    }

    init() {
        const self = this;
        window.devicePixelRatio = 1;
        const canvas = document.querySelector(`#${self.canvasId}`);
        let {width, height} = canvas.getBoundingClientRect();
        let ratio = window.devicePixelRatio;
        self.lassoActive = false;
        self.editMode = false;
        self.customClusterDiv = document.getElementById('custom_cluster');
        self.saveLassoButton = document.getElementById('save_lasso');

        width = width / ratio;
        height = height / ratio;

        self.plot = createScatterplot({
            canvas,
            width,
            height,
            pointColor: hexToRGBA('#b2b2b2', 0.01),
            pointSize: 1,
            lassoColor: hexToRGBA('#ffa500', 1),
            pointOutlineWidth: 0,
            pointSizeSelected: 0,
            pointColorActive: hexToRGBA('#ffa500', 0.3)
        });
        // if (self.small) {
        //     self.plot.set({pointColor: hexToRGBA('#000000', 0.3)});
        // }

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
    }


    recolor() {
        const self = this;
        self.plot.select([...this.dataLayer.getCurrentSelection().keys()]);
    }

    select(args) {
        const self = this;
        // TODO: remove any points that aren't in
        // self.plot.select(_.sampleSize(args.points, 100), {preventEvent: true});
        if (self.lassoActive) {
            console.log("Selecting");
            return dataLayer.getCells(args)
                .then(cells => {
                    self.eventHandler.trigger(Scatterplot.events.selectFromEmbedding, {
                        'selection': cells,
                        'selectionSource': 'Embedding'
                    })
                });
        }
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
        document.getElementById('custom_cluster_loading').innerHTML += '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
        try {
            let updatedNeighborhoods = await self.dataLayer.customCluster(numberOfClusters)
            self.neighborhoodTable.updateNeighborhoods(updatedNeighborhoods);
        } catch (e) {
        }
        document.getElementById('custom_cluster_loading').innerHTML = '';
    }
}

https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
    function hexToRGBA(hex, alpha) {
        hex = _.toUpper(hex);
        const h = "0123456789ABCDEF";
        let r = h.indexOf(hex[1]) * 16 + h.indexOf(hex[2]);
        let g = h.indexOf(hex[3]) * 16 + h.indexOf(hex[4]);
        let b = h.indexOf(hex[5]) * 16 + h.indexOf(hex[6]);
        return [r / 255, g / 255, b / 255, alpha]
    }

Scatterplot.events = {
    selectFromEmbedding: 'selectFromEmbedding'
};

