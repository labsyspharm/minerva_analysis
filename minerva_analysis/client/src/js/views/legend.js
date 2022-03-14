class Legend {
    constructor(dataLayer, colorScheme, eventHandler) {
        this.parentSelector = "legend";
        this.dataLayer = dataLayer;
        this.colorScheme = colorScheme;
        this.eventHandler = eventHandler;


    }

    init() {
        const self = this;
        let docHeight = 20 + _.size(this.dataLayer.phenotypes) * (15.125);
        docHeight = _.toString(_.toInteger(docHeight));

        self.svg = d3.select(`#${this.parentSelector}`)
            .append("svg")
            .attr("width", '165px')
            .attr("height", docHeight + 'px')
            .attr("id", "legend-svg");

        document.getElementById(this.parentSelector).style.height = docHeight + 'px';
        const size = 14;
        let colorMap = this.colorScheme.colorMap;
        let data = _.map(this.dataLayer.phenotypes, phenotype => {
            return {'phenotype': phenotype, 'color': `${colorMap[phenotype].hex}`};
        })
        // document.getElementById(this.parentSelector).setAttribute("height", `${docHeight}px`);
        // document.getElementById('legend-svg').setAttribute("height", `${docHeight}px`);
        this.svg.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", "black")
            .attr("opacity", 0.75)
        this.svg.append("text")
            .text("Phenotypes")
            .attr("class", "legend-title")
            .attr("x", 3)
            .attr("y", 10)
            .attr("font-size", "0.85rem")
            .attr('fill', 'white')


        let rects = this.svg.selectAll(".myrects")
            .data(data)
        rects.enter()
            .append("rect")
            .attr("class", "myrects")
            .merge(rects)
            .attr("x", 3)
            .attr("y", function (d, i) {
                return 15 + i * (size + 1)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .attr("width", size)
            .attr("height", size)
            .style("fill", d => {
                return d.color;
            })
            .on("click", (e, d) => {
                self.selectPhenotype(d);
            })
        rects.exit().remove();

        let labels = this.svg.selectAll(".mylabels")
            .data(data)
        labels.enter()
            .append("text")
            .attr("class", "mylabels")
            .merge(labels)
            .attr("x", 3 + size * 1.2)
            .attr("y", function (d, i) {
                return 15 + i * (size + 1) + (size / 2)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .style("fill", "white")
            .text(d => {
                let phenotype = d.phenotype;
                if (phenotype == "") {
                    return "No Phenotype";
                }
                return phenotype;
            })
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")
            .on("click", (e, d) => {
                self.selectPhenotype(d);
            })
        labels.exit().remove();

        // if (this.selectedCell) {
        //     this.fillCellIcon(this.selectedCell.phenotype);
        // }
    }

    selectPhenotype(d) {
        this.eventHandler.trigger(Legend.events.selectPhenotype, d.phenotype);
    }
}

Legend.events = {
    selectPhenotype: 'selectPhenotype'
};