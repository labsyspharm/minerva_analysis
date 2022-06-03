// Via https://www.d3-graph-gallery.com/graph/heatmap_style.html
class Heatmap {
    constructor(id, dataLayer) {
        this.id = id;
        this.dataLayer = dataLayer;
        this.eventHandler = eventHandler;
        this.showOverall = true;
        this.showSelection = true;
        this.fontSize = "0.6rem"
    }

    init() {
        const self = this;
        return self.dataLayer.getHeatmapData()
            .then(data => {
                self.visData = []
                _.each(data, (els, i) => {
                    _.each(els, (el, j) => {
                        self.visData.push({
                            col: self.dataLayer.phenotypes[i],
                            row: self.dataLayer.phenotypes[j],
                            val: el
                        });
                    })
                })
                return self.draw();
            })

    }

    draw() {
        const self = this;
        // set the dimensions and margins of the graph
        const margin = {top: 0, right: 100, bottom: 130, left: 130},
            width = document.getElementById(self.id).clientWidth - margin.left - margin.right,
            height = document.getElementById(self.id).clientHeight - margin.top - margin.bottom;

        // create a tooltip
        self.tooltip = d3.select(`#${self.id}`)
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip")
            .style("background-color", "white")
            .style("border", "solid")
            .style("z-index", 1)
            .style("border-width", "1px")
            .style("border-radius", "5px")
            .style("padding", "5px")

        // append the svg object to the body of the page
        const svg = d3.select(`#${self.id}`)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("id", "heatmap-svg")
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        self.svg = svg;

        // Build X scales and axis:
        let x = d3.scaleBand()
            .range([0, width])
            .domain(self.dataLayer.phenotypes.slice(0, self.dataLayer.phenotypes.length-1))
            .padding(0.05);
        self.x = x;
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x).tickSize(0))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("font-size", self.fontSize)
            .attr("fill", "white")
            .attr("transform", "rotate(-90)");


        // Build Y scales and axis:
        let y = d3.scaleBand()
            .range([0, height])
            .domain(self.dataLayer.phenotypes.slice(1,self.dataLayer.phenotypes.length))
            .padding(0.05);
        self.y = y;

        svg.append("g")
            .style("font-size", self.fontSize)
            .call(d3.axisLeft(y).tickSize(0))
            .selectAll("text")
            .attr("font-size", self.fontSize)
            .attr("fill", "white");

        //Remove Axis Lines


        // Build color scale
        let myColor = d3.scaleSequential()
            .interpolator(d3.interpolateRdBu)
            .domain([1, -1])
        self.myColor = myColor;


        // Add title to graph
        svg.append("text")
            .attr("x", 0)
            .attr("y", -50)
            .attr("text-anchor", "left")
            .style("font-size", "22px")
            .text("Cell-Cell Colocalization");

        // Add subtitle to graph
        svg.append("text")
            .attr("x", 0)
            .attr("y", -30)
            .attr("text-anchor", "left")
            .style("font-size", "14px")
            .style("fill", "grey")
            .style("max-width", 400)
            .text("Pearson correlation coefficient of each pair of cell-types");


        // let color_scale = d3.axisTop(myColor);
        self.color_scale = d3.scaleLinear()
            .domain([-1, 1]) // unit: km
            .range([30, -30])
        let color_axis = d3.axisRight(self.color_scale)
            .tickValues([-1, 0, 1])
        svg.append("g")
            .attr("transform", `translate(${2 * width / 3 + 15},${0.32 * height})`)
            .attr('class', 'heatmap_legend')
            .attr('id', 'heatmap_color_legend')
            .call(color_axis)
            .selectAll('text')
            .style("stroke", "white");

        let colorLegend = svg.append("g")
            .attr("transform", `translate(${2 * width / 3 + 5},${0.32 * height})`)
        colorLegend.selectAll('rect')
            .data(_.range(-30, 31))
            .enter()
            .append('rect')
            .attr('x', 0)
            .attr('y', d => d)
            .attr('width', 10)
            .attr('height', 1)
            .attr('fill', d => {
                let p = self.color_scale.invert(d)
                return myColor(p);
            })

        colorLegend.append('text')
            .attr('x', 0)
            .attr('y', 44)
            .attr('font-size', self.fontSize)
            .attr('dominant-baseline', 'middle')
            .style('fill', 'white')
            .text('Avoidance')

        colorLegend.append('text')
            .attr('x', 0)
            .attr('y', -42)
            .attr('font-size', self.fontSize)
            .attr('dominant-baseline', 'middle')
            .style('fill', 'white')
            .text('Interaction')

        let referenceTriangle = svg.append("g")
            .attr("transform", `translate(300,${0.07 * height})`)
        referenceTriangle
            .append('polygon')
            .attr('points', `-10,20, 5,20 5,35`)
            .attr('id', 'overall-reference-triangle')
        referenceTriangle
            .append('polygon')
            .attr('points', `-10,20, 5,35 -10,35`)
            .attr('id', 'selected-reference-triangle')

        referenceTriangle
            .append('text')
            .attr('id', 'heatmap-overall-label')
            .attr('x', 0)
            .attr('y', 16)
            .attr('fill', 'grey')
            .attr('font-size', 'self.fontSize')
            .attr('text-anchor', 'middle')
            .text('Overall')
            .on('click', self.showHideOverall.bind(self))
        referenceTriangle
            .append('text')
            .attr('id', 'heatmap-selection-label')
            .attr('x', 0)
            .attr('y', 48)
            .attr('fill', 'orange')
            .attr('font-size', 'self.fontSize')
            .attr('text-anchor', 'middle')
            .text('Selected')
            .on('click', self.showHideSelected.bind(self))

        self.wrangle()
    }

    showHideSelected() {
        const self = this;
        self.showSelection = !self.showSelection;
        d3.select('#heatmap-selection-label')
            .attr('fill-opacity', () => {
                if (self.showSelection) {
                    return 1
                } else {
                    return 0.5
                }
            })
        d3.select('#selected-reference-triangle')
            .attr('fill-opacity', () => {
                if (self.showSelection) {
                    return 1
                } else {
                    return 0
                }
            })
        d3.selectAll('.heatmapTriangleOverall, .heatmapTriangleSelected, .heatmapHoverRect').remove();
        self.wrangle()
    }

    showHideOverall() {
        const self = this;
        self.showOverall = !self.showOverall;
        d3.select('#heatmap-overall-label')
            .attr('fill-opacity', () => {
                if (self.showOverall) {
                    return 1
                } else {
                    return 0.5
                }
            })

        d3.select('#overall-reference-triangle')
            .attr('fill-opacity', () => {
                if (self.showOverall) {
                    return 1
                } else {
                    return 0
                }
            })
        d3.selectAll('.heatmapTriangleOverall, .heatmapTriangleSelected, .heatmapHoverRect').remove();
        self.wrangle()
    }


    wrangle() {
        const self = this
        let x = self.x;
        let y = self.y;
        let myColor = self.myColor;
        let svg = self.svg;
        let heatmapTriangleOverall = svg.selectAll('.heatmapTriangleOverall')
            .data(self.visData)
        heatmapTriangleOverall.enter()
            .append("polygon")
            .attr('class', 'heatmapTriangleOverall')
            .attr('points', (d) => {
                let trianglePoints = `${x(d.row)}, ${y(d.col)} ${x(d.row) + x.bandwidth()}, ${y(d.col)} 
                        ${x(d.row) + x.bandwidth()}, ${y(d.col) + y.bandwidth()}`
                // if (self.showOverall && !self.showSelection) {
                //     trianglePoints += ` ${x(d.row)}, ${y(d.col) + y.bandwidth()}`
                // } else if (!self.showOverall) {
                //     trianglePoints = ''
                // }
                return trianglePoints
            })
            .merge(heatmapTriangleOverall)
            .style("fill", function (d) {
                let val = d.val?.overall
                if (d.row === d.col || val == null || !self.showOverall) {
                    return 'none';
                } else {
                    if (val > 0) {
                        val = Math.pow(val, 2 / 3)
                    } else if (val < 0) {
                        val = -1 * Math.sqrt(Math.pow(val * -1, 2 / 3));
                    }
                    return myColor(val)
                }
            })
            .style("stroke-width", 1)
            .style("stroke", d => {
                if (d.row === d.col) {
                    return 'white';
                } else {
                    return 'none';
                }
            })
            .style("opacity", 1)


        let heatmapTriangleSelected = svg.selectAll('.heatmapTriangleSelected')
            .data(self.visData)
        heatmapTriangleSelected.enter()
            .append("polygon")
            .attr('class', 'heatmapTriangleSelected')
            .attr('points', (d) => {
                let trianglePoints = `${x(d.row)}, ${y(d.col)} ${x(d.row)}, ${y(d.col) + y.bandwidth()}
                ${x(d.row) + x.bandwidth()}, ${y(d.col) + y.bandwidth()}`;

                // if (self.showSelection && !self.showOverall) {
                //     trianglePoints += ` ${x(d.row) + x.bandwidth()}, ${y(d.col)}`
                // } else if (!self.showSelection) {
                //     trianglePoints = ''
                // }
                return trianglePoints
            })
            .merge(heatmapTriangleSelected)
            .style("fill", function (d) {
                let val = d.val?.selected
                if (d.row === d.col || val == null || !self.showSelection) {
                    return 'none';
                } else {
                    if (val > 0) {
                        val = Math.pow(val, 2 / 3)
                    } else if (val < 0) {
                        val = -1 * Math.sqrt(Math.pow(val * -1, 2 / 3));
                    }
                    return myColor(val)
                }
            })
            .style("stroke-width", 1)
            .style("stroke", d => {
                if (d.row === d.col) {
                    return 'white';
                } else {
                    return 'none';
                }
            })
            .style("opacity", 1)

        let hoverRects = svg.selectAll('.heatmapHoverRect')
            .data(self.visData)
        hoverRects.enter()
            .append("rect")
            .attr('class', 'heatmapHoverRect')
            .attr("x", function (d) {
                if (d.row === d.col) {
                    return x(d.row) + 0.5;
                } else {
                    return x(d.row);
                }
            })
            .attr("y", function (d) {
                if (d.row === d.col) {
                    return y(d.col) + 0.5;
                } else {
                    return y(d.col);
                }
            })
            .attr("rx", 1)
            .attr("ry", 1)
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .merge(hoverRects)
            .style("fill", "white")
            .style("fill-opacity", "0.001")
            .style("stroke-width", 1)
            .style("stroke", 'none')
            .on("mousemove", (e, d) => {
                self.tooltip
                    .style("opacity", 1)
                    .style("left", (d3.pointer(e)[0]) + "px")
                    .style("top", (d3.pointer(e)[1] - 110) + "px")
                    .html(`<span>${d.row} - ${d.col}</span><br/>
                        <span>Pearson correlation coefficients: <br/> 
                        <b>Selected: ${_.round(d.val.selected, 2)}</b><br/>
                        <b>Overall: ${_.round(d.val?.overall, 2)}</b>
                        </span>`)
            })
            .on("mouseleave", (e, d) => {
                self.tooltip
                    .style("opacity", 0)
            })
            .on("click", (e, d) => {
                this.eventHandler.trigger(Heatmap.events.selectPhenotypePair, {...d, plotName: self.plotName});
            })
    }

    rewrangle() {
        const self = this;
        return self.dataLayer.getHeatmapData()
            .then(data => {
                self.visData = []
                _.each(data, (els, i) => {
                    _.each(els, (el, j) => {
                        self.visData.push({
                            col: self.dataLayer.phenotypes[i],
                            row: self.dataLayer.phenotypes[j],
                            val: el
                        });
                    })
                })
                return self.wrangle();
            })
    }
}

Heatmap.events = {
    selectPhenotypePair: 'selectPhenotypePair'
};