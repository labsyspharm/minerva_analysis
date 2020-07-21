/**

 */
//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;


//VIEWS
let seaDragonViewer;
let channelList;
let dataFilter;
let dataSrcIndex = 0; // dataset id
let idCount = 0;
let k = 3;
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)

//Disable right clicking on element
document.getElementById("openseadragon").addEventListener('contextmenu', event => event.preventDefault());

function convertNumbers(row) {
    var r = {};
    r['id'] = idCount + '';
    if (config[datasource]["featureData"]['id'] && config[datasource]["featureData"]['id'] != "none") {
        r['id'] = '' + parseInt(row[config[datasource]["featureData"]['id']] - 1);
    }
    for (var k in row) {
        r[k] = +row[k];
    }
    r['cluster'] = '-';
    idCount++;
    return r;
}


//LOAD DATA
let time = performance.now()
console.log('loading config');
// Data prevent caching on the config file, as it may have been modified
d3.json(`/static/data/config.json?t=${Date.now()}`).then(function (config) {
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    console.log('loading data');
    this.config = config;
    init(config[datasource]);
});


// init all views (datatable, seadragon viewer,...)
function init(conf) {
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    console.log('initialize system');

    config = conf;
    //channel information
    for (var idx = 0; idx < config["imageData"].length; idx = idx + 1) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA FILTER
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    dataFilter = new DataFilter(config, imageChannels);
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    channelList = new ChannelList(config, dataFilter, eventHandler);


    //IMAGE VIEWER
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    seaDragonViewer = new ImageViewer(config, dataFilter, eventHandler);
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    seaDragonViewer.init();
    console.log(`Time:${performance.now() - time}`)
    time = performance.now();

}


//feature color map changed in ridge plot
const actionColorTransferChange = (d) => {

    //map to full name
    d.name = dataFilter.getFullChannelName(d.name);

    d3.select('body').style('cursor', 'progress');
    seaDragonViewer.updateChannelColors(d.name, d.color, d.type);
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ChannelList.events.COLOR_TRANSFER_CHANGE, actionColorTransferChange);

//feature color map changed in ridge plot
const actionRenderingModeChange = (d) => {
    seaDragonViewer.updateRenderingMode(d);
}
eventHandler.bind(ImageViewer.events.renderingMode, actionRenderingModeChange);


//feature color map changed in ridge plot
const actionChannelsToRenderChange = (d) => {
    d3.select('body').style('cursor', 'progress');

    //map to full name
    d.name = dataFilter.getFullChannelName(d.name);

    //send to image viewer
    seaDragonViewer.updateActiveChannels(d.name, d.selections, d.status);

    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ChannelList.events.CHANNELS_CHANGE, actionChannelsToRenderChange);

//image region or single cell selection (may needs to be combined with other selection events)
const actionImageClickedMultiSel = (d) => {
    console.log('actionImageClick3edMultSel');
    d3.select('body').style('cursor', 'progress');
    // add newly clicked item to selection

    console.log('add to selection');
    if (!Array.isArray(d.selectedItem)) {
        dataFilter.addToCurrentSelection(d.selectedItem, true, d.clearPriors);
    } else {
        console.log(d.selectedItem.length);
        dataFilter.addAllToCurrentSelection(d.selectedItem);
    }
    updateSeaDragonSelection();
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

//current fast solution for seadragon updates
function updateSeaDragonSelection() {
    var arr = Array.from(dataFilter.getCurrentSelection())
    var selectionHashMap = new Map(arr.map(i => ['' + (i.id), i]));
    seaDragonViewer.updateSelection(selectionHashMap);
}

function getCellId(cell) {
    return cell.id || cell.CellId;
}

// function findCellById(cellId) {
//     let intCelId = _.toInteger(cellId);
//     let cell = dataFilter.getData()[intCelId];
//
//     if (getCellId(cell) != intCelId) {
//         console.log("Indices do not match IDs, falling back on manual find")
//         cell = _.find(dataFilter.getData(), elem => {
//             return getCellId(elem) == intCelId
//         });
//     }
//     console.log("Final Found Cell", cellId, getCellId(cell));
//     return cell;
// }
//
// function displayCell(cell) {
//     let xCoordinate = config.featureData[0].xCoordinate;
//     let yCoordinate = config.featureData[0].yCoordinate;
//     let viewport = {
//         'x': cell[xCoordinate] - 200,
//         'y': cell[yCoordinate] - 200,
//         'width': 400,
//         'height': 400
//     }
//     seaDragonViewer.actionFocus(viewport);
//     dataFilter.addToCurrentSelection(cell, true, true);
//     updateSeaDragonSelection();
// }
//
// function displayNeighborhood(cellId, neighborhoodIds) {
//     let cell = findCellById(cellId);
//     displayCell(cell);
//     let neighbors = _.map(neighborhoodIds, elem => {
//         return findCellById(elem)
//     });
//     _.each(neighbors, neighbor => {
//         dataFilter.addToCurrentSelection(neighbor, true, false);
//     });
//     updateSeaDragonSelection();
// }
//
