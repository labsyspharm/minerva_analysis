class Starplot {
    constructor(id, dataLayer, eventHandler, small = false) {
        this.id = id;
        this.small = small;
        this.parent = d3.select(`#${id}`);
        this.selector = document.getElementById(id);
        this.dataLayer = dataLayer;
        this.phenotypes = this.dataLayer.phenotypes;
        this.eventHandler = eventHandler;
    }

    init() {
        const self = this;
        this.totalWidth = this.parent.node().getBoundingClientRect().width;
        this.totalHeight = this.parent.node().getBoundingClientRect().height;
        this.margin = {top: 10, right: 10, bottom: 100, left: 10},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = this.parent.append("svg")
            .attr("id", "parallel_coords")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
        this.svgGroup = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.canvas = this.parent.append("canvas")
            .attr("id", `regl-canvas`)
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)


        this.svgSelector = document.getElementById(`${this.id}_parallel_coords_svg`);
        // Parse the Data
        this.x = d3.scalePoint()
            .range([0, self.width])
            .padding(1);


        this.y = d3.scaleLinear()
            .domain([0, 1])
            .range([self.height, 0]);

        let emptyData = _.map(this.phenotypes, pheno => {
            return [pheno, 0];
        })

        self.svgGroup.append("path")
            .attr("fill", "none")
            .classed("average_path", true)
            .attr("stroke", "black")

        this.line2d = Line2D(regl({canvas: '#regl-canvas', extensions: 'angle_instanced_arrays'}))
        return this.wrangle(emptyData);
    }


    wrangle(rawData, order = null) {
        const self = this;
        let chartData = _.get(rawData, 'composition_summary.weighted_contribution', null);
        if (chartData) {
            self.selection_neighborhoods = _.get(rawData, 'composition_summary.selection_neighborhoods', null);
        } else {
            chartData = rawData;
        }

        if (!order) {
            order = self.phenotypes;
        }

        this.visData = _.map(chartData, e => {
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
        self.x.domain(this.visData.map(function (d) {
            return d.key;
        }));
        self.bottomLeft = [(self.margin.left + self.x(self.visData[0].key)) / self.totalWidth,
            self.margin.bottom / self.totalHeight]

        self.topRight = [(self.margin.left + self.x(_.last(self.visData).key)) / self.totalWidth,
            1 - (self.margin.top / self.totalHeight)]

        self.webglX = d3.scaleLinear()
            .domain([0, _.size(self.visData) - 1])
            .range([self.bottomLeft[0], self.topRight[0]]);

        self.webglY = d3.scaleLinear()
            .domain([0, 1])
            .range([self.bottomLeft[1], self.topRight[1]])
        return self.draw()


    }

    draw() {
        const self = this;


        // this.line2d.render({points: [0.5, 0.5, 0.6, 0.6], opacity: 0.5, color: [0, 0, 0]})
        self.svgGroup.selectAll(".parallel_axes")
            // For each dimension of the dataset I add a 'g' element:
            .data(self.visData).enter()
            .append("g")
            .attr("class", "parallel_axes")
            // I translate this element to its right position on the x axis
            .attr("transform", function (d) {
                return "translate(" + self.x(d.key) + ")";
            })

            // And I build the axis with the call function
            .each(function (d) {
                if (d.index == 0) {
                    d3.select(this).call(d3.axisLeft()
                        .scale(self.y)
                        .tickSize(0)
                        .tickValues(_.range(0, 1.2, 0.2)));
                } else {
                    d3.select(this).call(d3.axisLeft()
                        .scale(self.y)
                        .tickSize(0)
                        .tickValues([]));
                }
            })
            // Add axis title
            .append("text")
            .style("text-anchor", "start")
            .attr("y", 1)
            .attr("x", 5)
            .text(function (d) {
                return d.key;
            })
            .classed("par_cor_label", true)
            .style("fill", "black")
            .attr("transform", "translate(0," + self.height + ") rotate(90)")

        self.svgGroup.select(".average_path")
            .datum(self.visData)
            .classed("average_path", true)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1.5)
            .attr("d", d3.line()
                .x(function (d) {
                    return self.x(d.key);
                })
                .y(function (d) {
                    return self.y(d.value);
                })
            )
        if (self.selection_neighborhoods) {
            _.forEach(_.sampleSize(self.selection_neighborhoods, 2000), row => {
                let points = _.map(row, (e, i) => {
                    return [self.webglX(i), self.webglY(e)]
                })
                self.line2d.render([{
                    thickness: 1,
                    points: points,
                    join: 'join',
                    color: [0.3, 0.3, 0.3, 0.01],
                    range: [0, 0, 1, 1],
                    overlay: true,
                },
                ])
            })
        }
        self.line2d.destroy()


    }

    hide() {
        const self = this;
    }

}
