class ParallelCoordinates {
    constructor(id, dataLayer, eventHandler, colorScheme, small = false) {
        const self = this;
        this.id = id;
        this.small = small;
        this.colorScheme = colorScheme;
        this.parent = d3.select(`#${id}`);
        this.selector = document.getElementById(id);
        this.dataLayer = dataLayer;
        this.phenotypes = this.dataLayer.phenotypes;
        this.eventHandler = eventHandler;
        this.hideOverall = false;
        this.editButton = document.getElementById("edit_neighborhood_composition");
        if (this.editButton) {
            this.editButton.addEventListener('click', this.switchEditMode.bind(this));
        }
        this.labelPositions = {}
        this.order = {};
        this.dataLayer.defaultOrder.forEach((d, i) => {
            this.order[d] = i;
        })
        this.reorder = false;
        // this.order = this.dataLayer.defaultOrder;
        this.sliders = new Map();
        this.dragHandler = d3.drag()
            .on('drag', (e, d) => {
                if (self.reorder) {
                    // let current =
                    let swap = (index1, index2) => {
                        console.log('swap', index1, index2);
                        d3.select(self.visData[index2].ele)
                            .attr('y', d => {
                                return self.labelPositions[index1];
                            });
                        [[self.visData[index1], self.visData[index2]]] = [[self.visData[index2], self.visData[index1]]];

                    }
                    let y = e.y + 3;
                    d3.select(d.ele)
                        .attr('y', y);
                    let buffer = 5; // 10 px buffer above and below to switch
                    if ((d.index !== 0 && y - buffer < self.labelPositions[d.index - 1])) {
                        swap(d.index, d.index - 1);
                        d.index = d.index - 1;
                    }
                    if ((d.index !== self.visData.length - 1 && y + buffer > self.labelPositions[d.index + 1])) {
                        swap(d.index, d.index + 1);
                        d.index = d.index + 1;
                    }
                }
            })
            .on('start', (e, d) => {
                if (self.reorder) {
                    console.log('dragstart', d.key, 'true')
                    d3.select(self.svgGroup.selectAll('.par_cor_label').nodes().forEach((d, i) => {
                        self.visData[i].ele = d;
                    }));
                    d.ele = e.sourceEvent.target;
                } else {
                    self.eventHandler.trigger(ParallelCoordinates.events.selectPhenotype, d.key);
                }
            })
            .on('end', (e, d) => {
                if (self.reorder) {
                    console.log('dragend', d.key, 'false')
                    self.visData.forEach((d, i, arr) => {
                        self.visData[i].index = i;
                        self.order[d.key] = i;
                        delete self.visData[i].ele;
                    })
                    self.y.domain(this.visData.map(function (d) {
                        return d.key;
                    }));
                    self.drawAxisLabels();
                    // self.drawDots();
                    self.drawPaths();
                }
            })


    }

    init() {
        const self = this;

        this.totalWidth = this.parent.node().getBoundingClientRect().width;
        this.totalHeight = this.parent.node().getBoundingClientRect().height;
        if (this.small) {
            this.margin = {top: 10, right: 55, bottom: 10, left: 100};

        } else {
            this.margin = {top: 30, right: 55, bottom: 10, left: 150};
        }
        this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = this.parent.append("svg")
            .attr("class", "parallel_coords")
            .attr("id", self.id + "_svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
        this.svgGroup = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        let canvasWrapper = this.parent.append('div')
            .style('height', '100%')
            .style('width', '100%')
            .style("padding-left", `${this.margin.left}px`)
            .style("padding-right", `${this.margin.right}px`)
            .style("padding-top", `${this.margin.top}px`)
            .style("padding-bottom", `${this.margin.bottom}px`)
            .style('position', 'absolute')


        canvasWrapper.append("canvas")
            .attr("class", 'parallel-canvas')
            .attr("id", self.id + "_canvas")
            .attr("width", this.width)
            .attr("height", this.height)


        this.canvas = document.getElementById(self.id + '_canvas')


        this.svgSelector = document.getElementById(self.id + "_svg");
        // Parse the Data
        this.x = d3.scaleLinear()
            .range([0, self.width])
            .domain([0, 1])

        this.x.clamp(false);

        this.lineX = d3.scaleLinear()
            .range([0, self.width])
            .domain([0, 1])


        this.y = d3.scalePoint()
            .range([0, self.height])
            .padding(1);


        this.lineY = d3.scalePoint()
            .range([0, self.height])
            .padding(1);


        let emptyData = _.map(this.phenotypes, pheno => {
            return [pheno, 0];
        })
        self.svgGroup.append("path")
            .attr("fill", "none")
            .classed("average_path", true)
            .attr("stroke", "white")
            .attr("stroke-opacity", "0.8")


        this.editMode = false;
        this.drag = d3.drag(self)
            .on("drag", (e, d) => {
                if (self.editMode) {
                    return self.dragging(self, d, e);
                }
            })
            .on("end", () => {
                if (self.editMode) {
                    let test = '';
                    // self.canvas.getContext('2d').clearRect(0, 0, self.canvas.width, self.canvas.height)
                }
            })
        if (!this.visData) {
            this.wrangle(emptyData);
        }
        self.svgGroup.selectAll(".average_path")
            .attr("stroke-width", 2)


        // _.sortBy(Object.entries(self.order), d => d[1]).forEach(d => {
        //     self.addSlider(d[0])
        // })
    }

    wrangle(rawData, order = null) {
        const self = this;
        let chartData = rawData[datasource]?.['composition_summary']?.['weighted_contribution'] || _.get(rawData, 'composition_summary.weighted_contribution', null);
        if (chartData) {
            self.selection_neighborhoods = rawData[datasource]?.['composition_summary']?.['selection_neighborhoods'] || _.get(rawData, 'composition_summary.selection_neighborhoods', null);
        } else {
            chartData = rawData;
        }
        if (!order && !self.order) {
            self.phenotypes.forEach((d, i) => {
                self.order[d] = i
            })
        } else if (order) {
            self.order = order;
        }

        this.visData = _.map(chartData, e => {
            let [k, v] = e;
            let val = v;
            if (!_.isFinite(val)) {
                val = 0; // handle divide by 0
            }
            return {
                key: k,
                short: k,
                value: val,
                index: self.order[k]
            }
        })

        this.visData = _.filter(this.visData, elem => {
            return elem.index !== -1; // Remove elements not in my order list
        });


        this.visData = _.sortBy(this.visData, ['index']);

        this.scale();
        return self.draw()
    }

    scale() {
        const self = this;
        self.y.domain(this.visData.map(function (d) {
            return d.key;
        }));
        let yDomain = this.visData.map(function (d) {
            return d.index;
        });
        self.lineY.domain(yDomain);


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
    }

    rewrangle() {
        const self = this;
        d3.select(`#${self.id}_svg`).remove()
        d3.select(`#${self.id}_canvas`).remove()
        self.init();
        self.scale();
        self.draw();

    }

    draw() {
        const self = this;
        // this.line2d.render({points: [0.5, 0.5, 0.6, 0.6], opacity: 0.5, color: [0, 0, 0]})
        self.svgGroup.selectAll(".parallel_axes")
            // For each dimension of the dataset I add a 'g' element:
            .data([null]).enter()
            .append("g")
            .attr("class", "parallel_axes")
            .attr("transform", "translate(0, 0)")
            // I translate this element to its right position on the x axis
            // .attr("transform", function (d) {
            //     return "translate(" + self.y(d.key) + ")";
            // })

            // And I build the axis with the call function
            .each(function (d, i) {
                d3.select(this).call(d3.axisBottom()
                    .scale(self.x)
                    .tickSize(0)
                    .tickValues(_.range(0, 1.2, 0.2))
                    .tickFormat(d3.format(".0%")));
            })


        // const legendTextSize = '1.4vh'
        const legendTextSize = '0.8rem'


        let reorderButton = self.svgGroup.selectAll('.reorder_button')
            .data([0])
        reorderButton.enter()
            .append('text')
            .classed('reorder_button', true)
            .attr('x', -self.margin.left + 10)
            .attr('y', -9)
            .attr('font-size', legendTextSize)
            .attr('fill', '#3870ce')
            .attr('text-anchor', 'start')
            .style('cursor', 'pointer')
            .text('Reorder')
            .on("click", (event, d) => {
                if (self.reorder) {
                    d3.select(event.currentTarget).attr('fill', '#3870ce')
                    d3.selectAll('.par_cor_label').style('cursor', 'pointer');

                } else {
                    d3.select(event.currentTarget).attr('fill', 'white')
                    d3.selectAll('.par_cor_label').style('cursor', 'move');

                }
                self.reorder = !self.reorder;
            })


        let overallLineLegend = self.svgGroup.selectAll('.overall_line')
            .data([0])
        overallLineLegend.enter()
            .append('line')
            .classed('overall_line', true)
            .attr('x1', self.x(0.0))
            .attr('y1', -25)
            .attr('x2', self.x(-0.05))
            .attr('y2', -25)
            .attr("stroke-width", 4)
            .attr('stroke', 'grey')
            .attr('stroke-opacity', () => {
                if (self.hideOverall) {
                    return 0.5;
                } else {
                    return 1;
                }
            })


        let overallLineLabel = self.svgGroup.selectAll('.overall_line_label')
            .data([0])
        overallLineLabel.enter()
            .append('text')
            .classed('overall_line_label', true)
            .attr('x', self.x(0))
            .attr('y', -9)
            .attr('font-size', legendTextSize)
            .attr('fill', 'grey')
            .attr('text-anchor', 'end')
            .text('Overall')
            .on("click", (event, d) => {
                self.hideOverall = !self.hideOverall;
                self.draw();
            })

        let avgLineLegend = self.svgGroup.selectAll('.average_line')
            .data([0])
        avgLineLegend.enter()
            .append('line')
            .classed('average_line', true)
            .attr('x1', self.x(0.6))
            .attr('y1', -25)
            .attr('x2', self.x(0.55))
            .attr('y2', -25)
            .attr("stroke-width", 4)
            .attr('stroke', 'white')


        let avgLineLabel = self.svgGroup.selectAll('.average_line_label')
            .data([0])
        avgLineLabel.enter()
            .append('text')
            .classed('average_line_label', true)
            .attr('x', self.x(0.6))
            .attr('y', -9)
            .attr('font-size', legendTextSize)
            .attr('fill', 'white')
            .attr('text-anchor', 'end')
            .text('Selection Avg.')

        let selectionLineLegend = self.svgGroup.selectAll('.selection_line')
            .data([0])
        selectionLineLegend.enter()
            .append('line')
            .classed('selection_line', true)
            .attr('x1', self.x(1.05))
            .attr('y1', -25)
            .attr('x2', self.x(1.10))
            .attr('y2', -25)
            .attr("stroke-width", 4)
            .attr('stroke', 'orange')

        let selectionLineLabel = self.svgGroup.selectAll('.selection_line_label')
            .data([0])
        selectionLineLabel.enter()
            .append('text')
            .classed('selection_line_label', true)
            .attr('x', self.x(1.1))
            .attr('y', -9)
            .attr('font-size', legendTextSize)
            .attr('fill', 'orange')
            .attr('text-anchor', 'end')
            .text('Selection')
        self.drawAxisLabels();
        // self.drawDots();
        self.drawPaths();

    }

    drawDots() {
        const self = this;
        if (!self.editMode) {
            if (!self.plot) {
                window.devicePixelRatio = 1;
                self.plot = createScatterplot({
                    canvas: self.canvas,
                    pointColor: hexToRGBA('#b2b2b2'),
                    opacityBy: 'density',
                    pointColorActive: hexToRGBA('#ffa500', 0.2),
                    pointConnectionColor: hexToRGBA('#b2b2b2', 0.01),

                    pointSize: 3,
                    showPointConnections: true,
                    lassoColor: hexToRGBA('#ffa500', 0.2),
                    // pointOutlineWidth: 0,
                    // pointSizeSelected: 0
                });
            }
            let fullNeighborhood = _.get(dataLayer, 'allCells.full_neighborhoods', null);
            let indices = _.get(dataLayer, 'allCells.selection_ids', null);
            let points = [];
            _.forEach(fullNeighborhood, (row, rowIndex) => {
                let orderedRow = _.cloneDeep(row);
                self.phenotypes.map((d, i) => {
                    orderedRow[self.order[d]] = row[i]
                })
                if (indices && indices[rowIndex]) {
                    orderedRow.forEach((d, i) => {
                        points.push([((2.0 * self.lineX(d)) / self.canvas.width) - 1,
                            (2.0 * self.lineY(i) / self.canvas.height) - 1, 0, 0, indices[rowIndex]]);
                    })
                } else {
                    orderedRow.forEach((d, i) => {
                        points.push([((2.0 * self.lineX(d)) / self.canvas.width) - 1,
                            (2.0 * self.lineY(i) / self.canvas.height) - 1]);
                    })
                }
            })
            self.plot.draw(points);
        } else {
            self.plot?.clear();
            // self.plot?.destroy();
        }
    }

    drawPaths() {
        const self = this;
        self.svgGroup.select(".average_path")
            .datum(self.visData)
            .classed("average_path", true)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("d", d3.line()
                .x(function (d) {
                    return self.x(d.value);
                })
                .y(function (d) {
                    return self.y(d.key);
                })
            )

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
                return self.x(d.value)
            })
            .attr("cy", d => {
                return self.y(d.key);
            })
            .call(self.drag)
            .on("click", (event, d) => {
                if (event.defaultPrevented) return; // dragged
            })
        handler.exit().remove();

        self.canvas.getContext('2d').clearRect(0, 0, self.canvas.width, self.canvas.height);

        // if (!self.editMode && !self.hideOverall) {
        //     let opacity = 0.003;
        //     let fullNeighborhood = _.get(dataLayer, 'allCells.full_neighborhoods', null);
        //     _.forEach(fullNeighborhood, row => {
        //         const color = `hsla(0,0%,100%,${opacity})`;
        //         self.canvas.getContext('2d').strokeStyle = color;
        //         self.canvas.getContext('2d').beginPath();
        //         let orderedRow = _.cloneDeep(row);
        //         self.phenotypes.map((d, i) => {
        //             orderedRow[self.order[d]] = row[i]
        //         })
        //
        //         orderedRow.map(function (p, i) {
        //             if (i == 0) {
        //                 self.canvas.getContext('2d').moveTo(self.lineX(p), self.lineY(i));
        //             } else {
        //                 self.canvas.getContext('2d').lineTo(self.lineX(p), self.lineY(i));
        //             }
        //         });
        //         self.canvas.getContext('2d').stroke();
        //     })
        // }

        // if (self.selection_neighborhoods && !self.editMode) {
        if (self.selection_neighborhoods) {

            //Draw Selection
            let opacity = 0.01;
            if (_.size(self.selection_neighborhoods) < 1000) {
                opacity = 0.05;
            }
            _.forEach(self.selection_neighborhoods, row => {
                if (Math.random() > 0.75) {
                    const color = `hsla(39, 100%, 50%,${opacity})`;
                    self.canvas.getContext('2d').strokeStyle = color;
                    self.canvas.getContext('2d').beginPath();
                    let orderedRow = _.cloneDeep(row);
                    self.phenotypes.map((d, i) => {
                        orderedRow[self.order[d]] = row[i]
                    })
                    orderedRow.map(function (p, i) {
                        if (i == 0) {
                            self.canvas.getContext('2d').moveTo(self.lineX(p), self.lineY(i));
                        } else {
                            self.canvas.getContext('2d').lineTo(self.lineX(p), self.lineY(i));
                        }
                    });
                    self.canvas.getContext('2d').stroke();
                }
            })
        } else {
            self.svgGroup.selectAll(".average_path")
                .attr("stroke-width", 2)
        }
    }


    /*
    add a slider
    @data the min and max range of the slider
    @activeRange the predefined values for the lower and upper handle
    @name the name of the slider (used as part of the id)
    @swidth the pixel width of the slider
     */
    addSlider(name) {

        const self = this;
        //add range slider row content
        let value = _.find(self.visData, d => {
            return d.key === name;
        })
        let width = self.x(1) - self.x(0);
        let sliderSimple = d3.sliderBottom()
            .min(0.0)
            .max(1.0)
            .width(width)//.tickFormat(d3.format("s"))
            .fill('orange')
            .ticks(5)
            .displayValue(false)
            .default(value.value)
            .handle(
                d3.symbol()
                    .type(d3.symbolCircle)
                    .size(150)
            )
            .tickValues([])
        this.sliders.set(name, sliderSimple);
        //create the slider svg and call the slider
        let gSimple = self.svgGroup
            .append('g')
            .attr('class', 'hidden value-slider-group')
            .attr('transform', () => {
                return `translate(8,${self.y(name)})`
            });
        gSimple.call(sliderSimple);

        d3.selectAll('.track, .track-inset')
            .attr('opacity', 0.3)


        return sliderSimple;
    };

    drawAxisLabels() {
        const self = this;
        let labels = self.svgGroup.selectAll('.par_cor_label')
            .data(self.visData)
        labels.enter()
            // Add axis title
            .append("text")
            .merge(labels)
            .style("text-anchor", "end")
            .style('cursor', 'pointer')
            .attr("y", (d, index) => {
                let position = self.y(d.key) + 3;
                self.labelPositions[d.index] = position;
                return position
            })
            .attr("x", -5)
            .text(function (d) {
                return d.key;
            })
            .classed("par_cor_label", true)
            .style("fill", d => {
                return self.colorScheme.colorMap[d.key].hex;
            })
            .attr('fill-opacity', d => {
                if (d.disabled) {
                    return 0.3;
                } else {
                    return 1;
                }
            })
            .call(self.dragHandler)
        // .on('click', self.enableOrDisablePhenotype.bind(self));

        labels.exit().remove()
    }

    switchEditMode() {
        const self = this;
        console.log('switching')
        self.editMode = !self.editMode;
        self.draw();
        // self.svgGroup.selectAll(".value-slider-group")
        //     .classed("hidden", !self.editMode)
        //     .classed("visible", self.editMode)
        if (self.editMode) {
            // self.svgGroup.selectAll(".average_path")
            //     .attr("stroke-width", 0)
            self.svgGroup.selectAll(".average_path")
                .attr("stroke-width", 2)
            document.getElementById('neighborhood_current_selection').innerText = "Composition";
        }
        _.each(document.querySelectorAll('.handler'), elem => {
            if (self.editMode) {
                elem.style.cursor = 'move';
            } else {
                elem.style.cursor = 'default';
            }
        })
        //
        // _.each(document.querySelectorAll('.viewfinder_chart_label_g_g_text_g'), elem => {
        //     if (self.editMode) {
        //         elem.style.cursor = 'pointer';
        //     } else {
        //         elem.style.cursor = 'default';
        //     }
        // })
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
        // let total = 0;
        // self.sliders.forEach(d => {
        //     total += d.value();
        // })
        // self.sliders.forEach((d, name) => {
        //     let newVal = d.value() / total;
        //     self.visData[self.visData.findIndex(d => d.key == name)].value = newVal;
        //     d.value(newVal);
        // })

        self.draw();
        // seaDragonViewer.showLoader();
        let sim = document.getElementById('similarity_val').innerHTML || '0.8';
        let simVal = parseFloat(sim);
        return dataLayer.findSimilarNeighborhoods(_.keyBy(self.visData, 'key'), simVal)
            .then(cells => {
                self.switchEditMode();
                self.eventHandler.trigger(ImageViewer.events.displayNeighborhoodSelection, cells);
            })
    }

    dragging(self, d, e) {
        // This handles when the line is directly vertical, as both x and y can be used to solve for the value
        let newVal = self.x.invert(e.x);
        self.visData[d.index].value = newVal;
        self.visData[d.index].disabled = false;
        self.draw(true);
    }


    hide() {
        const self = this;
    }

}

ParallelCoordinates.events = {
    selectPhenotype: 'selectPhenotype'
};

function path(d, ctx) {

};

