/**

 */
//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;



//VIEWS
let seaDragonViewer;
let channelList;
let dataLayer;
let config;
let pluginToolsExt;
let colorScheme;
let dataSrcIndex = 0; // dataset id
let k = 3;
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)

//Disable right clicking on element
document.getElementById("openseadragon").addEventListener('contextmenu', event => event.preventDefault());


//LOAD DATA
// console.log('loading config');
// Data prevent caching on the config file, as it may have been modified
//d3.json(`/data/config.json?t=${Date.now()}`).then(function (config) {
d3.json(`/config?t=${Date.now()}`).then(function (config) {
    this.config = config;
    return init(config[datasource])
});


// init all views (datatable, seadragon viewer,...)
async function init(conf) {

    // console.log('initialize system');
    config = conf;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA FILTER
    dataLayer = new DataLayer(config, imageChannels);
    await dataLayer.init();
    // console.log("Data Loaded");
    channelList = new ChannelList(config, dataLayer, eventHandler);
    await channelList.init();
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();
    //IMAGE VIEWER
    seaDragonViewer = new ImageViewer(config, dataLayer, eventHandler, colorScheme);
    seaDragonViewer.init();

    // Plugin toolbox
    pluginToolsExt = new PluginToolsExt();
}

//feature color map changed in ridge plot
const actionColorTransferChange = (d) => {

    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);
    // d3.select('body').style('cursor', 'progress');
    seaDragonViewer.updateChannelColors(d.name, d.color, d.type);
    // d3.select('body').style('cursor', 'default');
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
        dataLayer.addAllToCurrentSelection(d.selectedItem);
    }
    updateSeaDragonSelection();
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);


// For channel select click event
const channelSelect = async (sels) => {

    let channelCells = await dataLayer.getChannelCellIds(sels);
    // console.log(channelCells)

    dataLayer.addAllToCurrentSelection(channelCells);

    updateSeaDragonSelection(true);
}
eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);


//current fast solution for seadragon updates
function updateSeaDragonSelection(repaint = true) {
    seaDragonViewer.updateSelection(dataLayer.getCurrentSelection(), repaint);
}

//feature range selection changed in ridge plot
const actionFeatureGatingChange = (d) => {
    // console.log("gating event received");
    seaDragonViewer.updateChannelRange(dataLayer.getFullChannelName(d.name), d.dataRange[0], d.dataRange[1]);
}
eventHandler.bind(ChannelList.events.BRUSH_END, actionFeatureGatingChange);


function displayNeighborhood(selectedCell, neighborhood) {
    dataLayer.addToCurrentSelection(selectedCell, true, true);
    _.each(neighborhood, neighbor => {
        dataLayer.addToCurrentSelection(neighbor, true, false);
    });
    updateSeaDragonSelection();
}

