class ParallelCoordinates {
    constructor(id, dataLayer, eventHandler, small = false) {
        this.id = id;
        this.small = small;
        this.parent = d3.select(`#${id}`);
        this.selector = document.getElementById(id);
        this.dataLayer = dataLayer;
        this.phenotypes = this.dataLayer.phenotypes;
        this.eventHandler = eventHandler;
        this.editButton = document.getElementById("edit_neighborhood_composition");
        if (this.editButton) {
            this.editButton.addEventListener('click', this.switchEditMode.bind(this));
        }
        this.searchCol = document.getElementById("custom_search_col");
        if (this.searchCol) {
            this.searchCol.addEventListener('click', this.search.bind(this));
        }
    }

    init() {
        const self = this;
        this.totalWidth = this.parent.node().getBoundingClientRect().width;
        this.totalHeight = this.parent.node().getBoundingClientRect().height;
        this.margin = {top: 20, right: 10, bottom: 100, left: 10},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = this.parent.append("svg")
            .attr("class", "parallel_coords")
            .attr("id", self.id + "_svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
        this.svgGroup = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.parent.append("canvas")
            .attr("class", 'parallel-canvas')
            .attr("id", self.id + "_canvas")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
        this.canvas = document.getElementById(self.id + '_canvas')


        this.svgSelector = document.getElementById(self.id + "_svg");
        // Parse the Data
        this.x = d3.scalePoint()
            .range([0, self.width])
            .padding(1);

        this.lineX = d3.scalePoint()
            .range([self.margin.left, self.width + self.margin.left])
            .padding(1);


        this.y = d3.scaleLinear()
            .domain([0, 1])
            .range([self.height, 0]);
        this.y.clamp(true);

        this.lineY = d3.scaleLinear()
            .domain([0, 1])
            .range([self.height + self.margin.top, self.margin.top]);

        let emptyData = _.map(this.phenotypes, pheno => {
            return [pheno, 0];
        })
        self.svgGroup.append("path")
            .attr("fill", "none")
            .classed("average_path", true)
            .attr("stroke", d => {
                if (self.small) {
                    return "black";
                } else {
                    return "orange";
                }
            })

        this.editMode = false;
        this.drag = d3.drag(self)
            .on("drag", (e, d) => {
                if (self.editMode) {
                    return self.dragging(self, d, e);
                }
            })
            .on("end", () => {
                if (self.editMode) {
                    self.canvas.getContext('2d').clearRect(0, 0, self.canvas.width, self.canvas.height)
                }
            })
        this.wrangle(emptyData);
        self.svgGroup.selectAll(".average_path")
            .attr("stroke-width", 0)

    }

    wrangle(rawData, order = null) {
        const self = this;
        let chartData = _.get(rawData, 'cluster_summary.weighted_contribution', null);
        if (chartData) {
            self.full_neighborhoods = _.get(rawData, 'cluster_summary.full_neighborhoods', null);
        } else {
            chartData = rawData;
        }

        if (!order) {
            order = self.phenotypes;
        }
        const sum = _.sumBy(chartData, e => {
            return e[1];
        })
        this.visData = _.map(chartData, e => {
            let [k, v] = e;
            let val = v / sum;
            if (!_.isFinite(val)) {
                val = 0; // handle divide by 0
            }
            return {
                key: k,
                short: k,
                value: val,
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
        self.lineX.domain(this.visData.map(function (d) {
            return d.index;
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
                        .tickValues(_.range(0, 1.2, 0.2))
                        .tickFormat(d3.format(".0%")));
                } else {
                    d3.select(this).call(d3.axisLeft()
                        .scale(self.y)
                        .tickSize(0)
                        .tickValues([]));
                }
            })

        let avgLineLegend = self.svgGroup.selectAll('.average_line')
            .data([0])
        avgLineLegend.enter()
            .append('line')
            .classed('average_line', true)
            .attr('x1', self.width - 40)
            .attr('y1', -15)
            .attr('x2', self.width - 20)
            .attr('y2', -15)
            .attr("stroke-width", 3)
            .attr('stroke', d => {
                if (self.small) {
                    return "black";
                } else {
                    return "orange";
                }
            })

        let avgLineLabel = self.svgGroup.selectAll('.average_line_label')
            .data([0])
        avgLineLegend.enter()
            .append('text')
            .classed('average_line_label', true)
            .attr('x', self.width - 60)
            .attr('y', -13)
            .attr('font-size', '0.5rem')
            .text('Avg.')


        self.svgGroup.select(".average_path")
            .datum(self.visData)
            .classed("average_path", true)
            .attr("fill", "none")
            .attr("stroke", d => {
                if (self.small) {
                    return "black";
                } else {
                    return "orange";
                }
            })
            .attr("stroke-width", 2)
            .attr("d", d3.line()
                .x(function (d) {
                    return self.x(d.key);
                })
                .y(function (d) {
                    return self.y(d.value);
                })
            )

        let labels = self.svgGroup.selectAll('.par_cor_label')
            .data(self.visData)
        labels.enter()
            // Add axis title
            .append("text")
            .merge(labels)
            .style("text-anchor", "start")
            .attr("y", 1)
            .attr("x", 5)
            .text(function (d) {
                return d.key;
            })
            .classed("par_cor_label", true)
            .style("fill", "black")
            .attr("transform", d => {
                return "translate(" + self.x(d.key) + "," + self.height + ") rotate(90)"
            })
            .attr('fill-opacity', d => {
                if (d.disabled) {
                    return 0.3;
                } else {
                    return 1;
                }
            })
            .on('click', self.enableOrDisablePhenotype.bind(self));

        labels.exit().remove()

        // let bars = self.svg.selectAll(".bar")
        //             .data(this.visData);
        //         bars.enter()
        //             .append("rect")
        let handler = self.svgGroup.selectAll('.handler')
            .data(self.visData)
        handler
            .enter()
            .append("circle")
            .merge(handler)
            .classed('handler', true)
            .style("fill", "rgba(200,200,200,0)")
            .attr("visibility", "visible")
            .attr("r", 6)
            .attr("cx", d => {
                return self.x(d.key)
            })
            .attr("cy", d => {
                return self.y(d.value);
            })
            .call(self.drag)
            .on("click", (event, d) => {
                if (event.defaultPrevented) return; // dragged
            })
        handler.exit().remove();

        if (self.full_neighborhoods && !self.editMode) {
            self.canvas.getContext('2d').clearRect(0, 0, self.canvas.width, self.canvas.height);
            let opacity = 0.01;
            if (_.size(self.full_neighborhoods) < 5000) {
                opacity = -0.0000180036 * _.size(self.full_neighborhoods) + 0.100018
            } else {
                opacity = 0.01;
            }
            _.forEach(_.sampleSize(self.full_neighborhoods, 5000), row => {
                const sum = _.sum(row);
                const color = `hsla(0,0%,50%,${opacity})`;
                self.canvas.getContext('2d').strokeStyle = color;
                self.canvas.getContext('2d').beginPath();
                row.map(function (p, i) {
                    if (i == 0) {
                        self.canvas.getContext('2d').moveTo(self.lineX(i), self.lineY(p / sum));
                    } else {
                        self.canvas.getContext('2d').lineTo(self.lineX(i), self.lineY(p / sum));
                    }
                });
                self.canvas.getContext('2d').stroke();
            })
        }


    }

    switchEditMode() {
        const self = this;
        self.editMode = !self.editMode;
        if (self.editMode) {
            self.searchCol.style.visibility = "visible";
            self.draw();
        } else {
            self.searchCol.style.visibility = "hidden";
        }
        _.each(document.querySelectorAll('.handler'), elem => {
            if (self.editMode) {
                elem.style.cursor = 'move';
            } else {
                elem.style.cursor = 'default';
            }
        })

        _.each(document.querySelectorAll('.viewfinder_chart_label_g_g_text_g'), elem => {
            if (self.editMode) {
                elem.style.cursor = 'pointer';
            } else {
                elem.style.cursor = 'default';
            }
        })
    }

    enableOrDisablePhenotype(e, d) {
        const self = this;
        if (self.editMode) {
            if (d.disabled) {
                self.visData[d.index]['value'] = self.visData[d.index]['oldValue'] || self.visData[d.index]['value'];
                self.visData[d.index]['disabled'] = false;
                self.visData[d.index]['oldValue'] = null;
            } else {
                self.visData[d.index]['oldValue'] = self.visData[d.index]['value'];
                self.visData[d.index]['value'] = 0;
                self.visData[d.index]['disabled'] = true;
            }
            self.draw();
        }


    }

    search() {
        const self = this;
        // First we reproportion values to be percentages
        let total = _.sumBy(self.visData, 'value');
        _.each(self.visData, el => {
            el.value = el.value / total;
        })
        self.draw();
        seaDragonViewer.showLoader();
        let sim = document.getElementById('similarity_val').innerHTML || '0.8';
        let simVal = parseFloat(sim);
        return dataLayer.findSimilarNeighborhoods(_.keyBy(self.visData, 'key'), simVal)
            .then(cells => {
                self.switchEditMode();
                seaDragonViewer.hideLoader();
                self.eventHandler.trigger(ImageViewer.events.displayNeighborhoodSelection, cells);
            })
    }

    dragging(self, d, e) {
        // This handles when the line is directly vertical, as both x and y can be used to solve for the value
        let newVal = self.y.invert(e.y);
        self.visData[d.index].value = newVal;
        self.visData[d.index].disabled = false;
        self.draw(true);
    }


    hide() {
        const self = this;
    }

}

function path(d, ctx) {

};

