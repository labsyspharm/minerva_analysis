class Scatterplot {
    clusters;

    constructor(id, canvasId, eventHandler, dataLayer, neighborhoodTable) {
        this.id = id;
        this.canvasId = canvasId;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.neighborhoodTable = neighborhoodTable;
    }

    init() {
        const self = this;
        window.devicePixelRatio = 1;
        const canvas = document.querySelector(`#${self.canvasId}`);
        let {width, height} = canvas.getBoundingClientRect();
        let ratio = window.devicePixelRatio;
        self.lassoActive = false;
        width = width / ratio;
        height = height / ratio;

        self.plot = createScatterplot({
            canvas,
            width,
            height,
            pointColor: hexToRGBA('#808080', 0.1),
            pointSize: 1,
            lassoColor: hexToRGBA('#ffa500', 1),
            pointOutlineWidth: 0,
            pointSizeSelected: 0,
            pointColorActive: hexToRGBA('#ffa500', 0.3)
        });

        self.plot.subscribe('select', self.select.bind(self));
        self.plot.subscribe('lassoStart', self.lassoStart.bind(self));
        self.plot.subscribe('lassoEnd', self.lassoEnd.bind(self));


        // Custom Cluster Submit
        let button = document.getElementById("custom_cluster_submit");
        button.addEventListener('click', self.customCluster.bind(self));
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

    select(points) {
        const self = this;
        if (self.lassoActive) {
            return dataLayer.getCells(points)
                .then(cells => {
                    self.eventHandler.trigger(Scatterplot.events.selectFromEmbedding, cells)
                });
        }
    }

    lassoStart() {
        const self = this;
        self.lassoActive = true;
    }

    lassoEnd() {
        const self = this;
        self.lassoActive = false;
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

