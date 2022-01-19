let nameDiv = document.getElementById('name-div');
let fileDiv = document.getElementById('file-div');
let segDiv = document.getElementById('seg-div');
let numRows = 1;

d3.select('#add-dataset-button')
    .on('click', () => {
        addRow('#name-div', 'name');
        addRow('#file-div', 'channel_file');
        addRow('#seg-div', 'label_file');
    });

d3.select('#remove-dataset-button')
    .on('click', () => {
        removeRow('#name-div');
        removeRow('#file-div');
        removeRow('#seg-div');
    });

function addRow(parentSelector, rowType) {
    numRows++;
    let row = d3.select(parentSelector)
        .append('div')
        .classed('row', true)
    row.append('div')
        .classed('col-3', true)

    row.append('div')
        .classed('col-auto', true)
        .append('input')
        .attr('type', 'text')
        .attr('id', `${rowType}-${numRows}`)
        .attr('name', `${rowType}-${numRows}`)
}

function removeRow(parentSelector) {
    if (numRows > 1) {
        numRows--;
        d3.select(`${parentSelector} .row:last-child`).remove()
    }

}