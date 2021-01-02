class NeighborhoodTable {
    constructor(dataLayer) {
        this.dataLayer = dataLayer;
        this.table = d3.select('#neighborhood_table')
    }

    async drawRows() {
        const self = this;
        let neighborhoods = await self.dataLayer.getNeighborhoods();
        let rows = self.table.select('tbody').selectAll(".neighborhood-row")
            .data(neighborhoods)

        let cells = rows.enter()
            .append("tr")
            .merge(rows)
            .attr('class', 'neighborhood-row')

        cells.append('th')
            .attr('scope', 'row')
            .text(d => {
                return _.toString(d[0]);
            })
        cells.append('td')
            .text(d => {
                return _.toString(d[1])
            })

        cells.append('td')
            .text(d => {
                if (d[2]) {
                    return 'Cluster';
                } else {
                    return 'User Generated';
                }
            });
        let lastCol = cells.append('td')
            .attr('class', 'actions-column')
        lastCol.append('span')
            .attr('class', 'fas fa-pencil-alt neighborhood-table-icon')
        lastCol.append('span')
            .attr('class', 'fas fa-trash neighborhood-table-icon')
        lastCol.append('span')
            .attr('class', 'fas fa-save neighborhood-table-icon')



    }
}