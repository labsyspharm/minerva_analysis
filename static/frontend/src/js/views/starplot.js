class Starplot {
    constructor(id, colorScheme) {
        this.id = id;
        this.parent = d3.select(`#${id}`)
        this.colorScheme = colorScheme;
    }

    init(visData) {
        this.margin = {top: 10, right: 10, bottom: 100, left: 40},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;


        this.visData = visData;
        this.config = {
            radius: 5,
            w: this.width,
            h: this.height,
            factor: 1,
            factorLegend: .85,
            levels: 3,
            radians: 2 * Math.PI,
            opacityArea: 0.5,
            ToRight: 5,
            TranslateX: 80,
            TranslateY: 30,
            ExtraWidthX: 100,
            ExtraWidthY: 100,
            color: d3.scaleOrdinal().range(["#6F257F", "#CA0D59"])
        };

    }

    draw(cluster) {
        const self = this;
        // self.svgSelector.style.display = "block";
        let chartData = _.get(self.visData, `[${cluster}].clusterSummary.weighted_contribution`, {});
        let chartDataArray = _.toPairs(chartData);
        let phenotypes = _.keys(chartData);
        self.config.maxValue = _.max(Object.keys(chartData), function (o) {
            return o;
        });
        self.config.maxValue = 100;

        let allAxis = _.values(chartData);
        var total = allAxis.length;
        var radius = self.config.factor * Math.min(self.config.w / 2, self.config.h / 2);
        var Format = d3.format('%');
        this.parent.select("svg").remove();

        let g = this.parent
            .append("svg")
            .attr("width", self.config.w + self.config.ExtraWidthX)
            .attr("height", self.config.h + self.config.ExtraWidthY)
            .append("g")
            .attr("transform", "translate(" + self.config.TranslateX + "," + self.config.TranslateY + ")");

        var tooltip;

        //Circular segments
        for (var j = 0; j < self.config.levels; j++) {
            var levelFactor = self.config.factor * radius * ((j + 1) / self.config.levels);
            g.selectAll(".levels")
                .data(chartDataArray)
                .enter()
                .append("svg:line")
                .attr("x1", function (d, i) {
                    return levelFactor * (1 - self.config.factor * Math.sin(i * self.config.radians / total));
                })
                .attr("y1", function (d, i) {
                    return levelFactor * (1 - self.config.factor * Math.cos(i * self.config.radians / total));
                })
                .attr("x2", function (d, i) {
                    return levelFactor * (1 - self.config.factor * Math.sin((i + 1) * self.config.radians / total));
                })
                .attr("y2", function (d, i) {
                    return levelFactor * (1 - self.config.factor * Math.cos((i + 1) * self.config.radians / total));
                })
                .attr("class", "line")
                .style("stroke", "grey")
                .style("stroke-opacity", "0.75")
                .style("stroke-width", "0.3px")
                .attr("transform", "translate(" + (self.config.w / 2 - levelFactor) + ", " + (self.config.h / 2 - levelFactor) + ")");
        }

        //Text indicating at what % each level is
        for (var j = 0; j < self.config.levels; j++) {
            var levelFactor = self.config.factor * radius * ((j + 1) / self.config.levels);
            g.selectAll(".levels")
                .data([1]) //dummy data
                .enter()
                .append("svg:text")
                .attr("x", function (d) {
                    return levelFactor * (1 - self.config.factor * Math.sin(0));
                })
                .attr("y", function (d) {
                    return levelFactor * (1 - self.config.factor * Math.cos(0));
                })
                .attr("class", "legend")
                .style("font-family", "sans-serif")
                .style("font-size", "10px")
                .attr("transform", "translate(" + (self.config.w / 2 - levelFactor + self.config.ToRight) + ", " + (self.config.h / 2 - levelFactor) + ")")
                .attr("fill", "#737373")
        }

        let series = 0;

        var axis = g.selectAll(".axis")
            .data(chartDataArray)
            .enter()
            .append("g")
            .attr("class", "axis");

        axis.append("line")
            .attr("x1", self.config.w / 2)
            .attr("y1", self.config.h / 2)
            .attr("x2", function (d, i) {
                return self.config.w / 2 * (1 - self.config.factor * Math.sin(i * self.config.radians / total));
            })
            .attr("y2", function (d, i) {
                return self.config.h / 2 * (1 - self.config.factor * Math.cos(i * self.config.radians / total));
            })
            .attr("class", "line")
            .style("stroke", "grey")
            .style("stroke-width", "1px");

        axis.append("text")
            .attr("class", "legend")
            .text(function (d) {
                return d[0]
            })
            .style("font-family", "sans-serif")
            .style("font-size", "11px")
            .attr("text-anchor", "middle")
            .attr("dy", "1.5em")
            .attr("transform", function (d, i) {
                return "translate(0, -10)"
            })
            .attr("x", function (d, i) {
                return self.config.w / 2 * (1 - self.config.factorLegend * Math.sin(i * self.config.radians / total)) - 60 * Math.sin(i * self.config.radians / total);
            })
            .attr("y", function (d, i) {
                return self.config.h / 2 * (1 - Math.cos(i * self.config.radians / total)) - 20 * Math.cos(i * self.config.radians / total);
            });

        let dataValues = [];
        g.selectAll(".nodes")
            .data(chartDataArray, function (j, i) {
                dataValues.push([
                    self.config.w / 2 * (1 - (parseFloat(Math.max(j[1], 0)) / self.config.maxValue) * self.config.factor * Math.sin(i * self.config.radians / total)),
                    self.config.h / 2 * (1 - (parseFloat(Math.max(j[1], 0)) / self.config.maxValue) * self.config.factor * Math.cos(i * self.config.radians / total))
                ]);
            });
        dataValues.push(dataValues[0]);
        g.selectAll(".area")
            .data([dataValues])
            .enter()
            .append("polygon")
            .attr("class", "radar-chart-serie" + series)
            .style("stroke-width", "2px")
            .style("stroke", self.config.color(series))
            .attr("points", function (d) {
                var str = "";
                for (var pti = 0; pti < d.length; pti++) {
                    str = str + d[pti][0] + "," + d[pti][1] + " ";
                }
                return str;
            })
            .style("fill", function (j, i) {
                return self.config.color(series)
            })
            .style("fill-opacity", self.config.opacityArea)
            .on('mouseover', function (d) {
                z = "polygon." + d3.select(this).attr("class");
                g.selectAll("polygon")
                    .transition(200)
                    .style("fill-opacity", 0.1);
                g.selectAll(z)
                    .transition(200)
                    .style("fill-opacity", .7);
            })
            .on('mouseout', function () {
                g.selectAll("polygon")
                    .transition(200)
                    .style("fill-opacity", self.config.opacityArea);
            });

        //
        // var tooltip = d3.select("body").append("div").attr("class", "toolTip");
        // g.selectAll(".nodes")
        //     .data(allAxis).enter()
        //     .append("svg:circle")
        //     .attr("class", "radar-chart-serie" + series)
        //     .attr('r', self.config.radius)
        //     .attr("alt", function (j) {
        //         return Math.max(j, 0)
        //     })
        //     .attr("cx", function (j, i) {
        //         dataValues.push([
        //             self.config.w / 2 * (1 - (parseFloat(Math.max(j, 0)) / self.config.maxValue) * self.config.factor * Math.sin(i * self.config.radians / total)),
        //             self.config.h / 2 * (1 - (parseFloat(Math.max(j, 0)) / self.config.maxValue) * self.config.factor * Math.cos(i * self.config.radians / total))
        //         ]);
        //         return self.config.w / 2 * (1 - (Math.max(j, 0) / self.config.maxValue) * self.config.factor * Math.sin(i * self.config.radians / total));
        //     })
        //     .attr("cy", function (j, i) {
        //         return self.config.h / 2 * (1 - (Math.max(j, 0) / self.config.maxValue) * self.config.factor * Math.cos(i * self.config.radians / total));
        //     })
        //     .attr("data-id", function (j) {
        //         return j.area
        //     })
        //     .style("fill", "#fff")
        //     .style("stroke-width", "2px")
        //     .style("stroke", self.config.color(series)).style("fill-opacity", .9)
        //     .on('mouseover', function (d) {
        //         console.log(d.area)
        //         tooltip
        //             .style("left", d3.event.pageX - 40 + "px")
        //             .style("top", d3.event.pageY - 80 + "px")
        //             .style("display", "inline-block")
        //             .html((d.area) + "<br><span>" + (d.value) + "</span>");
        //     })
        //     .on("mouseout", function (d) {
        //         tooltip.style("display", "none");
        //     });
        //
        // series++;
    }
};