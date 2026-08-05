/**
 * @class ViewerSidebar - unified controls for marker gating and image channels.
 */
class ViewerSidebar {
    constructor(config, columns, dataLayer, eventHandler, channelList, gatingList) {
        this.config = config;
        this.columns = [...columns];
        this.dataLayer = dataLayer;
        this.eventHandler = eventHandler;
        this.channelList = channelList;
        this.gatingList = gatingList;
        this.databaseDescription = {};
        this.gateMarker = null;
        this.gateSlider = null;
        this.channelSlots = [];
        this.channelSlotSliders = new Map();
        this.defaultColors = [
            { label: "Blue", hex: "#2388ff", rgb: { r: 35, g: 136, b: 255 } },
            { label: "Red", hex: "#ff2d2d", rgb: { r: 255, g: 45, b: 45 } },
            { label: "Green", hex: "#2bd46f", rgb: { r: 43, g: 212, b: 111 } },
            { label: "White", hex: "#ffffff", rgb: { r: 255, g: 255, b: 255 } },
        ];
    }

    init(databaseDescription) {
        this.databaseDescription = databaseDescription;
        this.setupSidebarShell();
        this.populateGateSelect();
        this.initChannelSlots();
        this.bindActions();
        this.setGateMarker(this.columns[1] || this.columns[0], { enableSlot: false });
        this.applyInitialChannels();
    }

    setupSidebarShell() {
        const collapseButton = document.getElementById("sidebar_collapse_button");
        const expandButton = document.getElementById("sidebar_expand_button");
        const shell = document.getElementById("bodyDiv");
        const toggleSidebar = () => {
            if (shell) {
                shell.classList.toggle("sidebar-collapsed");
            }
        };
        if (collapseButton) {
            collapseButton.addEventListener("click", toggleSidebar);
        }
        if (expandButton) {
            expandButton.addEventListener("click", toggleSidebar);
        }
    }

    bindActions() {
        const gateSelect = document.getElementById("gate_marker_select");
        gateSelect.addEventListener("change", (event) => {
            this.setGateMarker(event.target.value);
        });

        const gateAuto = document.getElementById("gate_auto_button");
        gateAuto.addEventListener("click", async () => {
            await this.autoGate();
        });

        const addButton = document.getElementById("add_channel_button");
        addButton.addEventListener("click", () => this.addFirstAvailableChannel());

        const downloadViewButton = document.getElementById("download_view_button");
        if (downloadViewButton) {
            downloadViewButton.addEventListener("click", () => {
                if (this.gatingList?.seaDragonViewer) {
                    this.gatingList.seaDragonViewer.downloadCurrentView();
                }
            });
        }

        window.addEventListener("resize", () => {
            this.redrawGateSlider();
            this.redrawChannelSliders();
        });
    }

    populateGateSelect() {
        const select = document.getElementById("gate_marker_select");
        select.innerHTML = "";
        const names = [...this.columns];
        if (!names.includes("Area") && this.databaseDescription.Area) {
            names.push("Area");
        }
        names.forEach((name) => {
            if (!this.databaseDescription[this.dataLayer.getFullChannelName(name)]) {
                return;
            }
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    initChannelSlots() {
        const slotList = document.getElementById("channel_slot_list");
        slotList.innerHTML = "";
        this.channelSlots = [0, 1, 2, 3].map((slotIndex) => {
            const color = this.defaultColors[slotIndex];
            const name = this.columns[slotIndex] || "";
            const slot = {
                index: slotIndex,
                name,
                color: color.rgb,
                colorHex: color.hex,
                enabled: slotIndex === 0 && Boolean(name),
                range: this.getImageRange(name),
                userColorChanged: false,
            };
            slotList.appendChild(this.createChannelSlot(slot));
            return slot;
        });
        this.updateSelectedCount();
        this.redrawChannelSliders();
    }

    createChannelSlot(slot) {
        const row = document.createElement("div");
        row.classList.add("channel-slot");
        row.setAttribute("data-slot", slot.index);

        const top = document.createElement("div");
        top.classList.add("channel-slot-top");
        row.appendChild(top);

        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = slot.enabled;
        toggle.title = "Toggle channel";
        toggle.addEventListener("change", (event) => {
            this.setSlotEnabled(slot.index, event.target.checked);
        });
        top.appendChild(toggle);

        const color = document.createElement("input");
        color.type = "color";
        color.value = slot.colorHex;
        color.title = "Channel color";
        color.classList.add("channel-color-input");
        color.addEventListener("input", (event) => {
            this.setSlotColor(slot.index, event.target.value, true);
        });
        top.appendChild(color);

        const select = document.createElement("select");
        select.classList.add("sidebar-select");
        this.columns.forEach((name) => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
        select.value = slot.name;
        select.addEventListener("change", (event) => {
            this.setSlotMarker(slot.index, event.target.value, { keepColor: true, enable: true });
        });
        top.appendChild(select);

        const auto = document.createElement("button");
        auto.type = "button";
        auto.classList.add("slot-auto-button");
        auto.textContent = "Auto";
        auto.addEventListener("click", () => this.autoChannel(slot.index));
        top.appendChild(auto);

        const values = document.createElement("div");
        values.classList.add("range-readout", "slot-range-readout");
        values.innerHTML = `<span id="channel_slot_min_${slot.index}">0.00</span><span id="channel_slot_max_${slot.index}">0.00</span>`;
        row.appendChild(values);

        const slider = document.createElement("div");
        slider.classList.add("sidebar-slider");
        slider.setAttribute("id", `channel_slot_slider_${slot.index}`);
        row.appendChild(slider);

        return row;
    }

    applyInitialChannels() {
        this.channelSlots.forEach((slot) => {
            if (slot.name && slot.enabled) {
                this.activateChannel(slot);
            }
        });
        this.updateSelectedCount();
    }

    setGateMarker(name, options = {}) {
        if (!name) return;
        const enableSlot = options.enableSlot !== false;
        this.gateMarker = name;
        const select = document.getElementById("gate_marker_select");
        select.value = name;
        this.ensureGateSelection(name);
        this.redrawGateSlider();
        this.drawGateDistribution();
        this.setSlotMarker(1, name, { keepColor: true, enable: enableSlot });
    }

    ensureGateSelection(name) {
        const fullName = this.dataLayer.getFullChannelName(name);
        const range = this.gatingList.gating_channels[fullName] || this.getGateRange(name);
        this.gatingList.selections = {};
        this.gatingList.gating_channels[fullName] = range;
        this.gatingList.selections[fullName] = range;
        this.updateGateReadout(range);
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_MOVE, this.gatingList.selections);
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, this.gatingList.selections);
        if (!(name in this.gatingList.hasGatingGMM)) {
            this.gatingList.getGatingGMM(name).then(() => this.drawGateDistribution());
        }
    }

    redrawGateSlider() {
        if (!this.gateMarker) return;
        const target = document.getElementById("gate_slider");
        target.innerHTML = "";
        const range = this.getGateRange(this.gateMarker);
        const values = this.gatingList.gating_channels[this.dataLayer.getFullChannelName(this.gateMarker)] || range;
        const width = Math.max(180, target.getBoundingClientRect().width - 16);
        const slider = d3.sliderBottom()
            .min(range[0])
            .max(range[1])
            .width(width)
            .ticks(0)
            .tickValues([])
            .default(values)
            .fill("#f36f45")
            .handle(d3.symbol().type(d3.symbolCircle).size(120))
            .on("onchange", (value) => this.setGateRange(value, CSVGatingList.events.GATING_BRUSH_MOVE))
            .on("end", (value) => this.setGateRange(value, CSVGatingList.events.GATING_BRUSH_END));

        this.gateSlider = slider;
        d3.select(target)
            .append("svg")
            .attr("width", width + 16)
            .attr("height", 44)
            .append("g")
            .attr("transform", "translate(8,18)")
            .call(slider);
        this.updateGateReadout(values);
    }

    setGateRange(values, eventName) {
        const fullName = this.dataLayer.getFullChannelName(this.gateMarker);
        const normalized = this.normalizeRange(values, this.dataLayer.isTransformed());
        this.gatingList.gating_channels[fullName] = normalized;
        this.gatingList.selections = {};
        this.gatingList.selections[fullName] = normalized;
        this.updateGateReadout(normalized);
        this.drawGateDistribution();
        this.eventHandler.trigger(eventName, this.gatingList.selections);
    }

    async autoGate() {
        if (!this.gateMarker) return;
        if (!(this.gateMarker in this.gatingList.hasGatingGMM)) {
            await this.gatingList.getGatingGMM(this.gateMarker);
        }
        const packet = this.gatingList.hasGatingGMM[this.gateMarker];
        if (!packet || packet.gate === undefined) return;
        const range = this.getGateRange(this.gateMarker);
        const transformed = this.dataLayer.isTransformed();
        const gate = transformed ? parseFloat(packet.gate) : Math.floor(parseFloat(packet.gate));
        const values = [gate, range[1]];
        if (this.gateSlider) {
            this.gateSlider.silentValue(values);
        }
        this.setGateRange(values, CSVGatingList.events.GATING_BRUSH_END);
        this.redrawGateSlider();
    }

    drawGateDistribution() {
        const target = document.getElementById("gate_distribution_plot");
        target.innerHTML = "";
        if (!this.gateMarker) return;
        const fullName = this.dataLayer.getFullChannelName(this.gateMarker);
        const desc = this.databaseDescription[fullName];
        const histogram = desc?.histogram || [];
        if (!histogram.length) return;

        const box = target.getBoundingClientRect();
        const width = Math.max(220, box.width || 280);
        const height = 120;
        const margin = { top: 12, right: 10, bottom: 24, left: 28 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const xDomain = d3.extent(histogram, (d) => d.x);
        const yMax = d3.max(histogram, (d) => d.y);
        const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);
        const line = d3.line()
            .x((d) => xScale(d.x))
            .y((d) => yScale(d.y))
            .curve(d3.curveMonotoneX);
        const values = this.gatingList.gating_channels[fullName] || this.getGateRange(this.gateMarker);

        const svg = d3.select(target)
            .append("svg")
            .attr("width", width)
            .attr("height", height);
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        g.append("path")
            .datum(histogram)
            .attr("class", "sidebar-distribution-line")
            .attr("d", line);
        values.forEach((value) => {
            g.append("line")
                .attr("class", "gate-threshold-line")
                .attr("x1", xScale(value))
                .attr("x2", xScale(value))
                .attr("y1", 0)
                .attr("y2", innerHeight);
        });
        g.append("g")
            .attr("class", "distribution-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(3).tickFormat(d3.format(".2f")));
    }

    setSlotMarker(slotIndex, name, options = {}) {
        const slot = this.channelSlots[slotIndex];
        if (!slot || !name) return;
        if (slot.name && slot.enabled && slot.name !== name) {
            this.deactivateChannel(slot);
        }
        this.disableDuplicateChannels(name, slotIndex);
        slot.name = name;
        slot.range = this.getImageRange(name);
        if (!options.keepColor) {
            this.setSlotColor(slotIndex, this.defaultColors[slotIndex].hex, false);
        }
        if (options.enable) {
            slot.enabled = true;
        }
        this.syncSlotDom(slot);
        this.redrawChannelSlider(slot);
        if (slot.enabled) {
            this.activateChannel(slot);
        }
        this.updateSelectedCount();
    }

    setSlotEnabled(slotIndex, enabled) {
        const slot = this.channelSlots[slotIndex];
        if (!slot || !slot.name) return;
        slot.enabled = enabled;
        if (enabled) {
            this.disableDuplicateChannels(slot.name, slotIndex);
            this.activateChannel(slot);
        } else {
            this.deactivateChannel(slot);
        }
        this.syncSlotDom(slot);
        this.updateSelectedCount();
    }

    setSlotColor(slotIndex, hex, userColorChanged) {
        const slot = this.channelSlots[slotIndex];
        if (!slot) return;
        slot.colorHex = hex;
        slot.color = this.hexToRgb(hex);
        slot.userColorChanged = Boolean(userColorChanged || slot.userColorChanged);
        this.syncSlotDom(slot);
        if (slot.enabled && slot.name) {
            this.eventHandler.trigger(ChannelList.events.COLOR_TRANSFER_CHANGE, {
                name: slot.name,
                type: "white",
                color: d3.rgb(slot.color.r, slot.color.g, slot.color.b),
            });
        }
    }

    activateChannel(slot) {
        const fullName = this.dataLayer.getFullChannelName(slot.name);
        const channelIdx = imageChannels[fullName];
        if (channelIdx === undefined) return;
        this.channelList.image_channels[slot.name] = slot.range;
        this.channelList.rangeConnector[channelIdx] = this.toImageConnectorRange(slot.range);
        this.channelList.colorConnector[channelIdx] = { color: slot.color };
        if (!this.channelList.selections.includes(slot.name)) {
            this.channelList.selections.push(slot.name);
        }
        this.channelList.sel[fullName] = slot.range;
        this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, {
            selections: this.channelList.selections,
            name: slot.name,
            status: true,
        });
        this.eventHandler.trigger(ChannelList.events.COLOR_TRANSFER_CHANGE, {
            name: slot.name,
            type: "white",
            color: d3.rgb(slot.color.r, slot.color.g, slot.color.b),
        });
        this.eventHandler.trigger(ChannelList.events.BRUSH_MOVE, {
            name: slot.name,
            dataRange: [...slot.range],
        });
    }

    deactivateChannel(slot) {
        const fullName = this.dataLayer.getFullChannelName(slot.name);
        this.channelList.selections = _.pull(this.channelList.selections, slot.name);
        delete this.channelList.sel[fullName];
        this.eventHandler.trigger(ChannelList.events.CHANNELS_CHANGE, {
            selections: this.channelList.selections,
            name: slot.name,
            status: false,
        });
    }

    disableDuplicateChannels(name, currentSlotIndex) {
        this.channelSlots.forEach((slot) => {
            if (slot.index !== currentSlotIndex && slot.enabled && slot.name === name) {
                slot.enabled = false;
                this.deactivateChannel(slot);
                this.syncSlotDom(slot);
            }
        });
    }

    redrawChannelSliders() {
        this.channelSlots.forEach((slot) => this.redrawChannelSlider(slot));
    }

    redrawChannelSlider(slot) {
        if (!slot || !slot.name) return;
        const target = document.getElementById(`channel_slot_slider_${slot.index}`);
        target.innerHTML = "";
        const range = this.getImageRange(slot.name);
        const width = Math.max(180, target.getBoundingClientRect().width - 16);
        const slider = d3.sliderBottom(d3.scaleLog())
            .min(Math.max(range[0], 1))
            .max(Math.max(range[1], 2))
            .width(width)
            .ticks(0)
            .tickValues([])
            .default([Math.max(slot.range[0], 1), Math.max(slot.range[1], 2)])
            .fill("#f36f45")
            .handle(d3.symbol().type(d3.symbolCircle).size(120))
            .on("onchange", (value) => this.setSlotRange(slot.index, value));

        this.channelSlotSliders.set(slot.index, slider);
        d3.select(target)
            .append("svg")
            .attr("width", width + 16)
            .attr("height", 44)
            .append("g")
            .attr("transform", "translate(8,18)")
            .call(slider);
        this.updateSlotReadout(slot);
    }

    setSlotRange(slotIndex, values) {
        const slot = this.channelSlots[slotIndex];
        if (!slot) return;
        slot.range = this.normalizeRange(values, true);
        this.channelList.image_channels[slot.name] = slot.range;
        this.updateSlotReadout(slot);
        if (slot.enabled && slot.name) {
            this.eventHandler.trigger(ChannelList.events.BRUSH_MOVE, {
                name: slot.name,
                dataRange: [...slot.range],
            });
        }
    }

    async autoChannel(slotIndex) {
        const slot = this.channelSlots[slotIndex];
        if (!slot || !slot.name) return;
        if (!(slot.name in this.channelList.hasChannelGMM)) {
            await this.channelList.getAndDrawChannelGMM(slot.name);
        }
        const packet = this.channelList.hasChannelGMM[slot.name];
        if (!packet) return;
        slot.range = [packet.vmin, packet.vmax];
        const slider = this.channelSlotSliders.get(slotIndex);
        if (slider) {
            slider.silentValue(slot.range);
        }
        this.setSlotRange(slotIndex, slot.range);
        this.redrawChannelSlider(slot);
    }

    addFirstAvailableChannel() {
        const emptySlot = this.channelSlots.find((slot) => !slot.enabled);
        if (!emptySlot) return;
        const activeNames = this.channelSlots.filter((slot) => slot.enabled).map((slot) => slot.name);
        const next = emptySlot.name && !activeNames.includes(emptySlot.name)
            ? emptySlot.name
            : this.columns.find((name) => !activeNames.includes(name));
        if (next) {
            this.setSlotMarker(emptySlot.index, next, { keepColor: true, enable: true });
        }
    }

    syncSlotDom(slot) {
        const row = document.querySelector(`.channel-slot[data-slot="${slot.index}"]`);
        if (!row) return;
        row.classList.toggle("is-disabled", !slot.enabled);
        const checkbox = row.querySelector('input[type="checkbox"]');
        const color = row.querySelector('input[type="color"]');
        const select = row.querySelector("select");
        checkbox.checked = slot.enabled;
        color.value = slot.colorHex;
        select.value = slot.name;
        this.updateSlotReadout(slot);
    }

    updateSelectedCount() {
        const count = this.channelSlots.filter((slot) => slot.enabled && slot.name).length;
        const countElement = document.getElementById("num-selected-channels");
        if (countElement) countElement.textContent = count;
        const addButton = document.getElementById("add_channel_button");
        if (addButton) addButton.disabled = count >= this.config.maxSelections;
    }

    updateGateReadout(values) {
        document.getElementById("gate_min_value").textContent = this.formatValue(values[0]);
        document.getElementById("gate_max_value").textContent = this.formatValue(values[1]);
    }

    updateSlotReadout(slot) {
        const min = document.getElementById(`channel_slot_min_${slot.index}`);
        const max = document.getElementById(`channel_slot_max_${slot.index}`);
        if (min) min.textContent = this.formatValue(slot.range[0]);
        if (max) max.textContent = this.formatValue(slot.range[1]);
    }

    getGateRange(name) {
        const fullName = this.dataLayer.getFullChannelName(name);
        const desc = this.databaseDescription[fullName] || {};
        return [desc.min || 0, desc.max || 1];
    }

    getImageRange(name) {
        if (!name) return [0, 1];
        const fullName = this.dataLayer.getFullChannelName(name);
        const desc = this.databaseDescription[fullName] || {};
        return [desc.image_min || this.dataLayer.imageBitRange[0] || 0, desc.image_max || this.dataLayer.imageBitRange[1] || 65536];
    }

    toImageConnectorRange(values) {
        const defaultRange = this.dataLayer.imageBitRange;
        return [values[0] / defaultRange[1], values[1] / defaultRange[1]];
    }

    normalizeRange(values, keepFloat) {
        const sorted = [...values].map((value) => parseFloat(value)).sort((a, b) => a - b);
        if (keepFloat) {
            return sorted;
        }
        return [Math.floor(sorted[0]), Math.ceil(sorted[1])];
    }

    formatValue(value) {
        return Number.parseFloat(value || 0).toFixed(2);
    }

    hexToRgb(hex) {
        const cleaned = hex.replace("#", "");
        const value = parseInt(cleaned, 16);
        return {
            r: (value >> 16) & 255,
            g: (value >> 8) & 255,
            b: value & 255,
        };
    }
}
