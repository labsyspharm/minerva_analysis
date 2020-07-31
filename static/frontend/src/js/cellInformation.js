class CellInformation {
    constructor(dataFilter) {
        this.svg = d3.select("#cell_legend");
        this.phenotypes = dataFilter.phenotypes;
        this.draw();
        this.selectedCell = null;
        let slider = document.getElementById("formControlRange");
        let value = document.getElementById("distance");
        let neighborhoodButton = document.getElementById("compute_neighborhood_button");
        value.textContent = slider.value;
        slider.oninput = function () {
            value.textContent = this.value;
        }
        neighborhoodButton.onclick = function () {
            eventHandler.trigger(CellInformation.events.computeNeighborhood, {
                'distance': slider.value,
                'selectedCell': cellInformation.selectedCell
            });
        }

        let refreshColorsButton = document.getElementById("refresh_colors");
        refreshColorsButton.onclick = function () {
            eventHandler.trigger(CellInformation.events.refreshColors, {});
        }


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
                let color = colorScheme.colorMap[d].hex;
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
                let color = colorScheme.colorMap[d].hex;
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

    selectCell(selectedItem) {
        this.selectedCell = selectedItem;
        let phenotype = selectedItem.phenotype;
        let path = _.first(document.getElementById("cell_icon").getElementsByTagName('path'));
        path.setAttribute('style', `fill: #${colorScheme.colorMap[phenotype].hex}`);
        if (phenotype == '') {
            phenotype = "None";
        }
        document.getElementById("phenotype").textContent = phenotype;
    }
}

CellInformation.events = {
    computeNeighborhood: 'computeNeighborhood',
    refreshColors: 'refreshColors'
};