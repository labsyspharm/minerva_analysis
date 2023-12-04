/**
 * @class ChannelList - A view to select and deselect active image channels, set color and transfer functions
 */
class ChannelList {

    /**
     * @constructor
     * @param config the cinfiguration file (json)
     * @param columns - all the channel names
     * @param dataLayer - the data layer (stub) that executes server requests and holds client side data
     * @param eventHandler - the event handler for distributing interface and data updates
     */
    constructor(config, columns, dataLayer, eventHandler) {
        this.config = config;
        this.columns = [...columns];
        this.databaseDescription = {};
        this.maxSelections = config.maxSelections;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.selections = [];
        this.hasChannelGMM = {};
        this.ranges = {};
        this.sliders = new Map();
        this.image_channels = {};
        this.sel = {};
        this.currentChannels = {};
        this.rangeConnector = {};
        this.colorConnector = {};
        this.channelIDs = {};
        this.createColorPicker();
        this.container = d3.select("#channel_list");
    }

    /**
     * A color picker that can be activated on each channel
     */
    createColorPicker(){
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
    }

    /**
     * Removes a channel form the current selection
     * @param name - the name of the channel to remove
     */
    removeChannel(name) {
        // Update selections
        delete this.sel[this.dataLayer.getFullChannelName(name)];

        // Trigger
        // this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    /**
     * Selects a channel as active and adds the respective viual components to the channel panel in the list view
     * @param name - the channel to set and display as selected
     */
    selectChannel(name) {
        let fullName = this.dataLayer.getFullChannelName(name);
        let channelIdx = imageChannels[fullName];
        let channelID = this.channelIDs[name];

        if (!this.rangeConnector[channelIdx]) {
            let defaultRange = this.dataLayer.imageBitRange;
            this.sliders.get(name).value([defaultRange[0], defaultRange[1]]);
        }

        if (!this.colorConnector[channelIdx]) {
            let rgbColor = `rgb(255, 255, 255)`;
            let selectorColor = `#color_${channelID}`;
            let selectorDoc = document.querySelector(selectorColor);
            selectorDoc.style.fill = rgbColor;
        }

        if (!(name in this.hasChannelGMM)) {
            this.getAndDrawChannelGMM(name);
        }

        // Update selections
        this.selections.push(name);
        this.sel[fullName] = this.image_channels[name];

        // Trigger
        // this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    /**
     * triggerss an event that distributes the selected channel information.
     */
    triggerChannelSelect() {
        // Trigger
        this.eventHandler.trigger(ChannelList.events.CHANNEL_SELECT, this.sel);
    }

    /**
     * initializes the view (channel list)
     * @param dd - database description
     * @returns {Promise<void>}
     */
    init(dd) {
        this.databaseDescription = dd;
        this.rainbow.hide();
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
        _.each(this.columns, (column, index) => {
            let channelID = `channel_${index}`;
            this.channelIDs[column] = channelID;
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
            sliderCol.setAttribute('id', "channel-slider_" + channelID)
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
                .attr("id", "color_" + channelID)
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

            let autoCol = document.createElement("div");
            autoCol.classList.add("col-md-4");
            autoCol.classList.add("ml-auto");
            autoCol.classList.add("image-auto")
            autoCol.setAttribute('id', "image-auto_" + channelID)
            autoCol.classList.add("channel-col");
            autoCol.classList.add("channel-svg-wrapper");
            row.appendChild(autoCol);

            let autoBtn = document.createElement("button");
            autoBtn.classList.add('auto-btn');
            autoBtn.classList.add('auto-loading');
            autoBtn.setAttribute('id', "auto-btn_" + channelID);
            autoBtn.textContent = "auto";
            const clickHandler = this.auto_channel.bind(this, column);
            autoBtn.addEventListener("click", clickHandler);

            autoCol.appendChild(autoBtn);
            autoBtn.addEventListener("click", e => e.stopPropagation());
            d3.select(autoCol).style('display', "none");

            let channelName = document.createElement("span");
            channelName.classList.add("channel-name");
            channelName.classList.add("list-button");
            channelName.textContent = column;
            nameCol.appendChild(channelName);

            listItemParentDiv.addEventListener("click", e => this.toggleChannelPanel(e, svgCol));
            list.appendChild(listItemParentDiv);

            //add and hide channel sliders (will be visible when channel is active)
            let fullName = this.dataLayer.getFullChannelName(column)
            let sliderMin = this.databaseDescription[fullName]['image_min']
            let sliderMax = this.databaseDescription[fullName]['image_max']
            this.image_channels[column] = [sliderMin, sliderMax];
            const channelListEl = document.getElementById("channel_list");
            const swidth = channelListEl.getBoundingClientRect().width;
            let sliderRange = this.addSlider(column, swidth, [sliderMin, sliderMax]);
            d3.select('div#channel-slider_' + channelID).style('display', "none");

        });

        let arrow_db = document.getElementById('channels_upload_icon_db')
        arrow_db.onclick = async () => {
            await this.applyChannels('db');
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
        document.getElementById("channels-upload-from-arrow").onchange = async () => {
            if (document.getElementById("channels-upload-from-arrow").files) {
                let file = document.getElementById("channels-upload-from-arrow").files[0]
                let formData = new FormData();
                formData.append("file", file);
                await this.dataLayer.submitChannelUpload(formData);
                document.getElementById("channels-upload-from-arrow").value = []
                await this.applyChannels('file');
            }
        }

        this.addDownloadEvents();
    }

    /**
     * @function applyChannels
     * Applies settings (from file or db) to the channels
     * @parms {String} source Whether it is from new file upload or saved
     */
    async applyChannels(source) {
        let channels;
        if (source === 'file'){
            channels = await this.dataLayer.getUploadedChannelCsvValues();
        } else {
            channels = await this.dataLayer.getSavedChannelList();
        }

        let defaultRange = this.dataLayer.imageBitRange;

        // this.eventHandler.trigger(ChannelList.events.RESET_LISTS);
        _.each(channels, col => {
            let fullName = this.dataLayer.getFullChannelName(col.channel);
            let channelIdx = imageChannels[fullName];
            let channelID = this.channelIDs[col.channel];

            if (this.sliders.get(col.channel)) {
                if (this.currentChannels[channelIdx]) {
                        let channel_selector = `#channel-slider_${channelID}`;
                        document.querySelector(channel_selector).click();
                }
            }
        })

        this.currentChannels = {};
        this.rangeConnector = {};
        this.colorConnector = {};

        _.each(channels, col => {
            let fullName = this.dataLayer.getFullChannelName(col.channel);
            let channelIdx = imageChannels[fullName];
            let channelID = this.channelIDs[col.channel];

            if (this.sliders.get(col.channel)) {
                if (col.start > this.image_channels[col.channel][0] || col.end < this.image_channels[col.channel][1]){
                    this.sliders.get(col.channel).value([col.start, col.end]);
                    this.rangeConnector[channelIdx] = [col.start / defaultRange[1], col.end / defaultRange[1]];
                }

                if (col.r !== 255 || col.g !== 255 || col.b !== 255) {
                    let rgbColor = `rgb(${col.r}, ${col.g}, ${col.b})`;
                    let selectorColor = `#color_${channelID}`;
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
                    let selector = `#channel-slider_${channelID}`;
                    document.querySelector(selector).click();
                }
            }
        })
    }


     auto_channel(name) {
        let fullName = this.dataLayer.getFullChannelName(name);
        if (!(name in this.hasChannelGMM)) {
          return
        }
        let vmin = this.hasChannelGMM[name]['vmin'];
        let vmax = this.hasChannelGMM[name]['vmax'];
        this.sliders.get(name).value([vmin, vmax]);

        let channelIdx = imageChannels[fullName];
        let defaultRange = this.dataLayer.imageBitRange;
        this.rangeConnector[channelIdx] = [vmin / defaultRange[1], vmax / defaultRange[1]];
    }


    /**
     * @function addDownloadEvents
     *  Adds event listeners to upload/download buttons
     */
    addDownloadEvents() {
        const channels_download_icon = document.querySelector('#channels_download_icon');
        channels_download_icon.addEventListener('click', () => {
            this.dataLayer.downloadChannelsCSV(
                imageChannelsIdx,
                this.currentChannels,
                this.colorConnector,
                this.rangeConnector,
                this.image_channels
            );
        });

        const channels_download_icon_db = document.querySelector('#channels_download_icon_db');
        channels_download_icon_db.addEventListener('click', () => {
            this.dataLayer.saveChannelList(
                imageChannelsIdx,
                this.currentChannels,
                this.colorConnector,
                this.rangeConnector,
                this.image_channels
            );
            alert("Saved Channels from Database");
        });
    }


    /**
     * @function toggleChannelPanel
     *
     * @param {Event} event - The event
     * @param svgCol - the column to expand or collapse
     */
    toggleChannelPanel(event, svgCol) {

        // If you clicked on the svg, ignore this behavior
        if (event.target.closest("svg")) {
            return;
        }

        // Get info
        let parent = event.target.closest(".list-group-item");
        let name = parent.querySelector('.channel-name').textContent;
        let channelID = this.channelIDs[name];
        let status = !parent.classList.contains("active");

        // If active - else inactive
        if (status) {

            // Don't add channel is the max are selected
            if (_.size(this.selections) >= this.maxSelections) {
                return;
            }

            // Update properties and add slider
            d3.select(parent).classed("active", true);
            svgCol.style.display = "block";
            d3.select('div#channel-slider_' + channelID).style('display', "block")
            d3.select('div#image-auto_' + channelID).style('display', "block");

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
            d3.select('div#channel-slider_' + channelID).style('display', "none")
            d3.select('div#image-auto_' + channelID).style('display', "none");

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

    /**
    add a slider to a channel
    @param {} data - the min and max range of the slider
    @param {} activeRange - the predefined values for the lower and upper handle
    @param {String} name - the name of the slider (used as part of the id)
    @param {} swidth - the pixel width of the slider
     */
    addSlider(name, swidth, activeRange) {

        const f = (d3.format('.2%'))
        let channelID = this.channelIDs[name];
        const fullName = this.dataLayer.getFullChannelName(name);
        const { xDomain, yDomain, histogramData} = this.histogramData(fullName); 
        let data_min = this.databaseDescription[fullName]['image_min'];
        let data_max = this.databaseDescription[fullName]['image_max'];

        //add range slider row content
        const sliderSimple = d3.sliderBottom(d3.scaleLog())
            .min(data_min)
            .max(data_max)
            .width(swidth - 75)//.tickFormat(d3.format("s"))
            .fill('orange')
            .on('onchange', (range) => {
                const v0 = Math.round(range[0]);
                const v1 = Math.round(range[1]);
                d3.select('#slider-input' + channelID + 0).attr('value', v0);
                d3.select('#slider-input' + channelID + 0).property('value', v0);
                d3.select('#slider-input' + channelID + 1).attr('value', v1);
                d3.select('#slider-input' + channelID + 1).property('value', v1);
                this.moveSliderHandles(sliderSimple, [v0, v1], name);
            })
            .ticks(5)
            .default([Math.round(activeRange[0]), Math.round(activeRange[1])])
            .handle(
                d3.symbol()
                    .type(d3.symbolCircle)
                    .size(100)
            )
            .tickValues([])

        this.sliders.set(name, sliderSimple);

        //create the slider svg and call the slider
        var gSimple = d3
            .select('#channel-slider_' + channelID)
            .append('svg')
            .attr('class', 'svgslider')
            .attr('id', 'channel-slider_svg_' + channelID)
            .attr('width', swidth)
            .attr('height', 80)
            .append('g')
            .attr('transform', 'translate(20,40)');

        let xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, swidth - 73])

        let yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([0, 23])

        let line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX)

        const lines = gSimple.selectAll('.image_distribution_line');
        const paths = lines.data([histogramData]).enter().append('path');
        paths
        .attr('d', line)
        .attr('class', 'image_distribution_line')
        .attr('transform', 'translate(0,-31)')
        .attr('fill', 'none')

        gSimple.call(sliderSimple);

        //slider value to be displayed closer to the slider than default
        d3.selectAll('.parameter-value').select('text')
            .attr("y", 10);

        //both handles
        const { sliders } = this;
        const handles = d3.select('#channel-slider_' + channelID).selectAll(".parameter-value");
        handles.each(function(d, i) {
            d3.select(this).append("foreignObject")
            .attr('id', 'foreignObject_' + channelID + i)
            .attr("width", 50)
            .attr("height", 40)
            .attr('x', -25)
            .attr( 'y', -17)
            .style('padding',"10px")
            .append("xhtml:body")
            .attr('xmlns','http://www.w3.org/1999/xhtml')
            .style('background', 'none')
            .append('input')
            .attr( 'y', -17)
            .attr('id', 'slider-input' + channelID + i)
            .attr('type', 'text')
            .attr('class', 'input')
            .attr('value', () => {
                return sliders.get(name).value()[i]
            });
            //remove the previous text label
            d3.select(this).select('text').remove();
        });

        //entering a value in the input field of a slider handle
        const moveSliderHandles = this.moveSliderHandles.bind(this);
        handles.selectAll('.input').on('keydown', function (event, d) {
          if(event.key == "Enter"){
              const val = parseFloat(this.value.replace("%", ""));
              const vals = sliderSimple.silentValue();
              vals[d.index] = val;
              moveSliderHandles(sliderSimple, vals, name);
          }
        })

        return sliderSimple;
    };

    histogramData(fullName) {
        const histogramData = this.databaseDescription[fullName].image_histogram;
        const xMin = Math.min(...histogramData.map(e => e.x));
        const xMax = Math.max(...histogramData.map(e => e.x));
        const yMax = Math.max(...histogramData.map(e => e.y));
        return {
            histogramData,
            xDomain: [xMin, xMax],
            yDomain: [yMax, 0],
        };
    }

    async getAndDrawChannelGMM(name) {
        const fullName = this.dataLayer.getFullChannelName(name);
        const packet = await this.dataLayer.getChannelGMM(fullName);
        const channelID = this.channelIDs[name];
        const autoBtn = document.getElementById(`auto-btn_${channelID}`);
        autoBtn.classList.remove("auto-loading")
        this.hasChannelGMM[name] = packet;

        this.drawChannelGMM(name);
    }

    drawChannelGMM(name) {
        let channelID = this.channelIDs[name];
        let packet = this.hasChannelGMM[name];
        let channel_gmm1Data = packet['image_gmm_1'];
        let channel_gmm2Data = packet['image_gmm_2'];
        let channel_gmm3Data = packet['image_gmm_3'];
        const fullName = this.dataLayer.getFullChannelName(name);
        const { xDomain, yDomain } = this.histogramData(fullName); 

        const channelListEl = document.getElementById("channel_list");
        const swidth = channelListEl.getBoundingClientRect().width;

        let xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, swidth - 73])

        let yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([0, 23])

        let line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX)

        let gSimple = d3.select('#channel-slider_svg_' + channelID + ' g')

        gSimple.selectAll('.image_gmm1_line')
            .data([channel_gmm1Data])
            .enter()
            .append('path')
            .attr('d', line)
            .attr('class', 'gmm_line')
            .attr('class', 'gmm_line_'+name)
            .attr('transform', 'translate(0,-31)')
            .attr('fill', 'none')
            .attr('stroke', 'green')

        gSimple.selectAll('.image_gmm2_line')
            .data([channel_gmm2Data])
            .enter()
            .append('path')
            .attr('d', line)
            .attr('class', 'gmm_line')
            .attr('class', 'gmm_line_'+name)
            .attr('transform', 'translate(0,-31)')
            .attr('fill', 'none')
            .attr('stroke', 'blue')

        gSimple.selectAll('.image_gmm3_line')
            .data([channel_gmm3Data])
            .enter()
            .append('path')
            .attr('d', line)
            .attr('class', 'gmm_line')
            .attr('class', 'gmm_line_'+name)
            .attr('transform', 'translate(0,-31)')
            .attr('fill', 'none')
            .attr('stroke', 'red')
    }

    /**
     * @function moveSliderHandles - move the slider handles and input fields so that input fields don't overlap when handles are close
     *
     * @param slider - the slider affected
     * @param vals - holds the new positions
     * @param name - the name of the slider
     */
    moveSliderHandles(slider, vals, name){
        let channelID = this.channelIDs[name];
        this.image_channels[name] = vals;
        slider.silentValue(vals);
        if (vals[1] - vals[0] < 0.41){
            console.log('slider handles overlap..do something');
            d3.select('#foreignObject_'  + channelID + 1).attr('x', 5);
        }else{
            d3.select('#foreignObject_'  + channelID + 1).attr('x', -25);
        }
        const packet = {name: name, dataRange: [...vals]};
        this.eventHandler.trigger(ChannelList.events.BRUSH_MOVE, packet);
    }

    /**
     */
    resetChannelList() {
        let channelList = _.clone(this.selections);
        _.each(channelList, col => {
            let channelID = this.channelIDs[col];
            let channel_selector = `#channel-slider_${channelID}`;
            document.querySelector(channel_selector).click();
        });
    }
}

/**
 * on window resize we re-initialize (this should be better handled with an update pattern)
 */
window.addEventListener("resize", function () {
    const { channelList } = __minervaAnalysis;
    if (typeof channelList != "undefined" && channelList) {
        channelList.sliders.forEach((slider, name) => {
            let channelID = channelList.channelIDs[name]
            d3.select('div#channel-slider_' + channelID).select('svg').remove();
            const channelListEl = document.getElementById("channel_list");
            if (channelListEl) {
                const swidth = channelListEl.getBoundingClientRect().width;
                channelList.addSlider(name, swidth, slider.value());
                if (channelList.hasChannelGMM[name]) {
                    channelList.drawChannelGMM(name);
                }
            }
      });
    }
});

//static vars: events introduced in this class and used across the app
ChannelList.events = {
    BRUSH_MOVE: "BRUSH_MOVE",
    COLOR_TRANSFER_CHANGE_MOVE: "COLOR_TRANSFER_CHANGE_MOVE",
    COLOR_TRANSFER_CHANGE: "COLOR_TRANSFER_CHANGE",
    CHANNELS_CHANGE: "CHANNELS_CHANGE",
    CHANNEL_SELECT: "CHANNEL_SELECT",
    RESET_LISTS: "RESET_LISTS"
};
