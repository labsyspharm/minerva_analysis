class DistributionViewer {


    constructor(config, dataFilter, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataFilter = dataFilter;
        this.brushmove = null;
        this.brushend = null;
        this.selections = [];
        this.maxSelections = 4;
        this.ranges = {};
        this.selectionOpacity = 1;


        //  create a color picker
        this.rainbow = rainbow();
        this.colorTransferHandle = null;
        d3.select(document.body)//add it to body
            .call(this.rainbow
                .on('save', (color, x) => {
                    let data = this.colorTransferHandle.datum();
                    let packet = {
                        name: data.parent.name,  // cell name :  string
                        type: data.type,         // left, right :  string
                        color,     // parse using d3.rgb(color) : https://github.com/d3/d3-color#rgb
                    };
                    this.eventHandler.trigger(DistributionViewer.events.COLOR_TRANSFER_CHANGE, packet);
                    this.colorTransferHandle.style('fill', color);
                })
                .on('close', () => this.colorTransferHandle = null));

        this.container = d3.select("#channel_list");

    }

    selectChannel(status, name) {
        this.selections.push(name);
        this.container.selectAll('.color-transfer')
            .filter(d => d.parent.name == name)
            .attr('display', null)
            .attr('transform', (d, i) => {
                return `translate(${this.ranges[name].pixelRange[i]},${0})`
            });
    }

    init(data) {
        this.wrangle(data);
        this.draw();
    }

    render(data) {
        this.wrangle(data);
    }

    highlights(cells) {
        var that = this;
        console.log('highlight cell selection');
        cells = _.sampleSize(cells, 100);
        //console.time('highlight data wrangling');  Timmer 'default' does not exist error
        cells = cells.map(cell => {
            return {
                color: colorScheme.retrieveClassColor(cell['cluster']),
                values: Object.keys(cell)
                    .filter(key =>
                        that.dataFilter.isImageFeature(key))
                    .map(key => {
                        return {name: key, value: cell[key]};
                    })
            };
        });
        this.draw();
    }


    wrangle(data) {
        var that = this;
        let columns = Object.keys(data[0]).filter(key =>
            that.dataFilter.isImageFeature(key));


    }

    draw() {
        let rect = document.getElementById('channel_list_wrapper').getBoundingClientRect();
        //  console.log('rect', rect);
    }


}

//static vars
DistributionViewer.events = {
    BRUSH_MOVE: "BRUSH_MOVE",
    BRUSH_END: "BRUSH_END",
    COLOR_TRANSFER_CHANGE_MOVE: "COLOR_TRANSFER_CHANGE_MOVE",
    COLOR_TRANSFER_CHANGE: "COLOR_TRANSFER_CHANGE",
    CHANNELS_CHANGE: "CHANNELS_CHANGE"
};
