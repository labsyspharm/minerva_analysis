class CSVGatingList {

    constructor(config, dataLayer, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.selections = {};
        this.maxSelections = 4;
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

    removeChannel(name) {
        delete this.selections[this.dataLayer.getFullChannelName(name)];
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
    }

    async init() {
        // this.rainbow.hide();
        const self = this;
        self.columns = await self.dataLayer.getChannelNames(true);
        self.databaseDescription = await self.dataLayer.getDatabaseDescription();
        document.getElementById('drag-and-drop-info').style.display = "none";
        // Hide the Loader
        document.getElementById('csv_gating_list_loader').style.display = "none";
        self.gating_list = document.getElementById("csv_gating_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        list.setAttribute("id", "gating_list_ul")
        self.gating_list.appendChild(list)
        self.sliderWidth = document.getElementById("csv_gating_list").getBoundingClientRect().width;
        // Will show the picker when you click on a color rect
        let showPicker = () => {
            self.colorTransfrHandle = d3.select(d3.event.target);
            let color = self.colorTransferHandle.style('fill');
            let hsl = d3.hsl(color);
            self.rainbow.show(d3.event.clientX, d3.event.clientY);
        };
        // Draws rows in the gating list
        _.each(self.columns, column => {
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
            listItemParentDiv.addEventListener("click", e => self.abstract_click(e, svgCol));
            list.appendChild(listItemParentDiv);

            //add and hide gating sliders (will be visible when gating is active)
            const fullName = self.dataLayer.getFullChannelName(column);
            const sliderRange = [self.databaseDescription[fullName].min, self.databaseDescription[fullName].max];
            self.gating_channels[fullName] = sliderRange;
            self.addSlider(sliderRange, sliderRange, column, self.sliderWidth);
            d3.select('div#csv_gating-slider_' + column).style('display', "none");
        });


        var dropzone = new Dropzone("#csv_gating_list", {
            url: "/upload_gates",
            clickable: false,
            disablePreview: true,
            createImageThumbnails: false
        });
        dropzone.on("sending", function (file, xhr, formData) {
            formData.append("datasource", datasource);
        });
        dropzone.on("queuecomplete", function (file, xhr, formData) {
            return self.apply_gates()
        });

        // Adding upload when you press on the up arrow
        let arrow = document.getElementById('gating_upload_arrow')

        function performClick(elemId) {

        }

        arrow.onclick = function () {
            let elem = document.getElementById('gating-upload-from-arrow');
            if (elem && document.createEvent) {
                let evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, false);
                elem.dispatchEvent(evt);
            }
        }
        document.getElementById("gating-upload-from-arrow").onchange = async function () {
            if (document.getElementById("gating-upload-from-arrow").files) {
                let file = document.getElementById("gating-upload-from-arrow").files[0]
                let formData = new FormData();
                formData.append("file", file);
                await self.dataLayer.submitGatingUpload(formData);
                document.getElementById("gating-upload-from-arrow").value = []
                await self.apply_gates()
            }
        }


        // Adding dropzone for CSV_Gating_List
        let parent = document.getElementById('csv_gating_list');
        let rect = parent.getBoundingClientRect();
        parent.addEventListener("dragover", (ev) => {
            document.getElementById('gating_list_ul').style.display = "none";
            document.getElementById('drag-and-drop-info').style.display = "block";
        })
        parent.addEventListener("dragleave", (ev) => {
            if (ev.x > rect.left + rect.width || ev.x < rect.left
                || ev.y > rect.top + rect.height || ev.y < rect.top) {
                document.getElementById('gating_list_ul').style.display = "block";
                document.getElementById('drag-and-drop-info').style.display = "none";
            }
        })
        parent.addEventListener("drop", (ev) => {
            document.getElementById('gating_list_ul').style.display = "block";
            document.getElementById('drag-and-drop-info').style.display = "none";
        })

        // Add events
        self.add_events();
        self.add_events_linked();
    }

    async apply_gates() {
        const self = this;
        let gates = await self.dataLayer.getUploadedGatingCsvValues()
        _.each(gates, col => {
            let shortName = self.dataLayer.getShortChannelName(col.channel);
            if (self.sliders.get(shortName)) {
                self.sliders.get(shortName).value([col.gate_start, col.gate_end]);
                this.gating_channels[col.channel] = [col.gate_start, col.gate_end];
                if (col.gate_active) {
                    // IF the channel isn't active, make it so
                    if (!self.selections[col.channel]) {
                        let selector = `#csv_gating-slider_${shortName}`;
                        document.querySelector(selector).click();
                    }
                    self.selections[col.channel] = [col.gate_start, col.gate_end];

                    // For records

                } else {
                    // If channel is currently active, but shouldn't be, update it
                    if (self.selections[col.channel]) {
                        let selector = `#csv_gating-slider_${shortName}`;
                        document.querySelector(selector).click();
                    }
                    delete this.selections[col.channel];
                }
            }
        })
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);

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
            // clearOut();

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
            // clearOut();

            // Remove channel and rerender
            this.removeChannel(name);

            // Hide
            d3.select(parent).classed("active", false);
            svgCol.style.display = "none";
            d3.select('div#csv_gating-slider_' + name).style('display', "none")

            // Trigger viewer cleanse
            this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
        }

        // Abstracted clearing
        /*
        function clearOut() {

            // Delete from active selections and deactivate
            self.selections = {};
            d3.select(self.gating_list).selectAll(".active")
                .classed('active', false);
            d3.selectAll('.gating-svg-wrapper').style('display', "none");
            d3.selectAll('.csv_gating-slider').style('display', "none");
        }
        */

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
            let test = ''
            self.dataLayer.downloadGatingCSV(this.gating_channels, this.selections, false);
            // // Format at csv
            // const rows = [['channel_name', 'gated_min', 'gated_max']];
            // for (let key in this.gating_channels) {
            //     rows.push([key, this.gating_channels[key][0], this.gating_channels[key][1]]);
            // }
            // const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
            //
            // // Download - ref. https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
            // const encodedUri = encodeURI(csvContent);
            // const link = document.createElement("a");
            // link.setAttribute("href", encodedUri);
            // link.setAttribute("download", download_input1.value);
            // document.body.appendChild(link);
            // link.click();

        })

        // Download gated channel ranges
        download_gated_cell_encodings.addEventListener('click', () => {
            self.dataLayer.downloadGatingCSV(this.gating_channels, this.selections, true);
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
                        const name = _.get(e.target.querySelector(`.${target_class}`), 'innerText');

                        // Find match el in gating list
                        if (name) {
                            const match = Array.from(matches).find(
                                gLC => gLC.querySelector(`.${match_class}`).innerText === name);

                            // Emulate click to trigger event in csvGatingList.js
                            if (match && !Array.from(match.classList).includes('active')) {
                                const fakeEvent = {target: match};
                                const svgCol = match.querySelector('.col-svg-wrapper')
                                global.abstract_click(fakeEvent, svgCol);
                            }
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
        let histogramData = this.databaseDescription[this.dataLayer.getFullChannelName(name)]['histogram']

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
            .attr('id', '#csv_gating-slider_svg_' + name)
            .attr('width', swidth)
            .attr('height', 30)
            .append('g')
            .attr('transform', 'translate(20,13)');
        let xScale = d3.scaleLinear()
            .domain([0, _.max(_.map(histogramData, e => e.x))]) // input
            .range([0, swidth - 60])

        let yScale = d3.scaleLinear()
            .domain([_.max(_.map(histogramData, e => e.y)), 0])
            .range([0, 10])

        let line = d3.line()
            .x(d => {
                return xScale(d.x)
            })
            .y(d => {
                return yScale(d.y)
            })
            .curve(d3.curveMonotoneX)


        gSimple.selectAll('.distribution_line')
            .data([histogramData])
            .enter()
            .append('path')
            .attr('d', line)
            .attr('class', 'distribution_line')
            .attr('transform', 'translate(0,-12)')
            .attr('fill', 'none')
        gSimple.call(sliderSimple);


        //slider value to be displayed closer to the slider than default
        d3.selectAll('.parameter-value').select('text')
            .attr("y", 10);


        return sliderSimple;
    }
    ;
}

window
    .addEventListener(
        "resize"
        ,

        function () {
            //reinitialize slider on window change..(had some bug updating with via d3 update)
            if (csv_gatingList) {
                csv_gatingList.sliders.forEach(function (slider, name) {
                    d3.select('div#csv_gating-slider_' + name).select('svg').remove();
                    csv_gatingList.addSlider(csv_gatingList.imageBitRange, slider.value(), name,
                        document.getElementById("csv_gating_list").getBoundingClientRect().width);
                });
            }
        }
    )
;

//static vars
CSVGatingList
    .events = {
    GATING_BRUSH_MOVE: "GATING_BRUSH_MOVE",
    GATING_BRUSH_END: "GATING_BRUSH_END",
    GATING_COLOR_TRANSFER_CHANGE_MOVE: "GATING_TRANSFER_CHANGE_MOVE",
    GATING_COLOR_TRANSFER_CHANGE: "GATING_TRANSFER_CHANGE",
    GATING_CHANNELS_CHANGE: "GATING_CHANNELS_CHANGE"
};