class NeighborhoodTable {
    constructor(dataLayer, eventHandler) {
        this.dataLayer = dataLayer;
        this.eventHandler = eventHandler;
        this.table = document.getElementById('neighborhood_table');
        this.selectedRow = null;
        this.selectedRowName = null;
        this.neighborhoods = null;
        this.saveButton = document.getElementById('save_neighborhood');

    }

    async init() {
        const self = this;
        this.neighborhoods = await this.dataLayer.getNeighborhoods();
        return self.drawRows();
    }

    enableSaveButton() {
        const self = this;
        self.saveButton.href = "#";
        self.saveButton.addEventListener('click', self.saveNeighborhood.bind(self));
    }

    disableSaveButton() {
        const self = this;
        self.saveButton.href = null;
    }

    drawRows() {
        const self = this;
        let rows = d3.select(self.table).selectAll(".neighborhood-row")
            .data(self.neighborhoods)
        rows.enter()
            .append("tr")
            .attr('class', 'neighborhood-row')
            .on('click', (e, d) => {
                return self.selectRow(e, d);
            })
        rows.exit().remove();

        let idCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.id-col')
            .data(d => {
                return [d];
            })
        console.log('idcol:', idCol)

        idCol.enter()
            .append('th')
            .attr('scope', 'row')
            .attr('class', 'id-col')
            .append('span')
            .text(d => {
                return _.toString(d[1])
            })

        idCol.exit().remove();


        //
        let nameCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.name-col')
            .data(d => {
                return [d];
            })

        nameCol.enter()
            .append('td')
            .attr('class', 'name-col')
            .append('span')
            .text(d => {
                return _.toString(d[2])
            })
            .on('keydown', (e, d) => {
                if (e.code == 'Enter') {
                    if (!self.selectedRowName) {
                        self.selectedRowName = e.path[0];
                    }
                    let newName = self.selectedRowName.innerText;
                    self.selectedRowName.blur()
                    console.log('Saving');
                    e.preventDefault();
                    self.selectedRowName.setAttribute('contenteditable', false);
                    self.selectedRowName = null;
                    return self.editNeighborhood(d, newName);
                }
            })
        nameCol.exit().remove();

        let sourceCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.source-col')
            .data(d => {
                return [d];
            });
        sourceCol.enter()
            .append('td')
            .attr('class', 'source-col')
            .append('span')
            .text(d => {
                if (d[3]) {
                    return 'Cluster';
                } else {
                    return 'User Generated';
                }
            });
        sourceCol.exit().remove();

        let actionsCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.actions-column')
            .data(d => {
                return [d];
            });

        actionsCol.enter()
            .append('td')
            .attr('class', 'actions-column')
            .append('div')
            .attr('class', 'row actions-row')
            .datum(d => d)
        actionsCol.exit().remove();

        let editIcon = d3.select(self.table).selectAll('.actions-row').selectAll('.neighborhood_icon_col')
            .data(d => {
                return [d];
            });

        editIcon.enter()
            .append('div')
            .attr('class', 'col-sm-auto neighborhood_icon_col')
            .on('click', (e, d) => {
                let row = findElementWithTag(e, "TR");
                if (!row) {
                    return;
                }
                let name = row.querySelector('.name-col span');
                if (!name) {
                    return;
                }
                name.setAttribute('contenteditable', true);
                name.focus();
                self.selectedRowName = name;
            })
            .append('span')
            .attr('class', 'fas fa-pencil-alt edit_neighborhood neighborhood-table-icon');
        editIcon.exit().remove();

        let trashIcon = d3.select(self.table).selectAll('.actions-row').selectAll('.delete_neighborhood_col')
            .data(d => {
                return [d];
            });
        trashIcon.enter()
            .append('div')
            .attr('class', 'col-sm-auto neighborhood_icon_col delete_neighborhood_col')
            .on('click', (e, d) => {
                if (confirm('Are you sure you want to delete this neighborhood?')) {
                    console.log('deleting', d);
                    return self.deleteNeighborhood(d);
                }
            })
            .append('span')
            .attr('class', 'fas fa-trash delete_neighborhood neighborhood-table-icon');

        trashIcon.exit().remove();


        //


    }

    async editNeighborhood(d, newName) {
        const self = this;
        self.neighborhoods = await self.dataLayer.editNeighborhood(d[0], 'name', newName);
        self.drawRows()
        self.selectedRow.click();
    }

    async deleteNeighborhood(d) {
        const self = this;
        self.neighborhoods = await self.dataLayer.deleteNeighborhood(d[0]);
        return self.drawRows();
    }

    async saveNeighborhood() {
        const self = this;
        self.neighborhoods = await self.dataLayer.saveNeighborhood();
        // If the table is hidden, show it
        if ($(self.table).is(':hidden')) {
            document.getElementById('neighborhood_dropdown_button').click();
        }
        self.drawRows();

        let lastRow = self.table.querySelector('.neighborhood-row:last-child');
        lastRow.click();
        lastRow.querySelector('.neighborhood_icon_col').click();
        self.disableSaveButton();
    }

    selectRow(e, d) {
        const self = this;
        let elem = findElementWithTag(e, "TR");
        // Clicking on already selected row
        if (self.selectedRow && elem != self.selectedRow) {
            self.selectedRow.classList.remove("table-dark");
            if (self.selectedRowName) {
                self.selectedRowName.setAttribute('contenteditable', false);
                self.selectedRowName = null;
            }
            self.eventHandler.trigger(NeighborhoodTable.events.selectNeighborhood, d);


        }
        self.selectedRow = elem;
        // Update Class To Highlight Row
        if (elem) {
            elem.classList.add("table-dark");
        }
    }
}

NeighborhoodTable.events = {
    selectNeighborhood: 'selectNeighborhood'
};

function findElementWithTag(e, tag) {
    let i = 0;
    let elem = e.path[i]
    while (elem.tagName !== tag && elem) {
        i++;
        elem = e.path[i];
    }
    return elem;
}