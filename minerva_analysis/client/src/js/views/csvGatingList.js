/**
 * @class CSVGatingList - A view to select and deselect channels for gating, and to set gates (filter ranges) in the tabular data
 */
class CSVGatingList {

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
        this.selections = {};
        this.hasGatingGMM = {};
        this.gatingIDs = {};
        this.sliders = new Map();
        this.container = d3.select("#csv_gating_list");
        // Gating vars
        const { channelList } = __minervaAnalysis;
        this.global_channel_list = channelList;
        this.global_image_channels = imageChannels;
        this.gating_default_range = [0, 65536];
        this.gating_channels = this.initGatingChannels();
        this.gating_list = null;
        // Download vars
        this.download_panel_visible = false;
        this.download_input1 = null;
        this.download_input2 = null;
        // Eval settings
        this.eval_mode = 'and'
    }

     /**
     * Selects a channel as active and adds the respective visual components to the channel panel in the list view
     * @param name - the channel to set and display as selected
     */
    selectChannel(name) {
        const fullName = this.dataLayer.getFullChannelName(name);
        const values = this.gating_channels[fullName];
        this.selections[fullName] = values;
        this.sliders.get(name).value(values);
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_MOVE, this.selections);
        this.getAndDrawGatingGMM(name).then(() => {
            this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
        });
    }

     /**
     * Removes a channel form the current selection
     * @param name - the name of the channel to remove
     */
    removeChannel(name) {
        // Delete
        const fullName = this.dataLayer.getFullChannelName(name);
        delete this.selections[fullName];

        // Trigger
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
    }

     /**
     * initializes the view (channel list)
     * @param dd - database description
     * @param seaDragonViewer - the ImageViewer instance
     * @returns {Promise<void>}
     */
    init(dd, seaDragonViewer) {
        this.databaseDescription = dd;
        this.seaDragonViewer = seaDragonViewer; 
        document.getElementById('drag-and-drop-info').style.display = "none";
        // Hide the Loader
        document.getElementById('csv_gating_list_loader').style.display = "none";
        this.gating_list = document.getElementById("csv_gating_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        list.setAttribute("id", "gating_list_ul")
        this.gating_list.appendChild(list)
        const gatingListEl = document.getElementById("csv_gating_list");
        const swidth = gatingListEl.getBoundingClientRect().width;
        // Will show the picker when you click on a color rect
        let showPicker = () => {
            this.colorTransfrHandle = d3.select(d3.event.target);
            let color = this.colorTransferHandle.style('fill');
            let hsl = d3.hsl(color);
            this.rainbow.show(d3.event.clientX, d3.event.clientY);
        };
        // Draws rows in the gating list
        this.columns.push('Area'); // Add 'Area' to Gating List
        _.each(this.columns, column => {
            let channelID = column.replace(/[ ,.]/g, '').replace(/\//g, '');
            this.gatingIDs[column] = channelID;
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
            sliderCol.setAttribute('id', "csv_gating-slider_" + channelID)
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
            gatingName.classList.add('gating-name');
            gatingName.textContent = column;
            nameCol.appendChild(gatingName);
            listItemParentDiv.addEventListener("click", e => {
                return this.toggleChannelPanel(e, svgCol);
            })
            list.appendChild(listItemParentDiv);

            //add and hide gating sliders (will be visible when gating is active)
            const fullName = this.dataLayer.getFullChannelName(column);
            const sliderRange = [this.databaseDescription[fullName].min, this.databaseDescription[fullName].max];
            this.gating_channels[fullName] = sliderRange;
            const gatingListEl = document.getElementById("csv_gating_list");
            const swidth = gatingListEl.getBoundingClientRect().width;
            this.addSlider(column, swidth, sliderRange, sliderRange);
            d3.select('div#csv_gating-slider_' + channelID).style('display', "none");

            let autoCol = document.createElement("div");
            autoCol.classList.add("col-md-4");
            autoCol.classList.add("ml-auto");
            autoCol.classList.add("csv_gating-auto")
            autoCol.setAttribute('id', "csv_gating-auto_" + channelID)
            autoCol.classList.add("gating-col");
            autoCol.classList.add("gating-svg-wrapper");
            row.appendChild(autoCol);

            let autoBtn = document.createElement("button");
            autoBtn.classList.add('auto-btn');
            autoBtn.classList.add('auto-loading');
            autoBtn.setAttribute('id', "auto-btn-gating_" + channelID);
            autoBtn.textContent = "auto";
            autoBtn.addEventListener("click", async () => {
                const shortName = this.dataLayer.getShortChannelName(fullName);
                await this.autoGate(shortName);
            });

            autoCol.appendChild(autoBtn);
            autoBtn.addEventListener("click", e => e.stopPropagation());
            d3.select(autoCol).style('display', "none");
        });

        var dropzone = new Dropzone("#csv_gating_list", {
            url: "/upload_gates",
            clickable: false,
            disablePreview: true,
            createImageThumbnails: false
        });
        dropzone.on("sending", (file, xhr, formData) => {
            formData.append("datasource", datasource);
        });
        dropzone.on("queuecomplete", (file, xhr, formData) => {
            return this.applyGates()
        });

        // Adding upload when you press on the up arrow
        let arrow = document.getElementById('gating_upload_icon')
        arrow.onclick = () => {
            let elem = document.getElementById('gating-upload-from-arrow');
            if (elem && document.createEvent) {
                let evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, false);
                elem.dispatchEvent(evt);
            }
        }
        document.getElementById("gating-upload-from-arrow").onchange = async () => {
            if (document.getElementById("gating-upload-from-arrow").files) {
                let file = document.getElementById("gating-upload-from-arrow").files[0]
                let formData = new FormData();
                formData.append("file", file);
                await this.dataLayer.submitGatingUpload(formData);
                document.getElementById("gating-upload-from-arrow").value = []
                await this.applyGates('file')
            }
        }

        let arrow_db = document.getElementById('gating_upload_icon_db')
        arrow_db.onclick = async () => {
            await this.applyGates('db')
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
        this.addDownloadEvents();
        this.addEventsLinked();
    }

     /**
     * @function applyGates
     * Applies settings (from file or db) to the gates in the tool
     * @parms {String} source Whether it is from new file upload or saved
     */
    async applyGates(source) {
        let gates;
        if (source === 'file'){
            gates = await this.dataLayer.getUploadedGatingCsvValues();
        } else {
            gates = await this.dataLayer.getSavedGatingList();
        }

        this.eventHandler.trigger(CSVGatingList.events.RESET_GATINGLIST)

        _.each(gates, col => {
            let shortName = this.dataLayer.getShortChannelName(col.channel);
            let channelID = this.gatingIDs[shortName];
            if (this.sliders.get(shortName)) {
                let toggle_off
                if (!col.gate_active && col.channel in this.selections) {
                    toggle_off = true;
                } else {
                    toggle_off = false;
                }
                this.gating_channels[col.channel] = [col.gate_start, col.gate_end];
                if (col.gate_active) {
                    // IF the channel isn't active, make it so
                    if (!this.selections[col.channel]) {
                        let selector = `#csv_gating-slider_${channelID}`;
                        document.querySelector(selector).click();
                    }
                    this.selections[col.channel] = [col.gate_start, col.gate_end];

                    // For records

                } else {
                    // If channel is currently active, but shouldn't be, update it
                    if (toggle_off) {
                        let selector = `#csv_gating-slider_${channelID}`;
                        document.querySelector(selector).click();
                    }
                    delete this.selections[col.channel];
                }
            }
        })
        // Trigger brush
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
    }

    /**
     * @function autoGate - applies thresholds based on Gaussian Mixture Model
     * @param name - the name of the channel to apply it to
     */
    async autoGate(shortName) {
        const transformed = this.dataLayer.isTransformed();
        const input = (await this.getGatingGMM(shortName)).gate.toFixed(7);
        const gate = transformed ? parseFloat(input) : parseInt(input);
        const fullName = this.dataLayer.getFullChannelName(shortName);
        if (fullName in this.selections) {
            const gate_end = this.selections[fullName][1];
            const slider = this.sliders.get(shortName);
            const values = [gate, gate_end];
            this.moveSliderHandles(slider, values, shortName, 'GATING_BRUSH_END');
        }
    }

    /**
     * @function initGatingChannels - creates the data structure for channels
     * @return obj - allChannels and their default range
     */
    initGatingChannels() {

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
     * @function toggleChannelPane - expands or collapses a channel panel in the list that was clicked on
     * @param event - the click vent
     * @param svgCol - the column to expand or collapse
     */
    toggleChannelPanel(event, svgCol) {

        // If you clicked on the svg, ignore this behavior
        if (event.target.closest("svg")) {
            return;
        }

        // Get info
        let parent = event.target.closest(".list-group-item");
        let name = parent.querySelector('.gating-name').textContent;
        let channelID = this.gatingIDs[name];
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
            d3.select('div#csv_gating-slider_' + channelID).style('display', "block")
            d3.select('div#csv_gating-auto_' + channelID).style('display', "block");

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
            d3.select('div#csv_gating-slider_' + channelID).style('display', "none")
            d3.select('div#csv_gating-auto_' + channelID).style('display', "none");
        }

        let selectionsHeaderDiv = document.getElementById("csv_selected-gatings-header-div");
        if (selectionsHeaderDiv) {
            if (_.size(this.selections) >= this.maxSelections) {
                selectionsHeaderDiv.classList.add('bold-selections-header');
            } else {
                selectionsHeaderDiv.classList.remove('bold-selections-header');
            }
            document.getElementById("csv_num-selected-gatings").textContent = _.size(this.selections);

            // Trigger event
            const packet = {selections: this.selections, name, status};
            this.eventHandler.trigger(CSVGatingList.events.GATING_CHANNELS_CHANGE, packet);

        }
    }

    /**
     * @function addDownloadEvents - adds eventl listeners an functionality to the download buttons
     */
    addDownloadEvents() {

        // Els
        const gating_download_icon_db = document.querySelector('#gating_download_icon_db');
        const gating_download_icon = document.querySelector('#gating_download_icon');
        const gating_download_panel = document.querySelector('#gating_download_panel');
        const gating_exit = document.querySelector('#gating_exit');
        const download_gated_channel_ranges = document.querySelector('#download_gated_channel_ranges');
        const download_gated_cell_encodings = document.querySelector('#download_gated_cell_encodings');
        const download_input1 = document.querySelector('#download_input1');
        const download_input2 = document.querySelector('#download_input2');
        const gating_controls_outlines = document.querySelector('#gating_controls_outlines')
        const gating_controls_centroids= document.querySelector('#gating_controls_centroids')

        // Events ::

        gating_download_icon_db.addEventListener('click', () => {
            this.dataLayer.saveGatingList(this.gating_channels, this.selections, false);
            alert("Saved Gating to Database");
        })

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
            this.dataLayer.downloadGatingCSV(this.gating_channels, this.selections, false);
        })

        // Download gated channel ranges
        download_gated_cell_encodings.addEventListener('click', () => {
            this.dataLayer.downloadGatingCSV(this.gating_channels, this.selections, true);
        })

        // Toggle outlined / filled cell selections
        gating_controls_outlines.addEventListener('change', e => {
            this.seaDragonViewer.viewerManagerVMain.sel_outlines = e.target.checked;
            this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
        })

        // Toggle outlined / filled cell selections
        gating_controls_centroids.addEventListener('change', e => {

            // Update logic mode for selection query
            if (e.target.checked) {
                this.eval_mode = 'or';
            } else {
                this.eval_mode = 'and';
            }

            this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.selections);
        })

    }

    /**
     * @function addEventsLinked
     * ???
     */
    addEventsLinked() {

        // Add events to channel
        const channelListContent = document.querySelectorAll('.channel-list-content');
        const gatingListContent = document.querySelectorAll('.gating-list-content');

        // Attach
        const attach = (targets, matches, target_class, match_class, global) => {
            targets.forEach(cLC => {
                cLC.addEventListener('click', e => {

                    // If event target is not an svg el (from slider)
                    const svgEls = ['path']
                    if (!svgEls.includes(e.currentTarget.tagName)) {

                        // Get channel name
                        const name = _.get(e.currentTarget.querySelector(`.${target_class}`), 'innerText');

                        // Find match el in gating list
                        if (name) {
                            const match = Array.from(matches).find(
                                gLC => gLC.querySelector(`.${match_class}`).innerText === name);

                            // Emulate click to trigger event in csvGatingList.js
                            if (match && !Array.from(match.classList).includes('active')) {
                                const fakeEvent = {target: match};
                                const svgCol = match.querySelector('.col-svg-wrapper')
                                // global.abstract_click(fakeEvent, svgCol);
                            }
                        }
                    }
                });
            });
        }
        attach(gatingListContent, channelListContent, 'gating-name', 'channel-name',
            this.global_channel_list);

    }

    /**
    * @function addSlider - add a slider
    * @param data - the min and max range of the slider
    * @param activeRange - the predefined values for the lower and upper handle
    * @param name - the name of the slider (used as part of the id)
    * @param swidth - the pixel width of the slider
     */
    addSlider(name, swidth, data, activeRange) {

        if (!data) return;

        const fullName = this.dataLayer.getFullChannelName(name);
        const { xDomain, yDomain, histogramData} = this.histogramData(fullName); 
        let channelID = this.gatingIDs[name];

        let data_min
        let data_max
        let handle_min
        let handle_max
        if (this.dataLayer.isTransformed()) {
            data_min = d3.min(data)
            data_max = d3.max(data)
            handle_min = activeRange[0]
            handle_max = activeRange[1]
        } else {
            data_min = parseInt(d3.min(data))
            data_max = parseInt(d3.max(data))
            handle_min = parseInt(activeRange[0])
            handle_max = parseInt(activeRange[1])
        }

        let f = d3.format("d")
        //add range slider row content
        const sliderSimple = d3.sliderBottom()
            .min(data_min)
            .max(data_max)
            .width(swidth - 75)
            .tickFormat(f)
            .fill('orange')
            .ticks(1)
            .default([handle_min, handle_max])
            .handle(
                d3.symbol()
                    .type(d3.symbolCircle)
                    .size(100))
            .tickValues([])
            .on('end', (range) => {
                const transformed = this.dataLayer.isTransformed();
                const v0 = transformed ? range[0] : Math.round(range[0]);
                const v1 = transformed ? range[1] : Math.round(range[1]);
                this.moveSliderHandles(sliderSimple, [v0, v1], name, "GATING_BRUSH_END");
            }).on('onchange', (range) => {
                const transformed = this.dataLayer.isTransformed();
                const v0 = transformed ? range[0] : Math.round(range[0]);
                const v1 = transformed ? range[1] : Math.round(range[1]);
                d3.select('#gating_slider-input' + channelID + 0).attr('value', v0)
                d3.select('#gating_slider-input' + channelID + 0).property('value', v0);
                d3.select('#gating_slider-input' + channelID + 1).attr('value', v1);
                d3.select('#gating_slider-input' + channelID + 1).property('value', v1);
                this.moveSliderHandles(sliderSimple, [v0, v1], name, "GATING_BRUSH_MOVE");
            });

        this.sliders.set(name, sliderSimple);

        //create the slider svg and call the slider
        var gSimple = d3
            .select('#csv_gating-slider_' + channelID)
            .append('svg')
            .attr('class', 'svgslider')
            .attr('id', 'csv_gating-slider_svg_' + channelID)
            .attr('width', swidth)
            .attr('height', 80)
            .append('g')
            .attr('transform', 'translate(20,40)');

        let xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, swidth - 73])

        let yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([0, 25])

        let line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX)

        const lines = gSimple.selectAll('.distribution_line');
        const paths = lines.data([histogramData]).enter().append('path');
        paths
        .append('path')
        .attr('d', line)
        .attr('class', 'distribution_line')
        .attr('transform', 'translate(0,-31)')
        .attr('fill', 'none')

        gSimple.call(sliderSimple);

        //slider value to be displayed closer to the slider than default
        d3.selectAll('.parameter-value').select('text')
            .attr("y", 10);

        //both handles
        const { sliders } = this;
        const handles = d3.select('#csv_gating-slider_' + channelID).selectAll(".parameter-value");
        handles.each(function (d, i) {
            d3.select(this).append("foreignObject")
            .attr('id', 'c_foreignObject_' + channelID + i)
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
            .attr('id', 'gating_slider-input' + channelID + i)
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
                moveSliderHandles(sliderSimple, vals, name, "GATING_BRUSH_END");
            }
        })

        return sliderSimple;
    };

    histogramData(fullName) {
        const histogramData = this.databaseDescription[fullName].histogram;
        const xMin = Math.min(...histogramData.map(e => e.x));
        const xMax = Math.max(...histogramData.map(e => e.x));
        const yMax = Math.max(...histogramData.map(e => e.y));
        return {
            histogramData,
            xDomain: [xMin, xMax],
            yDomain: [yMax, 0],
        };
    }

    async getGatingGMM(name) {
        let packet = this.hasGatingGMM[name];
        if (!(name in this.hasGatingGMM)) {
            const fullName = this.dataLayer.getFullChannelName(name);
            packet = await this.dataLayer.getGatingGMM(fullName);
            this.hasGatingGMM[name] = packet;
        }
        const channelID = this.gatingIDs[name];
        const autoBtn = document.getElementById(`auto-btn-gating_${channelID}`);
        autoBtn.classList.remove("auto-loading")
        return packet;
    }

    async getAndDrawGatingGMM(name) {
        const fullName = this.dataLayer.getFullChannelName(name);
        await this.getGatingGMM(name);
        this.drawGatingGMM(name);
    }

    drawGatingGMM(name) {
        let channelID = this.gatingIDs[name];
        const fullName = this.dataLayer.getFullChannelName(name);
        const { xDomain, yDomain } = this.histogramData(fullName); 
        const packet = this.hasGatingGMM[name];
        let gmm1Data = packet['gmm_1'];
        let gmm2Data = packet['gmm_2'];

        const gatingListEl = document.getElementById("csv_gating_list");
        const swidth = gatingListEl.getBoundingClientRect().width;

        let xScale = d3.scaleLinear()
            .domain(xDomain)
            .range([0, swidth - 73])

        let yScale = d3.scaleLinear()
            .domain(yDomain)
            .range([0, 25])

        let line = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .curve(d3.curveMonotoneX)

        let gSimple = d3.select('#csv_gating-slider_svg_' + channelID + ' g')

        gSimple.selectAll('.gmm1_line')
            .data([gmm1Data])
            .enter()
            .append('path')
            .attr('d', line)
            .attr('class', 'gmm_line')
            .attr('class', 'gmm_line_'+name)
            .attr('transform', 'translate(0,-31)')
            .attr('fill', 'none')
            .attr('stroke', 'blue')

        gSimple.selectAll('.gmm2_line')
            .data([gmm2Data])
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
     * @function resetGatingList - resets all channels in the list to its initial range
     */
    resetGatingList() {
        let gatingList = Object.keys(this.selections);
        _.each(gatingList, col => {
            let shortName = this.dataLayer.getShortChannelName(col);
            let channelID = this.gatingIDs[shortName];
            let gating_selector = `#csv_gating-slider_${channelID}`;
            document.querySelector(gating_selector).click();
        });
    };

    /**
     * @function moveSliderHandles - move the slider handles and input fields so that input fields don't overlap when handles are close
     *
     * @param slider - the slider affected
     * @param vals - holds the new positions
     * @param name - the name of the slider
     * @param eventName - the name of the event
     */
    moveSliderHandles(slider, vals, name, eventName) {
        const fullName = this.dataLayer.getFullChannelName(name);
        const channelID = this.gatingIDs[name];
        this.gating_channels[fullName] = vals;
        this.selections[fullName] = vals;
        slider.silentValue(vals);
        const diff = Math.abs(vals[1] - vals[0]);
        const total = Math.abs(slider.max() - slider.min());
        const percentage = diff / total;
        if (percentage < 0.15){
            console.log('slider handles overlap..do something');
            d3.select('#c_foreignObject_'  + channelID + 1).attr('x', 5);
        }else{
            d3.select('#c_foreignObject_'  + channelID + 1).attr('x', -25);
        }
        const packet = this.selections;
        this.eventHandler.trigger(CSVGatingList.events[eventName], packet);
    }

    /**
     * @function dist - caclulates the distance between two rects
     * @param el1
     * @param el2
     * @param buffer
     * @returns {number}
     */
    dist(el1, el2, buffer) {
        var rect1 = el1.getBoundingClientRect();
        var rect2 = el2.getBoundingClientRect();
        return rect2.left - rect1.right;
    }
}

//resize sliders, etc on window change
window.addEventListener("resize", () => {
    const { csv_gatingList } = __minervaAnalysis;
    if (typeof csv_gatingList != "undefined" && csv_gatingList) {
        csv_gatingList.sliders.forEach((slider, name) => {
            d3.select('div#csv_gating-slider_' + name).select('svg').remove();
            let fullName = csv_gatingList.dataLayer.getFullChannelName(name);
            let sliderRange = [csv_gatingList.databaseDescription[fullName].min, csv_gatingList.databaseDescription[fullName].max];
            const gatingListEl = document.getElementById("csv_gating_list");
            if (gatingListEl) {
                const swidth = gatingListEl.getBoundingClientRect().width;
                csv_gatingList.addSlider(name, swidth, sliderRange, slider.value());
                if (csv_gatingList.hasGatingGMM[name]) {
                    csv_gatingList.drawGatingGMM(name);
                }
            }
        });
    }
});

//hide gating control panel when scrolled down to access all channels..
// $(document).ready(function()
// {
//    $('#csv_gating_list').scroll(function()
//    {
//       var div = $(this);
//       if (div[0].scrollHeight - div.scrollTop() < div.height()+10)
//       {
//             $('#gating_controls_panel').hide();
//       }else{
//             $('#gating_controls_panel').show();
//       }
//    });
// });

//static vars: events introduced in this class and used across the app
CSVGatingList.events = {
    GATING_BRUSH_MOVE: "GATING_BRUSH_MOVE",
    GATING_BRUSH_END: "GATING_BRUSH_END",
    GATING_COLOR_TRANSFER_CHANGE_MOVE: "GATING_TRANSFER_CHANGE_MOVE",
    GATING_COLOR_TRANSFER_CHANGE: "GATING_TRANSFER_CHANGE",
    GATING_CHANNELS_CHANGE: "GATING_CHANNELS_CHANGE",
    RESET_GATINGLIST: "RESET_GATINGLIST"
};
