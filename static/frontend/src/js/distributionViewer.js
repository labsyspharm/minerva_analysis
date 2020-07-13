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

        this.ridgeplot = ridgeplot()
            .on('brushmove', (dataRange, pixelRange, data, programBrush, allDataRanges) => {
                // dataRange: selection range in data space
                // pixelRange: selection range in pixel space
                // data.name: cell name
                // programBrush: programmatically setting the zoom on initialization
                // console.log('programBrush', programBrush);
                let packet = {dataRange, pixelRange, data, programBrush, allDataRanges};
                this.updateColorMarkers(pixelRange, data);
                if (!programBrush) {
                    this.eventHandler.trigger(DistributionViewer.events.BRUSH_MOVE, packet);
                }
            })
            .on('brushend', (dataRange, pixelRange, data, programBrush, allDataRanges) => {
                let packet = {dataRange, pixelRange, data, programBrush, allDataRanges};
                // console.log('allDataRanges', allDataRanges);
                this.updateColorMarkers(pixelRange, data);
                this.ranges[data.name] = {pixelRange, dataRange};//save ranges
                if (!programBrush) {
                    this.eventHandler.trigger(DistributionViewer.events.BRUSH_END, packet);
                }
            })
            .on('selectrow', (name, status) => {
                if (status && this.selections.length == this.maxSelections) {
                    d3.event.target.checked = false;
                    d3.event.target.__selected = false;
                    d3.select(d3.event.target)
                        .attr('font-weight', 'normal')
                        .attr('fill', '#9e9e9e');
                    return;
                }
                ;
                if (status) {
                    this.selectChannel(status, name);
                    // this.selections.push(name);
                    // this.container.selectAll('.color-transfer')
                    // 	.filter(d=>d.parent.name==name)
                    // 	.attr('display', null)
                    // 	.attr('transform', (d,i)=>{
                    // 		return `translate(${this.ranges[name].pixelRange[i]},${0})`});
                } else {
                    this.selections = this.selections.filter(d => d != name);
                    this.container.selectAll('.color-transfer')
                        .filter(d => d.parent.name == name).attr('display', 'none');
                }
                // selections: list of feature names
                // name: current target feature
                // status: current target feature's check status
                let packet = {selections: this.selections, name, status};
                console.log('channels_change', packet);
                this.eventHandler.trigger(DistributionViewer.events.CHANNELS_CHANGE, packet);
            })
        window.addEventListener("resize", _.throttle(this.draw.bind(this), 500), false);

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

        this.container = d3.select("#ridge_plot");

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
        // this.draw();
    }

    highlights(cells) {
        var that = this;
        console.log('highlight cell selection');

        //cells = cells.slice(0);

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

        //console.timeEnd();  Timmer 'default' does not exist error
        //filter  first 100 for highlighting  (should be done differently by shuffling, etc.)
        // var count=0;
        // cells = cells.filter(function(d,i){
        //     count++
        //      return (count<100 || count % 100 == 0);
        //  });

        this.ridgeplot.highlights(cells);
        console.log('end highlight cell selection');
        //error: randomSample is not a function (other lib version?)
        //this.ridgeplot.highlights(_.sampleSize(cells, 100));
        this.draw();
    }

    updateColorMarkers(pixelRange, d) {
        //show color transfer markers
        if (pixelRange) {
            // console.log('draw color marker');
            this.container.selectAll('.color-transfer')
                .filter(c => c.parent.name == d.name)
                .attr('transform', function (d, i) {
                    return `translate(${pixelRange[i]},${0})`
                });
        }
    }


    wrangle(data) {
        var that = this;
        console.log('ridgePlot: wrangle');

        //get copy to not destroy the original data..
        //data = data.slice(0);
        console.log('ridgePlot: filter unnecessary fields');
        let columns = Object.keys(data[0]).filter(key =>
            that.dataFilter.isImageFeature(key));
        // let columns = this.dataFilter.imageChannels;
        console.log('ridgePlot: another mapping');
        // let extent = d3.extent(columns.reduce((acc, key)=>{
        // 	let values = data.map(function(d){  return +d[key]; });
        // 	return acc.concat(values);
        // 	// console.log(key, d3.extent(values));
        // },[]));
        let extent = [0, this.dataFilter.getTotalMax()];
        console.log('ridgePlot: kde');
        let x = d3.scaleLinear().domain(extent).nice(50);
        //kernel is always 1/20 of dataset, 30 ticks gives enough resolution for smooth curve..
        let kde = kernelDensityEstimator(kernelEpanechnikov(((this.dataFilter.getTotalMax()) - this.dataFilter.getTotalMin()) / 20), x.ticks(30));
        let allDensity = columns.map(key => {
            let values = data.map(function (d) {
                return +d[key];
            });
            //get a 100% sample, but if there aren't many (or even no) values remaining then get at least 100 or less when the size is even smaller
            let density = kde(_.sampleSize(values, Math.max(Math.min(1500, values.length), parseInt(values.length / 100))));
            return {key, density};
        })


        let visdata = {
            series: allDensity.map(({key, density}) => ({
                name: this.dataFilter.getShortChannelName(key),
                values: density.map(d => d[1])
            })),
            bins: allDensity[0].density.map(d => d[0])
        };

        this.visdata = visdata;

    }

    draw() {
        console.log('ridgePlot: draw');
        let rect = document.getElementById('ridge_plot_wrapper').getBoundingClientRect();
        //  console.log('rect', rect);
        this.container.datum(this.visdata)
            .call(this.ridgeplot
                .width(rect.width ? rect.width : 150)
                .height(rect.height ? rect.height : 200)
                .responsive(true)
                .margin({
                    top: 20,
                    left: 65,
                    right: 20,
                    bottom: 40
                },));

        // HACK: inject color markers
        let showPicker = () => {
            this.colorTransferHandle = d3.select(d3.event.target);
            let color = this.colorTransferHandle.style('fill');
            let hsl = d3.hsl(color);
            this.rainbow.set(hsl)
            this.rainbow.show(d3.event.clientX, d3.event.clientY);
        }
        this.container.select('svg')
            .selectAll(".group-overlay")
            .data(this.visdata.series)
            .join("g")
            .attr('class', 'group-overlay')
            .attr("transform", d => `translate(0,${this.ridgeplot.y()(d.name) + 1})`)
            .selectAll(".color-transfer")
            .data(d => [{parent: d, type: "left"}, {parent: d, type: "right"}])
            .join(
                enter => enter.append('rect')
                    .attr("class", "color-transfer")
                    .attr('display', 'none')
                    .attr("cursor", "pointer")
                    .attr('stroke', '#757575')
                    .attr('fill', d => d.type == 'left' ? 'black' : 'white')
                    .attr('width', 10)
                    .attr('height', 10)
                    .attr('rx', 2)
                    .attr('ry', 2)
                    .attr('x', -5)//d=>d.type=='w'?-15:5)
                    .attr('y', this.ridgeplot.y().step() / 4)
                    .on('pointerup', showPicker),
                update => update.attr('y', this.ridgeplot.y().step() / 4)
            )
        console.log('ridgePlot: draw end');
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
