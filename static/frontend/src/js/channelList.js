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
                        name: data.name,  // cell name :  string
                        type: data.color,         // white, black :  string
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

    async init() {
        this.rainbow.hide();
        let columnNames = await this.dataFilter.getColumnNames();
        this.columns = _.map(columnNames, column => {
            return this.dataFilter.getShortChannelName(column);
        });
        // Hide the Loader
        document.getElementById('channel_list_loader').style.display = "none";
        let channel_list = document.getElementById("channel_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        channel_list.appendChild(list)
        // Will show the picker when you click on a color rect
        let showPicker = () => {
            this.colorTransferHandle = d3.select(d3.event.target);
            let color = this.colorTransferHandle.style('fill');
            let hsl = d3.hsl(color);
            this.rainbow.show(d3.event.clientX, d3.event.clientY);
        };
        // Draws rows in the channel list
        _.each(this.columns, column => {
            // div for each row in channel list
            let listItemParentDiv = document.createElement("div");
            listItemParentDiv.classList.add("list-group-item");
            listItemParentDiv.classList.add("container");
            listItemParentDiv.classList.add("channel-list-content");
            // row
            let row = document.createElement("div");
            row.classList.add("row");
            listItemParentDiv.appendChild(row);
            // column within row that contains the name of the channel
            let nameCol = document.createElement("div");
            nameCol.classList.add("col-md-4");
            nameCol.classList.add("channel-col");
            row.appendChild(nameCol);
            // column within row that contains svg for color pickers
            let svgCol = document.createElement("div");
            svgCol.classList.add("col-md-4");
            svgCol.classList.add("ml-auto");
            svgCol.classList.add("channel-col");
            svgCol.classList.add("channel-svg-wrapper");
            row.appendChild(svgCol);

            let colorLabel = document.createElement("span");
            colorLabel.textContent = "Color:";
            svgCol.appendChild(colorLabel);

            let svg = d3.select(svgCol)
                .append("svg")
                .attr("width", 30)
                .attr("height", 15)
            svg.selectAll("circle")
                .data([{"color": "white", "name": column}, {"color": "black", "name": column}])
                .enter().append("rect")
                .attr("class", "color-transfer")
                .attr("cursor", "pointer")
                .attr("stroke", "#757575")
                .attr("fill", d => d.color)
                .attr("width", "10")
                .attr("height", "10")
                .attr("rx", "2")
                .attr("ry", "2")
                .attr("x", d => {
                    if (d.color == "white") {
                        return 3;
                    } else { //black
                        return 17;
                    }
                })
                .attr("y", "2")
                .on('pointerup', showPicker);
            //<rect class="color-transfer" cursor="pointer" stroke="#757575" fill="black" width="10" height="10" rx="2" ry="2" x="-5" y="4.725680443548387" transform="translate(65,0)"></rect>
            svgCol.style.display = "none";

            let channelName = document.createElement("span");
            channelName.classList.add("channel-name");
            channelName.textContent = column;
            nameCol.appendChild(channelName);
            listItemParentDiv.addEventListener("click", () => {
                // IF you clicked on the svg, ignore this behavior
                if (event.target.closest("svg")) {
                    return;
                }
                let parent = event.target.closest(".list-group-item");
                let name = parent.querySelector('.channel-name').textContent;
                let status = !parent.classList.contains("active");
                if (status) {
                    //Don't add channel is the max are selected
                    if (_.size(this.selections) >= this.maxSelections) {
                        return;
                    }
                    parent.classList.add("active");
                    svgCol.style.display = "block";
                    this.selectChannel(name);
                } else {
                    this.selections = _.remove(this.selections, name);
                    parent.classList.remove("active")
                    svgCol.style.display = "none";
                }
                let selectionsHeaderDiv = document.getElementById("selected-channels-header-div");
                if (_.size(this.selections) >= this.maxSelections) {
                    selectionsHeaderDiv.classList.add('bold-selections-header');
                } else {
                    selectionsHeaderDiv.classList.remove('bold-selections-header');
                }
                let packet = {selections: this.selections, name, status};
                console.log('channels_change', packet);
                document.getElementById("num-selected-channels").textContent = _.size(this.selections);
                this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, packet);
            })
            list.appendChild(listItemParentDiv);
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
