class CSVGatingList {

    constructor(config, dataLayer, eventHandler) {
        this.config = config;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
        this.selections = {};
        this.maxSelections = 1000;
        this.ranges = {};
        this.sliders = new Map();
        var that = this;
        // this.imageBitRange = [0, 65536];

        this.container = d3.select("#csv_gating_list");
    }

    selectChannel(name) {
        this.selections[this.dataLayer.getFullChannelName(name)] = this.sliders.get(name).value();
    }

    async init() {
        // this.rainbow.hide();
        this.columns = await this.dataLayer.getChannelNames(true);
        this.databaseDescription = await this.dataLayer.getDatabaseDescription();
        // Hide the Loader
        document.getElementById('csv_gating_list_loader').style.display = "none";
        let gating_list = document.getElementById("csv_gating_list");
        let list = document.createElement("ul");
        list.classList.add("list-group")
        gating_list.appendChild(list)
        // Will show the picker when you click on a color rect
        let showPicker = () => {
            this.colorTransferHandle = d3.select(d3.event.target);
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
    }

    /**
     * @function abstract_click
     *
     * @param e
     * @param svgCol
     */
    abstract_click(event, svgCol) {

        // IF you clicked on the svg, ignore this behavior
        if (event.target.closest("svg")) {
            return;
        }
        let parent = event.target.closest(".list-group-item");
        let name = parent.querySelector('.gating-name').textContent;
        let status = !parent.classList.contains("active");
        if (status) {
            //Don't add gating is the max are selected
            if (_.size(this.selections) >= this.maxSelections) {
                return;
            }
            parent.classList.add("active");
            svgCol.style.display = "block";
            this.selectChannel(name);

            //add range slider row content
            d3.select('div#csv_gating-slider_' + name).style('display', "block")

            //gating not active
        } else {
            delete this.selections[this.dataLayer.getFullChannelName(name)];
            parent.classList.remove("active")
            svgCol.style.display = "none";

            //hide range slider row content
            d3.select('div#csv_gating-slider_' + name).style('display', "none");
        }

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
            this.eventHandler.trigger(CSVGatingList.events.GATING_CHANNELS_CHANGE, packet);

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
                self.selections[self.dataLayer.getFullChannelName(name)] = range;
                let packet = self.selections;
                this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END, packet);
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