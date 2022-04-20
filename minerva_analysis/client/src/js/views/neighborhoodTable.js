class NeighborhoodTable {
    constructor(dataLayer, eventHandler) {
        this.dataLayer = dataLayer;
        this.eventHandler = eventHandler;
        this.table = document.getElementById('neighborhood_table').getElementsByTagName('tbody')[0];

        this.selectedRow = null;
        this.selectedRowName = null;
        this.neighborhoods = null;
        this.enabled = false;
        this.saveButton = document.getElementById('save_neighborhood_icon');
        this.saveButton.addEventListener('click', this.saveNeighborhood.bind(this));
    }

    async init() {
        const self = this;
        this.neighborhoods = await this.dataLayer.getNeighborhoods();
        this.neighborhoods = _.map(this.neighborhoods, (d, i) => {
            d.push(i);
            return d;
        })
        return self.drawRows();
    }


    enableSaveButton() {
        const self = this;
        self.enabled = true;
        self.saveButton.disabled = false;
    }

    disableSaveButton() {
        const self = this;
        self.enabled = false;
        self.saveButton.disabled = true;
    }

    drawRows(newRows = null) {
        const self = this;
        if (newRows) {
            self.neighborhoods = newRows;
        }
        let rows = d3.select(self.table).selectAll(".neighborhood-row")
            .data(self.neighborhoods, d => d[0])
        rows.enter()
            .append("tr")
            .attr('class', 'neighborhood-row justify-content-between')
            .on('click', (e, d) => {
                return self.selectRow(e, d);
            });
        rows.exit().remove();

        // let idCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.id-col')
        //     .data(d => {
        //         return [d];
        //     });
        //
        // idCol.enter()
        //     .append('th')
        //     .attr('scope', 'row')
        //     .attr('class', 'id-col')
        //     .append('span')
        //     .text(d => {
        //         return _.toString(d[1])
        //     });
        //
        // idCol.exit().remove();


        //
        let nameCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.name-col')
            .data(d => {
                return [d];
            });

        let enteredCol = nameCol.enter()
            .append('td')
            .attr('class', 'name-col col-8');
        enteredCol
            .append('div')
            .attr('class', 'row')
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
            });
        // enteredCol.append('div')
        //     .attr('id', d => {
        //         return `compare_parallel_coordinates_${d[4]}`
        //     })
        //     .attr('class', 'row compare_plot_body')
        // .append('canvas')
        // .attr('id', d => {
        //     return `compare_col_canvas_${d[4]}`;
        // })
        // .attr('class', 'scatterplot scatter_canvas')


        nameCol.exit().remove();


        // let sourceCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.source-col')
        //     .data(d => {
        //         return [d];
        //     });
        // sourceCol.enter()
        //     .append('td')
        //     .attr('class', 'source-col')
        //     .append('span')
        //     .text(d => d[3]);
        // sourceCol.exit().remove();

        let actionsCol = d3.select(self.table).selectAll('.neighborhood-row').selectAll('.actions-column')
            .data(d => {
                return [d];
            });

        actionsCol.enter()
            .append('td')
            .attr('class', 'actions-column col-4')
            .append('div')
            .attr('class', 'row actions-row justify-content-end')
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
        self.eventHandler.trigger(NeighborhoodTable.events.updateSavedNeighborhoods, null);
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

    updateNeighborhoods(neighborhoods) {
        const self = this;
        self.neighborhoods = neighborhoods;
        if ($(self.table).is(':hidden')) {
            document.getElementById('neighborhood_dropdown_button').click();
        }
        self.drawRows();

    }

    async saveNeighborhood(e) {
        const self = this;
        if (self.enabled) { // Disable
            self.disableSaveButton();
            self.neighborhoods = await self.dataLayer.saveNeighborhood();
            // If the table is hidden, show it
            if ($(self.table).is(':hidden')) {
                showHideRHS();
            }

            self.drawRows();

            let lastRow = self.table.querySelector('.neighborhood-row:last-child');
            // lastRow.scrollIntoView();
            lastRow.click();
            lastRow.querySelector('.neighborhood_icon_col').click();
        }
    }

    selectRow(e, d) {
        const self = this;
        let elem = findElementWithTag(e, "TR");
        // Clicking on already selected row
        if (self.selectedRow && elem != self.selectedRow) {
            self.selectedRow.classList.remove("table-darker");
            if (self.selectedRowName) {
                self.selectedRowName.setAttribute('contenteditable', false);
                self.selectedRowName = null;
            }
        }
        if (self.selectedRow != elem) {
            self.eventHandler.trigger(NeighborhoodTable.events.selectNeighborhood, d);
        }
        self.selectedRow = elem;
        // Update Class To Highlight Row
        if (elem) {
            elem.classList.add("table-darker");
        }
    }
}

NeighborhoodTable.events = {
    selectNeighborhood: 'selectNeighborhood',
    updateSavedNeighborhoods: 'updateSavedNeighborhoods'
};

function

findElementWithTag(e, tag) {
    let i = 0;
    let elem = e.path[i]
    while (elem.tagName !== tag && elem) {
        i++;
        elem = e.path[i];
    }
    return elem;
}