let nameDiv = document.getElementById('name-div');
let fileDiv = document.getElementById('file-div');
let segDiv = document.getElementById('seg-div');
let numRows = 1;

d3.select('#add-dataset-button')
    .on('click', () => {
        numRows++;
        addRow('#name-div', 'name');
        addRow('#file-div', 'channel_file');
        addRow('#seg-div', 'label_file');
        addRow('#csv-file-div', 'csv_file', 'file');
    });

d3.select('#remove-dataset-button')
    .on('click', () => {
        removeRow('#name-div');
        removeRow('#file-div');
        removeRow('#seg-div');
        removeRow('#csv-file-div');
        numRows--;
    });

function addRow(parentSelector, rowId, type = 'text') {

    let row = d3.select(parentSelector)
        .append('div')
        .classed('row', true)
    row.append('div')
        .classed('col-3', true)
    row.append('div')
        .classed('col-auto', true)
        .append('input')
        .attr('type', type)
        .attr('id', `${rowId}-${numRows}`)
        .attr('name', `${rowId}-${numRows}`)
}

function removeRow(parentSelector) {
    if (numRows > 1) {
        d3.select(`${parentSelector} .row:last-child`).remove()
    }

}