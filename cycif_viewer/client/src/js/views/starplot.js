class Starplot {
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
        this.margin = {top: 0, right: 20, bottom: 60, left: 20},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = d3.select(`#${this.id}`).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .attr("class", "radar" + this.id + " starplot");

        this.tool_angleScale = d3.scaleLinear()
            .range([0, 2 * Math.PI]);
        this.tool_areaMaker = d3.areaRadial()
            .curve(d3.curveCardinalClosed.tension(1))

        this.tool_channelScale = d3.scaleLinear()
            .range([Math.PI, -Math.PI]);

        this.tool_radiusScale = d3.scaleLinear()
            .domain([0, 1]);
        if (this.small) {
            this.config_chartR0 = 5;
            this.config_chartR1 = 40;
        } else {
            this.config_chartR0 = 15;
            this.config_chartR1 = 65;
        }
        // this.tool_logRadiusScale = d3.scaleSymlog()
        this.tool_logRadiusScale = d3.scaleLinear()
            .domain([0, 1])
            .range([this.config_chartR0, this.config_chartR1])

        this.tool_logRadiusScale.clamp(true);
// Main chart
        this.el_boxExtG = this.svg.append('g')
            .attr('class', 'viewfinder_box_ext_g');

        this.editMode = false;

        this.drag = d3.drag(self)
            .on("drag", (e, d) => {
                if (self.editMode) {
                    return self.dragging(self, d, e);
                }
            })


        // Main chart
        // Append chartG
        this.el_chartG = this.el_boxExtG.append('g')
            .attr('class', 'viewfinder_chart_g')
            .style('transform', `translate(${this.width / 2}px, 
        ${this.height / 2 + this.margin.top}px)`);


        // Actual area chart
        this.el_chartAreaPath = this.el_chartG.append('path')
            .attr('class', 'viewfinder_chart_area_path')
            .attr('fill', 'rgba(255, 255, 255, 0')

        // Lines and labels for the chart
        this.el_chartLabelsG = this.el_chartG.append('g')
            .attr('class', 'viewfinder_chart_label_g');
        let i = -1;
        let emptyData = _.keyBy(_.times(_.size(this.phenotypes), _.constant(0)), d => {
            return this.phenotypes[++i];
        })
        return this.wrangle(emptyData);


    }

    wrangle(data, order = null) {
        const self = this;
        if (!order) {
            order = self.phenotypes;
        }

        this.visData = _.map(data, (v, k) => {
            return {
                key: k,
                short: k,
                value: v || 0,
                index: _.indexOf(order, k)
            }
        })
        this.visData = _.filter(this.visData, elem => {
            return elem.index !== -1; // Remove elements not in my order list
        })
        this.visData = _.sortBy(this.visData, ['index']);

        // Config
        this.tool_angleScale.domain([0, this.visData.length]);
        this.tool_channelScale.domain([0, this.visData.length]);

        this.tool_radiusScale
            .range([this.config_chartR0, this.config_chartR1])
        this.tool_areaMaker
            .innerRadius(d => this.tool_logRadiusScale(d.value))
            .outerRadius(d => this.tool_logRadiusScale(d.value))
            .angle(d => this.tool_angleScale(d.index));
        return this.draw()
    }

    draw(custom = false) {
        const self = this;
        // Define this
        /*

        /*
        aux func :: getCoordsTranslation
         */
        function getCoordsTranslation(r, pos) {
            const x = Math.round(r * Math.sin(self.tool_channelScale(pos)));
            const y = Math.round(r * Math.cos(self.tool_channelScale(pos)));
            return [x, y];
        }

        // Draw lines / labels
        this.el_chartLabelsG.selectAll('.viewfinder_chart_label_g_g')
            .data(this.visData)
            .join(
                enter => enter
                    .append('g')
                    .attr('class', 'viewfinder_chart_label_g_g')
                    .each(function (d, i) {
                        // Get g
                        const g = d3.select(this);

                        // Coords
                        const coords = [
                            getCoordsTranslation(self.config_chartR0, i),
                            getCoordsTranslation(self.config_chartR1, i)
                        ];
                        d['coords'] = coords;


                        // Line
                        const labelLine = g.append('path')
                            .attr('class', 'labelLine')
                            .attr('stroke', 'rgba(155, 155, 155, 1)')
                            .attr('stroke-width', 0.5);
                        labelLine.transition()
                            .attr('d', d3.line()(coords));


                        // Label group
                        const textCoords = getCoordsTranslation(self.config_chartR1 + 5, i)
                        const angle = self.tool_angleScale(i);
                        g.append('g')
                            .attr('class', 'viewfinder_chart_label_g_g_text_g')
                            .style('transform',
                                `translate(${textCoords[0]}px, ${textCoords[1]}px)`)
                            .append('text')
                            .attr('fill', 'black')

                            .attr('font', 'sans-serif')
                            .attr('font-size', d => {
                                if (self.small) {
                                    return 5;
                                } else {
                                    return 7;
                                }
                            })
                            .attr('text-anchor', () => {
                                if (angle >= Math.PI) return `end`;
                                return `start`;
                            })
                            .attr('dominant-baseline', 'middle')
                            .style('transform', () => {
                                if (angle >= Math.PI) return `rotate(${angle + Math.PI / 2}rad)`;
                                return `rotate(${angle - Math.PI / 2}rad)`;
                            })
                            .attr('font-weight', () => {
                                if (self.small) {
                                    return 'normal';
                                } else {
                                    return 'bold';
                                }
                            })
                            .text(d => {
                                return d.short;
                            })
                            .on('click', self.enableOrDisablePhenotype.bind(self));

                        // Label group
                        const channelCoords =
                            getCoordsTranslation(self.config_chartR1 + 33, i + 0.05)
                        g.append('circle')
                            .attr('class', 'viewfinder_chart_label_g_g_circle')
                            .attr('r', self.config_channelR)
                            .attr('cx', channelCoords[0])
                            .attr('cy', channelCoords[1])
                            .attr('fill', 'grey')
                            .attr('stroke', () => {
                                return 'rgb(155,155,155)'
                            })
                            .attr('stroke-width', 0.5);

                        let handler = g.append("circle")
                            .classed('handler', true)
                            .style("fill", "rgba(200,200,200,0)")
                            .attr("visibility", "visible")
                            .attr("r", 6)
                            .attr("cx", d => {
                                let x = coords[0][0] + (coords[1][0] - coords[0][0]) / (1 / d.value);
                                return x;
                            })
                            .attr("cy", d => {
                                let y = coords[0][1] + (coords[1][1] - coords[0][1]) / (1 / d.value);
                                return y;
                            })
                            .call(self.drag)
                            .on("click", (event, d) => {
                                if (event.defaultPrevented) return; // dragged
                            })


                    }),
                update => update
                    .each(function (dat, i) {
                        // Get g
                        const g = d3.select(this);
                        const coords = [
                            getCoordsTranslation(self.config_chartR0, i),
                            getCoordsTranslation(self.config_chartR1, i)
                        ];
                        dat['coords'] = coords;
                        g.select('.labelLine')
                            .attr('class', 'labelLine')
                            .attr('d', d3.line()(coords));
                        // Label group
                        const textCoords = getCoordsTranslation(self.config_chartR1 + 5, i)
                        const angle = self.tool_angleScale(i);
                        g.select('.viewfinder_chart_label_g_g_text_g')
                            .attr('class', 'viewfinder_chart_label_g_g_text_g')
                            .style('transform',
                                `translate(${textCoords[0]}px, ${textCoords[1]}px)`)
                            .attr('fill-opacity', d => {
                                if (d.disabled) {
                                    return 0.3;
                                } else {
                                    return 1;
                                }
                            })

                        // Label groups
                        g.select('.viewfinder_chart_label_g_g_text_g text')
                            .attr('class', 'viewfinder_chart_label_g_g_text_g')
                            .style('transform', () => {
                                if (angle >= Math.PI) return `rotate(${angle + Math.PI / 2}rad)`;
                                return `rotate(${angle - Math.PI / 2}rad)`;
                            })
                            .attr('text-anchor', () => {
                                if (angle >= Math.PI) return `end`;
                                return `start`;
                            })
                            .text(d => {
                                return d.short;
                            });

                        g.select('.handler')
                            .attr("cx", d => {
                                let x = coords[0][0] + (coords[1][0] - coords[0][0]) / (1 / d.value);
                                return x;
                            })
                            .attr("cy", d => {
                                let y = coords[0][1] + (coords[1][1] - coords[0][1]) / (1 / d.value);
                                return y;
                            })


                        // Label group
                        g.select('.viewfinder_chart_label_g_g_circle')
                            .attr('fill', 'grey')
                            .attr('stroke', () => {
                                return 'rgba(155, 155, 155)';
                            });


                    }),
                exit => exit
                    .transition()
                    .remove()
            );

        // Draw path
        this.el_chartAreaPath
            .datum(this.visData)
            .transition()
            .attr('d', d => {
                let max = _.maxBy(d, function (o) {
                    return o.value;
                }).value;
                let min = _.minBy(d, function (o) {
                    return o.value;
                }).value;
                // If there are no values, draw a blank path
                if (min == max && min == 0) {
                    return '';
                } else {
                    return self.tool_areaMaker(d);
                }

            })
            .attr('stroke', 'rgba(0,0,0,0.9)');
    }

    dragging(self, d, e) {
        let newCoords = pointOnLineClosestToAnotherPoint(d['coords'][0], d['coords'][1], [e.x, e.y]);
        let newVal;
        // This handles when the line is directly vertical, as both x and y can be used to solve for the value
        if (d['coords'][0][0] == d['coords'][1][0]) {
            newVal = (newCoords[1] - d['coords'][0][1]) / (d['coords'][1][1] - d['coords'][0][1]);
        } else {
            newVal = (newCoords[0] - d['coords'][0][0]) / (d['coords'][1][0] - d['coords'][0][0]);
        }
        self.visData[d.index].value = newVal;
        self.visData[d.index].disabled = false;
        self.draw(true);
    }

    search() {
        const self = this;
        // First we reproportion values to be percentages
        let total = _.sumBy(self.visData, 'value');
        _.each(self.visData, el => {
            el.value = el.value / total;
        })
        self.draw();
        return dataLayer.findSimilarNeighborhoods(_.keyBy(self.visData, 'key'))
            .then(cells => {
                self.eventHandler.trigger(ImageViewer.events.displayNeighborhoodSelection, cells);
            })
    }

    switchEditMode() {
        const self = this;
        self.editMode = !self.editMode;
        if (self.editMode) {
            self.searchCol.style.visibility = "visible";
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

    hide() {
    }

}

// Takes in the starting and ending point of a line and a 3rd point and returns the
// point on the line closest to that line via https://jsfiddle.net/soulwire/UA6H5/
function pointOnLineClosestToAnotherPoint(lineStart, lineEnd, point) {
    var atob = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]];
    var atop = [point[0] - lineStart[0], point[1] - lineStart[1]];
    var len = atob[0] * atob[0] + atob[1] * atob[1];
    var dot = atop[0] * atob[0] + atop[1] * atob[1];
    var t = Math.min(1, Math.max(0, dot / len));
    return [lineStart[0] + atob[0] * t, lineStart[1] + atob[1] * t];
}
