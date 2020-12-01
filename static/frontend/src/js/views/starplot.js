class Starplot {
    constructor(id, colorScheme) {
        this.id = id;
        this.parent = d3.select(`#${id}`)
        this.colorScheme = colorScheme;
        this.selector = document.getElementById(id)
    }

    init() {
        this.margin = {top: 40, right: 20, bottom: 60, left: 20},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.svg = d3.select(`#${this.id}`).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .attr("class", "radar" + this.id);

        this.tool_angleScale = d3.scaleLinear()
            .range([0, 2 * Math.PI]);
        this.tool_areaMaker = d3.areaRadial()
            .curve(d3.curveCardinalClosed);

        this.tool_channelScale = d3.scaleLinear()
            .range([Math.PI, -Math.PI]);
        this.tool_nucleusScale = d3.scaleSqrt()
            .domain([0, 200]);
        this.tool_radiusScale = d3.scaleLinear()
            .domain([0, 1]);

        this.config_chartR0 = 15;
        this.config_chartR1 = 65;
// Main chart
        this.el_boxExtG = this.svg.append('g')
            .attr('class', 'viewfinder_box_ext_g');


        // Main chart
        // Append chartG
        this.el_chartG = this.el_boxExtG.append('g')
            .attr('class', 'viewfinder_chart_g')
            .style('transform', `translate(${this.width / 2}px, 
        ${this.height / 2 + this.margin.top}px)`);
        // Lines and labels for the chart
        this.el_chartLabelsG = this.el_chartG.append('g')
            .attr('class', 'viewfinder_chart_label_g');

        // Actual area chart
        this.el_chartAreaPath = this.el_chartG.append('path')
            .attr('class', 'viewfinder_chart_area_path')
            .attr('fill', 'rgba(155, 155, 155, 0.9');


    }

    wrangle(data) {

        this.visData = _.map(data, (v, k) => {
            return {
                key: k,
                short: k,
                value: v
            }
        })
        this.range = [_.minBy(this.visData, elem => elem.value).value,
            _.maxBy(this.visData, elem => elem.value).value]

        this.visData.sort((a, b) => {
            if (a.key.toLowerCase() < b.key.toLowerCase()) return -1;
            if (a.key.toLowerCase() > b.key.toLowerCase()) return 1;
            return 0;
        });
        this.visData.forEach((d, i) => {
            // Add index
            d.index = i;
        })

        // Config
        this.tool_angleScale.domain([0, this.visData.length]);
        this.tool_channelScale.domain([0, this.visData.length]);

        this.tool_radiusScale
            .range([this.config_chartR0, this.config_chartR1])
        this.tool_areaMaker
            .innerRadius(() => this.tool_radiusScale(this.range[0]))
            .outerRadius(d => this.tool_radiusScale(d.value / this.range[1]))
            .angle(d => this.tool_angleScale(d.index));
        return this.draw()
    }

    draw() {
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
            .data(this.visData, d => d.key)
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
                            .attr('font-size', 5)
                            .attr('text-anchor', () => {
                                if (angle >= Math.PI) return `end`;
                                return `start`;
                            })
                            .attr('dominant-baseline', 'middle')
                            .style('transform', () => {
                                if (angle >= Math.PI) return `rotate(${angle + Math.PI / 2}rad)`;
                                return `rotate(${angle - Math.PI / 2}rad)`;
                            })
                            .text(d => {
                                return d.short;
                            });

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
                    }),
                update => update
                    .each(function (d, i) {

                        // Get g
                        const g = d3.select(this);

                        // Label groups
                        g.select('.viewfinder_chart_label_g_g_text_g text')
                            .attr('class', 'viewfinder_chart_label_g_g_text_g')
                            .attr('font-weight', () => {
                                return 'bold'
                            });

                        // Label group
                        g.select('.viewfinder_chart_label_g_g_circle')
                            .attr('fill', 'grey')
                            .attr('stroke', () => {
                                return 'rgba(155, 155, 155)';
                            });

                    }),
                exit => exit
            );

        // Draw path
        this.el_chartAreaPath
            .datum(this.visData)
            .transition()
            .attr('d', d => self.tool_areaMaker(d));
    }

    hide() {

    }

}