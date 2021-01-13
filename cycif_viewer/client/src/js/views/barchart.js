class Barchart {
    constructor(id, phenotypes) {
        this.id = id;
        this.parent = d3.select(`#${id}`);
        this.phenotypes = phenotypes;
    }

    init() {
        const self = this;
        this.margin = {top: 10, right: 10, bottom: 100, left: 40},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = this.parent.append("svg")
            .attr("id", `${this.id}_barchart_svg`)
            .attr("class", "barchart")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        this.svgSelector = document.getElementById(`${this.id}_barchart_svg`);
        this.svgSelector.style.display = "none";
        this.x = d3.scaleBand()
            .rangeRound([0, this.width], .1)
            .paddingInner(0.1);

        this.y = d3.scaleSymlog()
            .range([this.height, 0])
            .domain([0, 2000])


        this.xAxis = d3.axisBottom()
            .scale(this.x);

        // this.yAxis = d3.axisLeft()
        //     .scale(this.y)

        this.svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + this.height + ")")
            .call(this.xAxis)


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

        this.visData = _.map(chartData, (v, k) => {
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
        self.x.domain(this.visData.map(function (d) {
            return d.key;
        }));
        // self.y.domain([0, d3.max(this.visData, function (d) {
        //     return d.value;
        // })]);


        self.svg.select(".xaxis")
            .transition()
            .duration(100)
            .call(this.xAxis)
            .selectAll("text")
            .attr("y", 0)
            .attr("x", 9)
            .attr("dy", ".35em")
            .attr("transform", "rotate(90)")
            .style("text-anchor", "start");

        // self.svg.select(".yaxis")
        //     .transition()
        //     .duration(100)
        //     .call(this.yAxis)


        let bars = self.svg.selectAll(".bar")
            .data(this.visData);
        bars.enter()
            .append("rect")
            .merge(bars)
            .attr("class", "bar")
            .transition()
            .duration(500)
            .attr("x", d => self.x(d.key))
            .attr("width", self.x.bandwidth())
            .attr("y", d => self.y(d.value))
            .attr("height", function (d) {
                return self.height - self.y(d.value);
            })
            .attr("fill", '#FFA500');

        bars.exit().remove();
    }

    hide() {
        const self = this;
        self.svgSelector.style.display = "none";
    }

}