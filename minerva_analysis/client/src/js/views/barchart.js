class Barchart {
    constructor(id, phenotypes) {
        this.id = id;
        this.parent = d3.select(`#${id}`);
        this.phenotypes = phenotypes;
    }

    init() {
        const self = this;
        this.margin = {top: 10, right: 25, bottom:50, left: 110},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;
        if (this.height <= 0) {
            this.height = 140;
        }
        this.svg = this.parent.append("svg")
            .attr("id", `${this.id}_barchart_svg`)
            .attr("class", "barchart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        this.svgSelector = document.getElementById(`${this.id}_barchart_svg`);
        this.svgSelector.style.display = "none";
        this.y = d3.scaleBand()
            .rangeRound([0, this.height], .1)
            .paddingInner(0.1);

        this.x = d3.scaleLinear()
            .range([0, this.width])
            .domain([0, 0.6])

        this.x.clamp(true);

        this.xAxis = d3.axisBottom()
            .scale(this.x)
        this.xAxis.tickSizeOuter(0);
        this.xAxis.tickFormat(d3.format(".0%"))
        this.xAxis.tickValues([0, 0.3, 0.6])


        this.yAxis = d3.axisLeft()
            .scale(this.y);
        this.yAxis.tickSizeOuter(0);


        this.svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.xAxis)


        this.svg.append("g")
            .attr("class", "yaxis")
            .call(this.yAxis)


        // this.svg.append("g")
        //     .attr("class", "yaxis")
        //     .call(this.yAxis)
        //     .append("text")
        //     .attr("transform", "rotate(-90)")
        //     .attr("y", 6)
        //     .attr("dy", ".71em")
        //     .style("text-anchor", "end")
        //     .text("Weighted Neighborhood Contribution");
    }

    wrangle(chartData, order = null) {
        const self = this;

        if (!order) {
            order = self.phenotypes;
        }

        this.visData = _.map(chartData, (e) => {
            let [k, v] = e;
            return {
                key: k,
                short: k,
                value: v,
                index: _.indexOf(order, k)
            }
        })
        this.visData = _.filter(this.visData, elem => {
            return elem.index !== -1; // Remove elements not in my order list
        });
        this.visData = _.sortBy(this.visData, ['index']);

        self.svgSelector.style.display = "block";
        self.y.domain(this.visData.map(function (d) {
            return d.key.replace('cells', '');
        }));
        // self.y.domain([0, d3.max(this.visData, function (d) {
        //     return d.value;
        // })]);

        self.svg.select(".xaxis")
            .transition()
            .duration(100)
            .call(this.xAxis)
            .selectAll("text")
            .attr("y", 10)
            .attr("x", 0)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .style('fill', 'white')
        // TODO: For Figures
        // .style('fill', 'black')

        self.svg.select(".yaxis")
            .transition()
            .duration(100)
            .call(this.yAxis)
            .selectAll("text")
            .attr("y", 0)
            .attr("x", -10)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .style('fill', 'white')
        // TODO: For Figures
        // .style('fill', 'black')


        let bars = self.svg.selectAll(".bar")
            .data(this.visData);
        bars.enter()
            .append("rect")
            .merge(bars)
            .attr("class", "bar")
            .transition()
            .duration(500)
            .attr("y", d => self.y(d.key.replace('cells','')))
            .attr("height", self.y.bandwidth())
            .attr("x", 2)
            .attr("width", function (d) {
                return self.x(d.value);
            })
            .attr("fill", '#8f8f8f');

        bars.exit().remove();

        this.svg.select('.xaxis')
            .append('text')
            .attr("font-size", "0.8rem")
            .attr("y", 25)
            .attr("x", self.x(0.2))
            .style("text-anchor", "middle")
            .style('fill', 'black')
            .text('Neighborhood Composition')
            .style('fill', 'white')
        // TODO: For Figures
        // .style('fill', 'black')

    }

    hide() {
        const self = this;
        self.svgSelector.style.display = "none";
    }

}