class StackedBarchart {
    constructor(id, dataLayer, colorScheme, neighborhoods) {
        this.id = id;
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;
        this.neighborhoods = neighborhoods;
    }

    init() {
        const self = this;
        // set the dimensions and margins of the graph
        self.margin = {top: 40, right: 40, bottom: 40, left: 40};
        self.width = 600 - self.margin.left - self.margin.right;
        self.height = 600 - self.margin.top - self.margin.bottom;

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
        self.svg = d3.select(`#${self.id}`)
            .append("svg")
            .attr("width", self.width + self.margin.left + self.margin.right)
            .attr("height", self.height + self.margin.top + self.margin.bottom)
            .attr("id", `${this.id}_barchart_svg`)
            .append("g")
            .attr("transform",
                "translate(" + self.margin.left + "," + self.margin.top + ")");


        self.svgSelector = document.getElementById(`${this.id}_barchart_svg`);
        self.x = d3.scaleBand()
            .rangeRound([0, this.height], .1)
            .paddingInner(0.1);

        // this.y = d3.scaleSymlog()
        self.y = d3.scaleLinear()
            .range([0, this.width])
            .domain([0, 1])


        self.xAxis = d3.axisBottom()
            .scale(self.x);
        self.xAxis.tickSizeOuter(0);


        self.yAxis = d3.axisLeft()
            .scale(this.y);
        self.yAxis.tickSizeOuter(0);


        self.svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + self.height + ")")
            .call(self.xAxis)

        self.svg.append("g")
            .attr("class", "yaxis")
            .call(self.yAxis)

        self.svg.append("text")
            .attr("class", "x_axis_label")
            .attr("transform", `translate(${self.width / 2},${self.height + 22})`)
            .style("text-anchor", "middle")
            .attr("font-size", "0.6em")
            .text("Neighborhood Name")

        return self.wrangle()
    }

    wrangle() {
        const self = this;
        self.visData = _.map(neighborhoods, (elem, index) => {
            let neighborhoodName = _.get(elem, 'neighborhood_name', '');
            let arr = elem.composition_summary.weighted_contribution || [];
            let sum = _.sumBy(arr, d => {
                return d[1];
            });
            let normalizedArray = _.map(arr, e => {
                let val = _.clone(e);
                val[1] = val[1] / sum;
                return val;
            });
            let visArray = []
            _.each(_.range(_.size(normalizedArray)), i => {
                let obj = {}
                obj.index = index;
                obj.neighborhoodName = neighborhoodName;
                obj.phenotype = normalizedArray[i][0];
                obj.val = normalizedArray[i][1];
                if (i == 0) {
                    obj.y = 0;
                } else {
                    obj.y = visArray[i - 1].y + visArray[i - 1].val;
                }
                visArray.push(obj)
            });
            return visArray;
        });
        self.neighborhoodNames = _.map(neighborhoods, elem => {
            return _.get(elem, 'neighborhood_name', '');
        });
        self.x.domain(self.neighborhoodNames);
        return self.draw();
    }

    draw() {
        const self = this;
        self.svg.select(".xaxis")
            .transition()
            .duration(100)
            .call(this.xAxis)
            .selectAll("text")
            .attr("y", 10)
            .attr("x", 0)
            .attr("dy", ".35em")
            .attr("font-size", "0.8em")
            .style("text-anchor", "middle")

        self.svg.select(".yaxis")
            .transition()
            .duration(100)
            .call(this.yAxis)
            .selectAll("text")
            .attr("y", 0)
            .attr("x", -10)
            .attr("dy", ".35em")
            .attr("font-size", "0.8em")
            .style("text-anchor", "end")


        let barGroup = self.svg.selectAll(".barGroup")
            .data(this.visData)
            .enter()
            .append("g")
            .classed("barGroup", true)
            .attr("transform", function (d, i) {
                return "translate(" + self.x(self.neighborhoodNames[i]) + ",0)";
            });
        let bars = barGroup.selectAll('.bar')
            .data(d => d)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("y", (d, i) => {
                return self.y(d.y)
            })
            .attr("height", d => {
                return self.y(d.val)
            })
            .attr("x", 2)
            .attr("width", self.x.bandwidth())
            .attr("fill", d => {
                return self.colorScheme.colorMap[d.phenotype].hex;
            })
            .on("mouseover", (e, d) => {
                d3.select(e.currentTarget)
                    .style("stroke", "1px")
                    .style("opacity", 1)
            })
            .on("mousemove", (e, d, i) => {
                self.tooltip
                    .html(`<h5>${d.neighborhoodName}</h5>
                            <span>${d.phenotype}: <b>${_.round(d.val * 100, 2)} %</b></span>`)
                    .style("left", (d3.pointer(e)[0] + self.x(d.neighborhoodName)) + "px")
                    .style("top", (d3.pointer(e)[1] - 40) + "px")
            })
            .on("mouseleave", (e, d) => {
                self.tooltip
                    .style("opacity", 1)
                d3.select(e.currentTarget)
                    .style("stroke", "none")
                    .style("opacity", 0.8)
            })

        bars.exit().remove();
    }


}