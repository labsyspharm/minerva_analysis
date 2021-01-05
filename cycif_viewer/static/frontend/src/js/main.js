/**

 */
//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;


//VIEWS
let seaDragonViewer, channelList, starplot, scatterplot, legend, neighborhoodTable;

//SERVICES
let dataLayer, colorScheme;

//INSTANCE VARS
let config;
let dataSrcIndex = 0; // dataset id
let k = 3;
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)
let clusterData;

//Disable right clicking on element
document.getElementById("openseadragon").addEventListener('contextmenu', event => event.preventDefault());


//LOAD DATA
// Data prevent caching on the config file, as it may have been modified
d3.json(`/static/data/config.json?t=${Date.now()}`).then(function (config) {
    this.config = config;
    return init(config[datasource])
});


// init all views (datatable, seadragon viewer,...)
async function init(conf) {
    config = conf;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA LAYER
    dataLayer = new DataLayer(config, imageChannels);
    await dataLayer.init();

    channelList = new ChannelList(config, dataLayer, eventHandler);
    await channelList.init();
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();

    neighborhoodTable = new NeighborhoodTable(dataLayer, eventHandler);
    await neighborhoodTable.init();


    legend = new Legend(dataLayer.phenotypes, colorScheme);
    legend.draw();

    //IMAGE VIEWER
    seaDragonViewer = new ImageViewer(config, dataLayer, eventHandler, colorScheme);
    seaDragonViewer.init();

    starplot = new Starplot('starplot_display', colorScheme);
    starplot.init();
    clusterData = dataLayer.getClusterCells();

    scatterplot = new Scatterplot('scatterplot_display', eventHandler, dataLayer);
    let scatterplotData = dataLayer.getScatterplotData();
    await scatterplot.init(scatterplotData);

}

//feature color map changed in ridge plot
const actionColorTransferChange = (d) => {

    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);

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
    d.name = dataLayer.getFullChannelName(d.name);

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
    // console.log('add to selection');
    if (!Array.isArray(d.selectedItem)) {
        dataLayer.addToCurrentSelection(d.selectedItem, true, d.clearPriors);
    } else {
        // console.log(d.selectedItem.length);
        dataLayer.addAllToCurrentSelection({'cells': d.selectedItem});
    }
    // cellInformation.selectCell(d.selectedItem);
    updateSeaDragonSelection(true, true);
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

//image region or single cell selection (may needs to be combined with other selection events)
const selectCluster = async (cluster) => {
    console.log('selecting Cluster');
    if (cluster) {
        let selectedCluster = _.get(clusterData, `[${cluster}]`);
        dataLayer.addAllToCurrentSelection(selectedCluster)
        let starplotData = _.get(selectedCluster, 'cluster_summary.weighted_contribution', []);
        starplot.wrangle(starplotData);


    } else {
        starplot.hide();
        dataLayer.clearCurrentSelection();
    }
    updateSeaDragonSelection(false, false);
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(Scatterplot.events.selectCluster, selectCluster);

const displaySelection = async (selection) => {
    dataLayer.addAllToCurrentSelection(selection);
    let starplotData = _.get(selection, 'cluster_summary.weighted_contribution', []);
    starplot.wrangle(starplotData);
    scatterplot.recolor(cluster = null, ids = selection.cells);
    updateSeaDragonSelection(false, false);
}
eventHandler.bind(ImageViewer.events.displaySelection, displaySelection);

const displayNeighborhoodSelection = async (selection) => {
    dataLayer.addAllToCurrentSelection(selection);
    let starplotData = _.get(selection, 'cluster_summary.weighted_contribution', []);
    starplot.wrangle(starplotData);
    scatterplot.recolor(cluster = null, ids = selection.cells);
    updateSeaDragonSelection(false, false);
}
eventHandler.bind(ImageViewer.events.displayNeighborhoodSelection, displayNeighborhoodSelection);

const selectNeighborhood = async (d) => {
    let selection = await dataLayer.getNeighborhood(d[0]);
    dataLayer.addAllToCurrentSelection(selection);
    let starplotData = _.get(selection, 'cluster_summary.weighted_contribution', []);
    starplot.wrangle(starplotData);
    scatterplot.recolor(cluster = null, ids = selection.cells);
    updateSeaDragonSelection(false, false);
}
eventHandler.bind(NeighborhoodTable.events.selectNeighborhood, selectNeighborhood)

// const computeCellNeighborhood = async ({distance, selectedCell}) => {
//     let neighborhood = await dataLayer.getIndividualNeighborhood(distance, selectedCell);
//     displayNeighborhood(selectedCell, neighborhood);
// }
// eventHandler.bind(CellInformation.events.computeNeighborhood, computeCellNeighborhood);

// const drawNeighborhoodRadius = async ({distance, selectedCell, dragging}) => {
//     seaDragonViewer.drawCellRadius(distance, selectedCell, dragging);
// }
// eventHandler.bind(CellInformation.events.drawNeighborhoodRadius, drawNeighborhoodRadius);

// const refreshColors = async () => {
//     await colorScheme.refreshColorScheme(true);
//     // cellInformation.draw();
//     updateSeaDragonSelection(true);
// }
// eventHandler.bind(CellInformation.events.refreshColors, refreshColors);

// For channel select click event
const channelSelect = async (sels) => {

    let channelCells = await dataLayer.getChannelCellIds(sels);

    dataLayer.addAllToCurrentSelection({'cells': channelCells});

    updateSeaDragonSelection(true, false);
}
eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);


//current fast solution for seadragon updates
function updateSeaDragonSelection(showCellInfoPanel = false, repaint = true) {
    let selection = dataLayer.getCurrentSelection();
    let arr = Array.from(selection);
    let selectionHashMap = new Map(arr.map(i => ['' + (i.id), i]));
    neighborhoodTable.enableSaveButton();
    seaDragonViewer.updateSelection(selectionHashMap);
    seaDragonViewer.updateSelection(selectionHashMap, repaint);
}

//feature range selection changed in ridge plot
const actionFeatureGatingChange = (d) => {
    // console.log("gating event received");
    seaDragonViewer.updateChannelRange(dataLayer.getFullChannelName(d.name), d.dataRange[0], d.dataRange[1]);
    // console.log("gating event executed");
}
eventHandler.bind(ChannelList.events.BRUSH_END, actionFeatureGatingChange);


function displayNeighborhood(selectedCell, neighborhood) {
    dataLayer.addAllToCurrentSelection({'cells': neighborhood});
    dataLayer.addToCurrentSelection(selectedCell, false, false);
    updateSeaDragonSelection(true, true);
}


