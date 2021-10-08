class Scatterplot {
    clusters;

    constructor(id, canvasId, eventHandler, dataLayer, colorScheme) {
        this.id = id;
        this.canvasId = canvasId;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;
    }

    async init() {
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
            colorBy: 'valueB',
            pointSize: 1,
            opacity: 0.2,
            lassoColor: hexToRGBA('#ffa500', 1),
            pointSizeSelected: 1,
        });
        self.plot.set({
            pointColor: _.range(self.dataLayer.cellGroups.length).map(i => {
                return hexToRGBA(self.colorScheme.colorMap[i].hex, 0)
            }),
            pointOutlineWidth: 2
        });

        self.plot.subscribe('select', self.select.bind(self));
        self.plot.subscribe('lassoStart', self.lassoStart.bind(self));
        self.plot.subscribe('lassoEnd', self.lassoEnd.bind(self));

        await self.wrangle();

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
        let indices = [...this.dataLayer.getCurrentSelection().values()].map(elem => elem.id);
        self.plot.select(indices);
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
