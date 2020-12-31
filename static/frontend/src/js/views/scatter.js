class Scatterplot {
    constructor(id, eventHandler, dataLayer) {
        this.id = id;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
    }

    async init(visData) {
        const self = this;
        self.visData = visData
        self.visData.data = _.map(self.visData.data, _.values);
        let colorScheme = d3.scaleOrdinal(d3.schemeCategory10)
            .domain([0, _.size(this.visData.clusters) + 2]);
        this.colorMap = _.map(this.visData.clusters, cluster => {
            return colorScheme(cluster + 1);

        });

        const canvas = document.querySelector('#scatter_canvas');

        let {width, height} = canvas.getBoundingClientRect();
        let ratio = window.devicePixelRatio;
        width = width / ratio;
        height = height / ratio;

        self.plot = createScatterplot({
            canvas,
            width,
            height,
            colorBy: 'category',
            pointColor: this.colorMap,
            pointSize: 5,
        });
        self.plot.set({opacity: 0.4});

        await self.draw();
    }


    async draw() {
        const self = this;
        const points = new Array(10000)
            .fill()
            .map(() => [-1 + Math.random() * 2, -1 + Math.random() * 2, 0, 1]);
        self.plot.draw(self.visData.data);
    }

    recolor(cluster = null, ids = null) {
        const self = this;

    }
}

Scatterplot.events = {
    selectCluster: 'selectCluster'
};

