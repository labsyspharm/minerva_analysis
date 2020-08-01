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
        let data = _.map(this.phenotypes, phenotype => {
            return {'phenotype': phenotype, 'color': `#${colorScheme.colorMap[phenotype].hex}`};
        })
        document.getElementById('cell_legend').setAttribute("height", `${docHeight}px`);

        let rects = this.svg.selectAll(".myrects")
            .data(data)
        rects.enter()
            .append("rect")
            .attr("class", "myrects")
            .merge(rects)
            .attr("x", 0)
            .attr("y", function (d, i) {
                return 10 + i * (size + 5)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .attr("width", size)
            .attr("height", size)
            .style("fill", d => {
                return d.color;
            })
        rects.exit().remove();

        let labels = this.svg.selectAll(".mylabels")
            .data(data)
        labels.enter()
            .append("text")
            .attr("class", "mylabels")
            .merge(labels)
            .attr("x", 0 + size * 1.2)
            .attr("y", function (d, i) {
                return 10 + i * (size + 5) + (size / 2)
            }) // 100 is where the first dot appears. 25 is the distance between dots
            .style("fill", d => {
                return d.color;
            })
            .text(d => {
                let phenotype = d.phenotype;
                if (d == "") {
                    return "No Phenotype";
                }
                return phenotype;
            })
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")
        labels.exit().remove();

        if (this.selectedCell) {
            this.fillCellIcon(this.selectedCell.phenotype);
        }
    }

    selectCell(selectedItem) {
        this.selectedCell = selectedItem;
        let phenotype = selectedItem.phenotype;
        this.fillCellIcon(phenotype);
        if (phenotype == '') {
            phenotype = "None";
        }
        document.getElementById("phenotype").textContent = phenotype;
    }

    fillCellIcon(phenotype) {
        let path = _.first(document.getElementById("cell_icon").getElementsByTagName('path'));
        path.setAttribute('style', `fill: #${colorScheme.colorMap[phenotype].hex}`);
    }
}

CellInformation.events = {
    computeNeighborhood: 'computeNeighborhood',
    refreshColors: 'refreshColors'
};