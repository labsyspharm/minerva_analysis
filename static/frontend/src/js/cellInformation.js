class CellInformation {
    constructor(dataFilter) {
        this.svg = d3.select("#cell_legend");
        this.phenotypes = dataFilter.getPhenotypes();
        this.draw();
    }

    draw() {
        const size = 10;
        let docHeight = 20 + _.size(this.phenotypes) * (size + 5);
        document.getElementById('cell_legend').setAttribute("height", `${docHeight}px`);

        this.svg.selectAll(".myrects")
            .data(this.phenotypes)
            .enter()
            .append("rect")
            .attr("class", "myrects")
            .attr("x", 0)
            .attr("y", function (d, i) {
                return 10 + i * (size + 5)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .attr("width", size)
            .attr("height", size)
            .style("fill", function (d) {
                let color = colorScheme.getPhenotypeColorHex(d);
                return `#${color}`
            })

        this.svg.selectAll(".mylabels")
            .data(this.phenotypes)
            .enter()
            .append("text")
            .attr("class", "mylabels")
            .attr("x", 0 + size * 1.2)
            .attr("y", function (d, i) {
                return 10 + i * (size + 5) + (size / 2)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .style("fill", function (d) {
                let color = colorScheme.getPhenotypeColorHex(d);
                return `#${color}`
            })
            .text(d => {
                if (d == "") {
                    return "No Phenotype";
                }
                return d;
            })
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")
    }
}
