class ChannelList {

    constructor(config, dataLayer, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.selections = [];
        this.maxSelections = 4;
        this.ranges = {};
        this.sliders = new Map();
        var that = this;
        this.sel = {};

        this.currentChannels = {};
        this.rangeConnector = {};
        this.colorConnector = {};

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
                        color: d3.rgb(color),     // parse using d3.rgb(color) : https://github.com/d3/d3-color#rgb
                    };
                    this.eventHandler.trigger(ChannelList.events.COLOR_TRANSFER_CHANGE, packet);
                    this.colorTransferHandle.style('fill', color);
                })
                .on('close', () => this.colorTransferHandle = null));

        this.container = d3.select("#channel_list");
    }

    removeChannel(name) {

        // Update selections
        delete this.sel[dataLayer.getFullChannelName(name)];

        // Trigger
        // this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    selectChannel(name) {
        const self = this;

        let fullName = self.dataLayer.getFullChannelName(name);
        let channelIdx = imageChannels[fullName];

        if (!this.rangeConnector[channelIdx]) {
            let defaultRange = self.dataLayer.imageBitRange;
            this.sliders.get(name).value([defaultRange[0], defaultRange[1]]);
        }

        if (!this.colorConnector[channelIdx]) {
            let rgbColor = `rgb(255, 255, 255)`;
            let selectorColor = `#color_${name}`;
            let selectorDoc = document.querySelector(selectorColor);
            selectorDoc.style.fill = rgbColor;
        }

        // Update selections
        self.selections.push(name);
        self.sel[dataLayer.getFullChannelName(name)] = self.dataLayer.getImageBitRange();

        // Trigger
        // this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    triggerChannelSelect() {

        // Trigger
        this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    async init() {
        const self = this;
        this.rainbow.hide();
        this.columns = await this.dataLayer.getChannelNames(true);
        // Hide the Loader
        document.getElementById('channel_list_loader').style.display = "none";
        let channel_list = document.getElementById("channel_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        channel_list.appendChild(list)
        // Will show the picker when you click on a color rect
        let showPicker = e => {
            this.colorTransferHandle = d3.select(e.target);
            let color = this.colorTransferHandle.style('fill');
            this.rainbow.show(e.clientX, e.clientY);
            this.rainbow.set(d3.hsl(color));

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
            // row
            let row2 = document.createElement("div");
            row2.classList.add("row");
            listItemParentDiv.appendChild(row2);

            // column within row that contains the name of the channel
            let nameCol = document.createElement("div");
            nameCol.classList.add("col-md-4");
            nameCol.classList.add("channel-col");
            row.appendChild(nameCol);

            // column within row that Contains the slider for the channel
            let sliderCol = document.createElement("div");
            sliderCol.classList.add("col-md-12");
            sliderCol.classList.add("channel-slider");
            sliderCol.setAttribute('id', "channel-slider_" + column)
            row2.appendChild(sliderCol);

            // column within row that contains svg for color pickers
            let svgCol = document.createElement("div");
            svgCol.classList.add("col-md-4");
            svgCol.classList.add("ml-auto");
            svgCol.classList.add("channel-col");
            svgCol.classList.add("channel-svg-wrapper");
            svgCol.classList.add("col-svg-wrapper");
            row.appendChild(svgCol);

            let colorLabel = document.createElement("span");
            colorLabel.textContent = "Color:";
            svgCol.appendChild(colorLabel);

            let svg = d3.select(svgCol)
                .append("svg")
                .attr("width", 15)
                .attr("height", 15)
            svg.selectAll("circle")
                .data([{"color": "white", "name": column}])
                .enter().append("rect")
                .attr("id", "color_" + column)
                .attr("class", "color-transfer")
                .attr("cursor", "pointer")
                .attr("stroke", "#757575")
                .attr("fill", d => d.color)
                .attr("width", "10")
                .attr("height", "10")
                .attr("rx", "2")
                .attr("ry", "2")
                .attr("x", "5")
                .attr("y", "2")
                .on('pointerup', showPicker);
            //<rect class="color-transfer" cursor="pointer" stroke="#757575" fill="black" width="10" height="10" rx="2" ry="2" x="-5" y="4.725680443548387" transform="translate(65,0)"></rect>
            svgCol.style.display = "none";

            let channelName = document.createElement("span");
            channelName.classList.add("channel-name");
            channelName.textContent = column;
            nameCol.appendChild(channelName);

            listItemParentDiv.addEventListener("click", e => this.abstract_click(e, svgCol));
            list.appendChild(listItemParentDiv);

            //add and hide channel sliders (will be visible when channel is active)
            let sliderRange = this.addSlider(self.dataLayer.getImageBitRange(), self.dataLayer.getImageBitRange(), column, document.getElementById("channel_list").getBoundingClientRect().width);
            d3.select('div#channel-slider_' + column).style('display', "none");

        });

        let arrow_db = document.getElementById('channels_upload_icon_db')
        arrow_db.onclick = async function () {
            await self.apply_channels('db');
        }

        let arrow = document.getElementById('channels_upload_icon')
        arrow.onclick = function () {
            let elem = document.getElementById('channels-upload-from-arrow');
            if (elem && document.createEvent) {
                let evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, false);
                elem.dispatchEvent(evt);
            }
        }
        document.getElementById("channels-upload-from-arrow").onchange = async function () {
            if (document.getElementById("channels-upload-from-arrow").files) {
                let file = document.getElementById("channels-upload-from-arrow").files[0]
                let formData = new FormData();
                formData.append("file", file);
                await self.dataLayer.submitChannelUpload(formData);
                document.getElementById("channels-upload-from-arrow").value = []
                await self.apply_channels('file');
            }
        }

        self.add_events();
    }

    /**
     * @function apply_channels
     *
     */
    async apply_channels(source) {
        const self = this;

        let channels;
        if (source === 'file'){
            channels = await self.dataLayer.getUploadedChannelCsvValues();
        } else {
            channels = await self.dataLayer.getSavedChannelList();
        }

        let defaultRange = self.dataLayer.imageBitRange;

        this.eventHandler.trigger(ChannelList.events.RESET_LISTS);
        // _.each(channels, col => {
        //     let fullName = self.dataLayer.getFullChannelName(col.channel);
        //     let channelIdx = imageChannels[fullName];
        //
        //     if (this.sliders.get(col.channel)) {
        //         if (this.currentChannels[channelIdx]) {
        //                 let channel_selector = `#channel-slider_${col.channel}`;
        //                 document.querySelector(channel_selector).click();
        //
        //                 let gating_selector = `#csv_gating-slider_${col.channel}`;
        //                 document.querySelector(gating_selector).click();
        //         }
        //     }
        // })

        this.currentChannels = {};
        this.rangeConnector = {};
        this.colorConnector = {};

        _.each(channels, col => {
            let fullName = self.dataLayer.getFullChannelName(col.channel);
            let channelIdx = imageChannels[fullName];

            if (this.sliders.get(col.channel)) {
                if (col.start !== defaultRange[0] || col.end !== defaultRange[1]){
                    this.sliders.get(col.channel).value([col.start, col.end]);
                    this.rangeConnector[channelIdx] = [col.start / defaultRange[1], col.end / defaultRange[1]];
                }

                if (col.r !== 255 || col.g !== 255 || col.b !== 255) {
                    let rgbColor = `rgb(${col.r}, ${col.g}, ${col.b})`;
                    let selectorColor = `#color_${col.channel}`;
                    // document.querySelector(selectorColor).setAttribute("fill", rgbColor);
                    let selectorDoc = document.querySelector(selectorColor);
                    selectorDoc.style.fill = rgbColor;
                    let channelColor = {
                        r: col.r,
                        g: col.g,
                        b: col.b,
                        opacity: col.opacity
                    };
                    this.colorConnector[channelIdx] = {color: channelColor};
                }

                if (col['channel_active']) {
                    let selector = `#channel-slider_${col.channel}`;
                    document.querySelector(selector).click();
                }
            }
        })
    }

    /**
     * @function add_events
     *
     */
    add_events() {
        const channels_download_icon = document.querySelector('#channels_download_icon');
        channels_download_icon.addEventListener('click', () => {
            this.dataLayer.downloadChannelsCSV(
                imageChannelsIdx,
                this.currentChannels,
                this.colorConnector,
                this.rangeConnector,
                this.dataLayer.imageBitRange
            );
        });

        const channels_download_icon_db = document.querySelector('#channels_download_icon_db');
        channels_download_icon_db.addEventListener('click', () => {
            this.dataLayer.saveChannelList(
                imageChannelsIdx,
                this.currentChannels,
                this.colorConnector,
                this.rangeConnector,
                this.dataLayer.imageBitRange
            );
        });
    }


    /**
     * @function abstract_click
     *
     * @param e
     * @param svgCol
     */
    abstract_click(event, svgCol) {

        // If you clicked on the svg, ignore this behavior
        if (event.target.closest("svg")) {
            return;
        }

        // Get info
        let parent = event.target.closest(".list-group-item");
        let name = parent.querySelector('.channel-name').textContent;
        let status = !parent.classList.contains("active");

        // If active - else inactive
        if (status) {

            // Clear everything
            // clearOut();

            // Don't add channel is the max are selected
            if (_.size(this.selections) >= this.maxSelections) {
                return;
            }

            // Update properties and add slider
            d3.select(parent).classed("active", true);
            svgCol.style.display = "block";
            d3.select('div#channel-slider_' + name).style('display', "block")

            // Add channel
            this.selectChannel(name);

        } else {
            // Clear panel visibility
            // clearOut();
            this.selections = _.pull(this.selections, name);

            // Remove channel and rerender
            this.removeChannel(name);

            // Hide
            d3.select(parent).classed("active", false);
            svgCol.style.display = "none";
            d3.select('div#channel-slider_' + name).style('display', "none")

            // Trigger viewer cleanse
            // this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, this.selections);
        }

        //
        let selectionsHeaderDiv = document.getElementById("selected-channels-header-div");
        if (selectionsHeaderDiv) {
            if (_.size(this.selections) >= this.maxSelections) {
                selectionsHeaderDiv.classList.add('bold-selections-header');
            } else {
                selectionsHeaderDiv.classList.remove('bold-selections-header');
            }
            let packet = {selections: this.selections, name, status};
            // console.log('channels_change', packet);
            document.getElementById("num-selected-channels").textContent = _.size(this.selections);

            // Trigger event
            this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, packet);

        }
    }

    /*
    add a slider
    @data the min and max range of the slider
    @activeRange the predefined values for the lower and upper handle
    @name the name of the slider (used as part of the id)
    @swidth the pixel width of the slider
     */
    addSlider(data, activeRange, name, swidth) {

        //formatter
        const f = (d3.format('.2%'))

        var that = this;
        //add range slider row content
        var sliderSimple = d3.sliderBottom()
            .min(d3.min(data))
            .max(d3.max(data))
            .width(swidth - 75)//.tickFormat(d3.format("s"))
            .fill('orange')
            .on('onchange', val => {
              // d3.select('p#value-range').text(val.map(d3.format('.2%')).join('-'));
              d3.select('#slider-input' + name + 0).attr('value', Math.round(val[0]));
              d3.select('#slider-input' + name + 0).property('value', Math.round(val[0]));
              d3.select('#slider-input' + name + 1).attr('value', Math.round(val[1]));
              d3.select('#slider-input' + name + 1).property('value', Math.round(val[1]));
              // sliderSimple.silentValue([val[0], val[1]]);
              that.moveSliderHandles(sliderSimple, val, name);
              let packet = {name: name, dataRange: val};
              this.eventHandler.trigger(ChannelList.events.BRUSH_END, packet);
            })
            .ticks(5)
            .default(activeRange)
            .handle(
                d3.symbol()
                    .type(d3.symbolCircle)
                    .size(100)
            )
            .tickValues([])
            // .on('end', range => {
            //     let packet = {name: name, dataRange: range};
            //     this.eventHandler.trigger(ChannelList.events.BRUSH_END, packet);
            // });

        this.sliders.set(name, sliderSimple);

        //create the slider svg and call the slider
        var gSimple = d3
            .select('#channel-slider_' + name)
            .append('svg')
            .attr('class', 'svgslider')
            .attr('width', swidth)
            .attr('height', 50)
            .append('g')
            .attr('transform', 'translate(20,13)');
        gSimple.call(sliderSimple);

        //slider value to be displayed closer to the slider than default
        d3.selectAll('.parameter-value').select('text')
            .attr("y", 10);

        //both handles
        d3.select('#channel-slider_' + name).selectAll(".parameter-value").each(function(d, i) {
        d3.select(this).append("foreignObject")
                    .attr('id', 'foreignObject_' + name + i)
                    .attr("width", 50)
                    .attr("height", 40)
                    .attr('x', -25)
                    .attr( 'y', -15)
                    .style('padding',"10px")
                    .append("xhtml:body")
                      .attr('xmlns','http://www.w3.org/1999/xhtml')
                        .style('background', 'none')
                      .append('input')
                        .attr( 'y', -15)
                        .attr('id', 'slider-input' + name + i)
                        .attr('type', 'text')
                        .attr('class', 'input')
                        .attr('value', function(){return channelList.sliders.get(name).value()[i]});
            //remove the previous text label
            d3.select(this).select('text').remove();
        });

        //entering a value in the input field of a slider handle will set this value and move the slider to this position
        d3.select('#channel-slider_' + name).selectAll(".parameter-value").selectAll('.input').on('keydown', function(event, d){
          if(event.key == "Enter"){
            // if (d.index = d3.select(this).attr('id')){
              let val = parseFloat(this.value.replace("%", ""));
              let handleVals = sliderSimple.silentValue();
              handleVals[d.index] = val;
              that.moveSliderHandles(sliderSimple, handleVals, name)

              let packet = {name: name, dataRange: handleVals};
              that.eventHandler.trigger(ChannelList.events.BRUSH_END, packet);
          }
        })

        return sliderSimple;
    };

    //move the slider handles and input fields so that input fields don't overlap when handles are close
    moveSliderHandles(slider, valArray, name){
        slider.silentValue(valArray);
        if (valArray[1] - valArray[0] < 10000){
            console.log('slider handles overlap..do something');
            d3.select('#foreignObject_'  + name + 1).attr('x', 5);
        }else{
            d3.select('#foreignObject_'  + name + 1).attr('x', -25);
        }
    }

    reset_channelList() {
        const self = this;
        let channelList = _.clone(self.selections);
        _.each(channelList, col => {
            let channel_selector = `#channel-slider_${col}`;
            document.querySelector(channel_selector).click();
        });
    }
}

window.addEventListener("resize", function () {
    //reinitialize slider on window change..(had some bug updating with via d3 update)
    if (typeof channelList != "undefined" && channelList) {
        channelList.sliders.forEach(function (slider, name) {
            d3.select('div#channel-slider_' + name).select('svg').remove();
            channelList.addSlider(dataLayer.getImageBitRange(), slider.value(), name,
                document.getElementById("channel_list").getBoundingClientRect().width);
        });
    }
});

//static vars
ChannelList.events = {
    BRUSH_MOVE: "BRUSH_MOVE",
    BRUSH_END: "BRUSH_END",
    COLOR_TRANSFER_CHANGE_MOVE: "COLOR_TRANSFER_CHANGE_MOVE",
    COLOR_TRANSFER_CHANGE: "COLOR_TRANSFER_CHANGE",
    CHANNELS_CHANGE: "CHANNELS_CHANGE",
    CHANNEL_SELECT: "CHANNEL_SELECT",
    RESET_LISTS: "RESET_LISTS"
};