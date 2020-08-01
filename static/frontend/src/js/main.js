/**

 */
//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;


//VIEWS
let seaDragonViewer;
let channelList;
let dataFilter;
let cellInformation;
let colorScheme;
let dataSrcIndex = 0; // dataset id
let k = 3;
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)

//Disable right clicking on element
document.getElementById("openseadragon").addEventListener('contextmenu', event => event.preventDefault());


//LOAD DATA
let time = performance.now()
// console.log('loading config');
// Data prevent caching on the config file, as it may have been modified
d3.json(`/static/data/config.json?t=${Date.now()}`).then(function (config) {
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    // console.log('loading data');
    this.config = config;
    init(config[datasource]);
});


// init all views (datatable, seadragon viewer,...)
<<<<<<< HEAD
function init(conf) {
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    // console.log('initialize system');

=======
async function init(conf) {
    time = performance.now();
    console.log('initialize system');
>>>>>>> 891450404bb7b7a4cbfc5de5475020da255ef711
    config = conf;
    //channel information
    for (var idx = 0; idx < config["imageData"].length; idx = idx + 1) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA FILTER
<<<<<<< HEAD
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    dataFilter = new DataFilter(config, imageChannels);
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
=======
    time = performance.now();
    dataFilter = new DataFilter(config, imageChannels);
    await dataFilter.init();
    console.log("Data Loaded");
>>>>>>> 891450404bb7b7a4cbfc5de5475020da255ef711
    channelList = new ChannelList(config, dataFilter, eventHandler);
    await channelList.init();
    colorScheme = new ColorScheme(dataFilter);
    await colorScheme.init();
    cellInformation = new CellInformation(dataFilter);
    cellInformation.draw();

    //IMAGE VIEWER
    // console.log(`Time:${performance.now() - time}`)
    time = performance.now();
<<<<<<< HEAD
    seaDragonViewer = new ImageViewer(config, dataFilter, eventHandler);
    // console.log(`Time:${performance.now() - time}`)
=======
    seaDragonViewer = new ImageViewer(config, dataFilter, eventHandler, colorScheme);
    console.log(`Time:${performance.now() - time}`)
>>>>>>> 891450404bb7b7a4cbfc5de5475020da255ef711
    time = performance.now();
    seaDragonViewer.init();
    // console.log(`Time:${performance.now() - time}`)
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
    // console.log('actionImageClick3edMultSel');
    d3.select('body').style('cursor', 'progress');
    // add newly clicked item to selection
<<<<<<< HEAD

    // console.log('add to selection');
=======
    console.log('add to selection');
>>>>>>> 891450404bb7b7a4cbfc5de5475020da255ef711
    if (!Array.isArray(d.selectedItem)) {
        dataFilter.addToCurrentSelection(d.selectedItem, true, d.clearPriors);
    } else {
        // console.log(d.selectedItem.length);
        dataFilter.addAllToCurrentSelection(d.selectedItem);
    }
    cellInformation.selectCell(d.selectedItem);
    updateSeaDragonSelection();
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

const computeCellNeighborhood = async ({distance, selectedCell}) => {
    let neighborhood = await dataFilter.getNeighborhood(distance, selectedCell);
    displayNeighborhood(selectedCell, neighborhood);
}
eventHandler.bind(CellInformation.events.computeNeighborhood, computeCellNeighborhood);


//current fast solution for seadragon updates
function updateSeaDragonSelection() {
    let selection = dataFilter.getCurrentSelection();
    var arr = Array.from(selection);
    var selectionHashMap = new Map(arr.map(i => ['' + (i.id), i]));
    // This is the neighborhood viewer, uncomment to show cell info on click
    // if (_.size(selection) == 0){
    //     document.getElementById("cell_wrapper").style.display = "none";
    // } else{
    //     document.getElementById("cell_wrapper").style.display = "block";
    // }
    seaDragonViewer.updateSelection(selectionHashMap);
}


<<<<<<< HEAD
// function findCellById(cellId) {
//     let intCelId = _.toInteger(cellId);
//     let cell = dataFilter.getData()[intCelId];
//
//     if (getCellId(cell) != intCelId) {
//         // console.log("Indices do not match IDs, falling back on manual find")
//         cell = _.find(dataFilter.getData(), elem => {
//             return getCellId(elem) == intCelId
//         });
//     }
//     // console.log("Final Found Cell", cellId, getCellId(cell));
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
=======
function displayNeighborhood(selectedCell, neighborhood) {
    dataFilter.addToCurrentSelection(selectedCell, true, true);
    _.each(neighborhood, neighbor => {
        dataFilter.addToCurrentSelection(neighbor, true, false);
    });
    updateSeaDragonSelection();
}
>>>>>>> 891450404bb7b7a4cbfc5de5475020da255ef711
