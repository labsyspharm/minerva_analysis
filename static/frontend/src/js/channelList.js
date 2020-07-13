class ChannelList {


    constructor(config, dataFilter, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataFilter = dataFilter;
        this.selections = [];
        this.maxSelections = 4;
        this.ranges = {};


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
                    this.eventHandler.trigger(ChannelList.events.COLOR_TRANSFER_CHANGE, packet);
                    this.colorTransferHandle.style('fill', color);
                })
                .on('close', () => this.colorTransferHandle = null));

        this.container = d3.select("#channel_list");

    }

    selectChannel(name) {
        this.selections.push(name);
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
        this.visData = columns;
    }

    draw() {
        let rect = document.getElementById('channel_list_wrapper').getBoundingClientRect();
        let channel_list = document.getElementById("channel_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        channel_list.appendChild(list)
        _.each(this.visData, column => {
            let listItem = document.createElement("li");
            listItem.textContent = column;
            listItem.classList.add("list-group-item");
            listItem.addEventListener("click", () => {
                let name = event.target.textContent;
                this.selectChannel(name);
                let status = !event.target.classList.contains("active");
                if (status) {
                    event.target.classList.add("active");
                } else {
                    event.target.classList.remove("active")
                }
                let packet = {selections: this.selections, name, status};
                console.log('channels_change', packet);
                this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, packet);
            })
            list.appendChild(listItem);
        });
    }

}

//static vars
ChannelList.events = {
    BRUSH_MOVE: "BRUSH_MOVE",
    BRUSH_END: "BRUSH_END",
    COLOR_TRANSFER_CHANGE_MOVE: "COLOR_TRANSFER_CHANGE_MOVE",
    COLOR_TRANSFER_CHANGE: "COLOR_TRANSFER_CHANGE",
    CHANNELS_CHANGE: "CHANNELS_CHANGE"
};
