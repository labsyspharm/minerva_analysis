/**
 * main.js Initializes main client/interface setup, and distributes events to respective views
 */


//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;

//VIEWS
let seaDragonViewer;
let channelList;
let csv_gatingList;

//DATA MANAGEMENT
let dataLayer;
let config;
let dataSrcIndex = 0; // dataset id

//CHANNELS
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)
let imageChannelsIdx = {};

//COLORS
let colorScheme;

//OTHER SETTINGS
document.getElementById("openseadragon")
    .addEventListener('contextmenu',
            event => event.preventDefault()); //Disable right clicking on element

//LOAD DATA
// Data prevent caching on the config file, as it may have been modified
d3.json(`/config?t=${Date.now()}`).then(function (config) {
    this.config = config;
    return init(config[datasource])
});

//INITS

/**
 * init all views
 * @param  {json} conf The configuration json file
 */
async function init(conf) {

    config = conf;
    //maximum selections
    config.maxSelections = 4;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
        let name = config["imageData"][idx].name
        if (name !== 'Area') {
            imageChannelsIdx[idx] = name;
        }
    }
    //init data filter
    dataLayer = new DataLayer(config, imageChannels);
    await dataLayer.init();

    //init channel panel
    channelList = new ChannelList(config, dataLayer, eventHandler);
    await channelList.init();

    //init gating panel
    csv_gatingList = new CSVGatingList(config, dataLayer, eventHandler);
    await csv_gatingList.init();

    //init color scheme
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();

    //init image viewer
    seaDragonViewer = new ImageViewer(config, dataLayer, eventHandler, colorScheme);
    seaDragonViewer.init();
}


//EVENT HANDLING

/**
 * Listen to Color Transfer Change Events and forwards it to respective views
 * @param  {package object} d The color map object
 */
const actionColorTransferChange = (d) => {

    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);
    // d3.select('body').style('cursor', 'progress');
    seaDragonViewer.updateChannelColors(d.name, d.color, d.type);
    // d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ChannelList.events.COLOR_TRANSFER_CHANGE, actionColorTransferChange);

/**
 * Listen to Render Mode Events and forwards it to respective views
 * @param  {package object} d The render mode object
 */
const actionRenderingModeChange = (d) => {
    seaDragonViewer.updateRenderingMode(d);
}
eventHandler.bind(ImageViewer.events.renderingMode, actionRenderingModeChange);

/**
 * Listen to Channels set for Rendering and forwards it to respective views
 * @param  {package object} d The channel package object
 */
const actionChannelsToRenderChange = (d) => {
    d3.select('body').style('cursor', 'progress');

    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);

    //send to image viewer
    seaDragonViewer.updateActiveChannels(d.name, d.selections, d.status);

    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ChannelList.events.CHANNELS_CHANGE, actionChannelsToRenderChange);

/**
 * Listen to regional or single cell selection
 * @param  {package object} d The selections
 */
const actionImageClickedMultiSel = (d) => {
    d3.select('body').style('cursor', 'progress');
    // add newly clicked item to selection
    if (!Array.isArray(d.selectedItem)) {
        dataLayer.addToCurrentSelection(d.selectedItem, true, d.clearPriors);
    } else {
        dataLayer.addAllToCurrentSelection(d.selectedItem);
    }
    updateSeaDragonSelection();
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

/**
 * Listen to Channel Select Click Events
 * @param  {package object} d The selected/deselected channels
 */
const channelSelect = async (sels) => {
    let channelCells = await dataLayer.getChannelCellIds(sels);
    dataLayer.addAllToCurrentSelection(channelCells);
    updateSeaDragonSelection(false);
}
eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);

/**
 * Listens to and updates based on selection changes (specific for seadragon)
 * @param  {boolean} d Whether to repaint
 */
function updateSeaDragonSelection(repaint = true) {
    seaDragonViewer.updateSelection(dataLayer.getCurrentSelection(), repaint);
}

/**
 * Listens to and updates based on selection changes (specific for seadragon)
 * @param  {boolean} d Whether to repaint
 */
const gatingBrushEnd = async (packet) => {
    // Init gated cells
    let gatedCells = [];
    // Get custom cell ids (made-to-order properties)
    const start_keys = [
        this.config[datasource].featureData[0].idField,
        this.config[datasource].featureData[0].xCoordinate,
        this.config[datasource].featureData[0].yCoordinate
    ];
    // Toggle these methods with centroids on/off ui
    if (csv_gatingList.eval_mode === 'and') {
        // AND
        gatedCells = await dataLayer.getGatedCellIds(packet, start_keys);
    } else {
        // OR
        gatedCells = await dataLayer.getGatedCellIdsCustom(packet, start_keys);
    }
    // Update selection
    dataLayer.addAllToCurrentSelection(gatedCells);
    // Update view
    updateSeaDragonSelection();
}
eventHandler.bind(CSVGatingList.events.GATING_BRUSH_END, gatingBrushEnd);

/**
 * Listens to feature gating selection changes
 * @param  {packet object} d The name of the channel and its gating range information
 */
const actionFeatureGatingChange = (d) => {
    // console.log("gating event received");
    seaDragonViewer.updateChannelRange(dataLayer.getFullChannelName(d.name), d.dataRange[0], d.dataRange[1]);
}
eventHandler.bind(ChannelList.events.BRUSH_END, actionFeatureGatingChange);

/**
 * Reset the gating list to inital values
 */
const reset_lists = () => {
    csv_gatingList.resetGatingList();
    channelList.resetChannelList();
    seaDragonViewer.forceRepaint();
}
eventHandler.bind(ChannelList.events.RESET_LISTS, reset_lists);

const add_scalebar = () => {
    seaDragonViewer.addScaleBar();
    seaDragonViewer.forceRepaint();
}
eventHandler.bind(ImageViewer.events.addScaleBar, add_scalebar);
