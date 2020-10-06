class CSVGatingList {

    constructor(config, dataLayer, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.selections = {};
        this.maxSelections = 1;
        this.ranges = {};
        this.sliders = new Map();
        // this.imageBitRange = [0, 65536];

        this.container = d3.select("#csv_gating_list");

        // Gating vars
        this.global_channel_list = channelList;
        this.global_image_channels = imageChannels;
        this.gating_default_range = [0, 65536];
        this.gating_channels = this.init_gating_channels();
        this.gating_list = null;

        // Download vars
        this.download_panel_visible = false;
        this.download_input1 = null;
        this.download_input2 = null;
    }

    selectChannel(name) {
        this.selections[this.dataLayer.getFullChannelName(name)] = this.sliders.get(name).value();
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
    }

    async init() {
        // this.rainbow.hide();
        this.columns = await this.dataLayer.getChannelNames(true);
        this.databaseDescription = await this.dataLayer.getDatabaseDescription();
        // Hide the Loader
        document.getElementById('csv_gating_list_loader').style.display = "none";
        this.gating_list = document.getElementById("csv_gating_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        this.gating_list.appendChild(list)
        // Will show the picker when you click on a color rect
        let showPicker = () => {
            this.colorTransfrHandle = d3.select(d3.event.target);
            let color = this.colorTransferHandle.style('fill');
            let hsl = d3.hsl(color);
            this.rainbow.show(d3.event.clientX, d3.event.clientY);
        };
        // Draws rows in the gating list
        _.each(this.columns, column => {
            // div for each row in gating list
            let listItemParentDiv = document.createElement("div");
            listItemParentDiv.classList.add("list-group-item");
            listItemParentDiv.classList.add("container");
            listItemParentDiv.classList.add("gating-list-content");
            // row
            let row = document.createElement("div");
            row.classList.add("row");
            listItemParentDiv.appendChild(row);
            // row
            let row2 = document.createElement("div");
            row2.classList.add("row");
            listItemParentDiv.appendChild(row2);

            // column within row that contains the name of the gating
            let nameCol = document.createElement("div");
            nameCol.classList.add("col-md-4");
            nameCol.classList.add("gating-col");
            row.appendChild(nameCol);

            // column within row that cintains the slider for the gating
            let sliderCol = document.createElement("div");
            sliderCol.classList.add("col-md-12");
            sliderCol.classList.add("csv_gating-slider");
            sliderCol.setAttribute('id', "csv_gating-slider_" + column)
            row2.appendChild(sliderCol);

            // column within row that contains svg for color pickers
            let svgCol = document.createElement("div");
            svgCol.classList.add("col-md-4");
            svgCol.classList.add("ml-auto");
            svgCol.classList.add("gating-col");
            svgCol.classList.add("gating-svg-wrapper");
            svgCol.classList.add("col-svg-wrapper");
            row.appendChild(svgCol);


            let svg = d3.select(svgCol)
                .append("svg")
                .attr("width", 30)
                .attr("height", 15)
            svgCol.style.display = "none";

            let gatingName = document.createElement("span");
            gatingName.classList.add("gating-name");
            gatingName.textContent = column;
            nameCol.appendChild(gatingName);
            listItemParentDiv.addEventListener("click", e => this.abstract_click(e, svgCol));
            list.appendChild(listItemParentDiv);

            //add and hide gating sliders (will be visible when gating is active)
            const fullName = this.dataLayer.getFullChannelName(column)
            const sliderRange = [this.databaseDescription[fullName].min, this.databaseDescription[fullName].max]
            this.addSlider(sliderRange, sliderRange, column, document.getElementById("csv_gating_list").getBoundingClientRect().width);
            d3.select('div#csv_gating-slider_' + column).style('display', "none");
        });

        // Add events
        this.add_events();
        this.add_events_linked();
    }

    /**
     * @function init_gating_channels
     *
     * @return obj
     */
    init_gating_channels() {

        // Init
        const obj = {};

        // Iterate to create fields
        for (let key in this.global_image_channels) {
            obj[key] = this.gating_default_range;
        }

        // Return
        return obj;
    }

    /**
     * @function abstract_click
     *
     * @param e
     * @param svgCol
     */
    abstract_click(event, svgCol) {

        // Define this
        const self = this;

        // If you clicked on the svg, ignore this behavior
        if (event.target.closest("svg")) {
            return;
        }

        // Get info
        let parent = event.target.closest(".list-group-item");
        let name = parent.querySelector('.gating-name').textContent;
        let status = !parent.classList.contains("active");

        // If active - else inactive
        if (status) {

            // Clear everything
            clearOut();

            // Don't add gating is the max are selected
            if (_.size(this.selections) >= this.maxSelections) {
                return;
            }

            // Update properties and add slider
            d3.select(parent).classed("active", true);
            svgCol.style.display = "block";
            d3.select('div#csv_gating-slider_' + name).style('display', "block")

            // Add channel
            this.selectChannel(name);

        } else {
            // Clear panel visibility
            clearOut();

            // Trigger viewer cleanse
            this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
        }

        // Abstracted clearing
        function clearOut() {

            // Delete from active selections and deactivate
            self.selections = {};
            d3.select(self.gating_list).selectAll(".active")
                .classed('active', false);
            d3.selectAll('.gating-svg-wrapper').style('display', "none");
            d3.selectAll('.csv_gating-slider').style('display', "none");
        }

        //
        let selectionsHeaderDiv = document.getElementById("csv_selected-gatings-header-div");
        if (selectionsHeaderDiv) {
            if (_.size(this.selections) >= this.maxSelections) {
                selectionsHeaderDiv.classList.add('bold-selections-header');
            } else {
                selectionsHeaderDiv.classList.remove('bold-selections-header');
            }
            let packet = {selections: this.selections, name, status};
            // console.log('gatings_change', packet);
            document.getElementById("csv_num-selected-gatings").textContent = _.size(this.selections);

            // Trigger event
            this.eventHandler.trigger(CSVGatingList.events.GATING_CHANNELS_CHANGE, packet);

        }
    }

    /**
     * @function add_events
     *
     */
    add_events() {

        const self = this;

        // Els
        const gating_download_icon = document.querySelector('#gating_download_icon');
        const gating_download_panel = document.querySelector('#gating_download_panel');
        const gating_exit = document.querySelector('#gating_exit');
        const download_gated_channel_ranges = document.querySelector('#download_gated_channel_ranges');
        const download_gated_cell_encodings = document.querySelector('#download_gated_cell_encodings');
        const download_input1 = document.querySelector('#download_input1');
        const download_input2 = document.querySelector('#download_input2');
        const gating_controls_outlines = document.querySelector('#gating_controls_outlines')

        // Events ::

        // Open / close download panel
        gating_download_icon.addEventListener('click', () => {
            // Update class var
            this.download_panel_visible = !this.download_panel_visible;
            // Condition to update download panel visibility
            if (this.download_panel_visible) {
                gating_download_panel.style.visibility = 'visible';
            } else {
                gating_download_panel.style.visibility = 'hidden';
            }
        });

        // Close download panel
        gating_exit.addEventListener('click', () => {
            // Update class var
            this.download_panel_visible = !this.download_panel_visible;
            // Hide download panel
            gating_download_panel.style.visibility = 'hidden';
        });

        // Download gated channel ranges
        download_gated_channel_ranges.addEventListener('click', () => {

            // Format at csv
            const rows = [['channel_name', 'gated_min', 'gated_max']];
            for (let key in this.gating_channels) {
                rows.push([key, this.gating_channels[key][0], this.gating_channels[key][1]]);
            }
            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");

            // Download - ref. https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", download_input1.value);
            document.body.appendChild(link);
            link.click();

        })

        // Download gated channel ranges
        download_gated_cell_encodings.addEventListener('click', () => {
            console.log(download_input2.value);
            console.log(this.gating_channels)
            self.dataLayer.downloadGatingCSV(self.selections)
        })

        // Toggle outlined / filled cell selections
        gating_controls_outlines.addEventListener('change', e => {
            seaDragonViewer.outlines = e.target.checked;
            seaDragonViewer.forceRepaint();
        })

    }

    /**
     * @function add_events_linked
     *
     */
    add_events_linked() {

        // Add events to channel
        const channelListContent = document.querySelectorAll('.channel-list-content');
        const gatingListContent = document.querySelectorAll('.gating-list-content');

        // Attach
        const attach = (targets, matches, target_class, match_class, global) => {
            targets.forEach(cLC => {
                cLC.addEventListener('click', e => {

                    // If event target is not an svg el (from slider)
                    const svgEls = ['path']
                    if (!svgEls.includes(e.target.tagName)) {

                        // Get channel name
                        const name = e.target.querySelector(`.${target_class}`).innerText;

                        // Find match el in gating list
                        const match = Array.from(matches).find(
                            gLC => gLC.querySelector(`.${match_class}`).innerText === name);

                        // Emulate click to trigger event in csvGatingList.js
                        if (match && !Array.from(match.classList).includes('active')) {
                            const fakeEvent = {target: match};
                            const svgCol = match.querySelector('.col-svg-wrapper')
                            global.abstract_click(fakeEvent, svgCol);
                        }
                    }
                });
            });
        }
        attach(gatingListContent, channelListContent, 'gating-name', 'channel-name',
            this.global_channel_list);

    }

    /*
    add a slider
    @data the min and max range of the slider
    @activeRange the predefined values for the lower and upper handle
    @name the name of the slider (used as part of the id)
    @swidth the pixel width of the slider
     */
    addSlider(data, activeRange, name, swidth) {

        const self = this;
        //add range slider row content
        var sliderSimple = d3.slider
            .sliderBottom()
            .min(d3.min(data))
            .max(d3.max(data))
            .width(swidth - 60)//.tickFormat(d3.format("s"))
            .fill('orange')
            .ticks(5)
            .default(activeRange)
            .handle(
                d3.symbol()
                    .type(d3.symbolCircle)
                    .size(100))
            .tickValues([])
            .on('end', range => {
                // For interaction
                self.selections[self.dataLayer.getFullChannelName(name)] = range;
                let packet = self.selections;
                this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, packet);

                // For records
                this.gating_channels[self.dataLayer.getFullChannelName(name)] = range;
            });
        this.sliders.set(name, sliderSimple);

        //create the slider svg and call the slider
        var gSimple = d3
            .select('#csv_gating-slider_' + name)
            .append('svg')
            .attr('class', 'svgslider')
            .attr('width', swidth)
            .attr('height', 30)
            .append('g')
            .attr('transform', 'translate(20,10)');
        gSimple.call(sliderSimple);

        //slider value to be displayed closer to the slider than default
        d3.selectAll('.parameter-value').select('text')
            .attr("y", 10);

        return sliderSimple;
    };
}

window.addEventListener("resize", function () {
    //reinitialize slider on window change..(had some bug updating with via d3 update)
    if (csv_gatingList) {
        csv_gatingList.sliders.forEach(function (slider, name) {
            d3.select('div#csv_gating-slider_' + name).select('svg').remove();
            csv_gatingList.addSlider(csv_gatingList.imageBitRange, slider.value(), name,
                document.getElementById("csv_gating_list").getBoundingClientRect().width);
        });
    }
});

//static vars
CSVGatingList.events = {
    GATING_BRUSH_MOVE: "GATING_BRUSH_MOVE",
    GATING_BRUSH_END: "GATING_BRUSH_END",
    GATING_COLOR_TRANSFER_CHANGE_MOVE: "GATING_TRANSFER_CHANGE_MOVE",
    GATING_COLOR_TRANSFER_CHANGE: "GATING_TRANSFER_CHANGE",
    GATING_CHANNELS_CHANGE: "GATING_CHANNELS_CHANGE"
};