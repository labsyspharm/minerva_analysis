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
 * Init all views.
 *
 * @param conf - The configuration json file
 */
async function init(conf) {

    config = conf;
    //maximum selections
    config.maxSelections = 4;
    config.extraZoomLevels = 3;
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

    //init color scheme
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();

    //init channel panel
    channelList = new ChannelList(config, dataLayer, eventHandler);
    await channelList.init();

    //create image viewer
    const numericData = new NumericData(config, dataLayer);
    seaDragonViewer = new ImageViewer(config, numericData, channelList, eventHandler, colorScheme);

    //init gating panel
    csv_gatingList = new CSVGatingList(config, dataLayer, eventHandler);
    await csv_gatingList.init();

    //init image viewer
    await seaDragonViewer.init(csv_gatingList);
}

//EVENT HANDLING

/**
 * Listen to Color Transfer Change Events and forwards it to respective views.
 *
 * @param d - The color map object
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
 * Listen to Render Mode Events and forwards it to respective views.
 *
 * @param d - The render mode object
 */
const actionRenderingModeChange = (d) => {
    seaDragonViewer.updateRenderingMode(d);
}
eventHandler.bind(ImageViewer.events.renderingMode, actionRenderingModeChange);

/**
 * Listen to Channels set for Rendering and forwards it to respective views.
 *
 * @param d - The channel package object
 */
const actionChannelsToRenderChange = (d) => {
    d3.select('body').style('cursor', 'progress');

    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);

    //send to image viewer
    const action = ["remove", "add"][+d.status];
    seaDragonViewer.updateActiveChannels(d.name, action);

    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ChannelList.events.CHANNELS_CHANGE, actionChannelsToRenderChange);

/**
 * Listen to regional or single cell selection.
 *
 * @param d - The selections
 */
const actionImageClickedMultiSel = (d) => {
    d3.select('body').style('cursor', 'progress');
    // add newly clicked item to selection
    if (!Array.isArray(d.item)) {
        dataLayer.addToCurrentSelection(d.item, true, d.clearPriors);
        updateSeaDragonSelection([d.item]);
    } else {
        dataLayer.addAllToCurrentSelection(d.item);
        updateSeaDragonSelection(d.item);
    }
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

/**
 * Listen to Channel Select Click Events.
 *
 * @param sels - The selected/deselected channels
 */
const channelSelect = async (sels) => {
    // pause new rendering until data loads
    const resume = seaDragonViewer.sleep(); 
    let channelCells = await dataLayer.getChannelCellIds(sels);
    dataLayer.addAllToCurrentSelection(channelCells);
    updateSeaDragonSelection();
    resume();
}
eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);

/**
 * Listens to and updates based on selection changes (specific for seadragon).
 *
 * @param ids - list of selected ids
 */
function updateSeaDragonSelection(ids=[]) {
    const { idField } = this.config[datasource].featureData[0];
    seaDragonViewer.pickedIds = ids.map(v => v[idField]);
    seaDragonViewer.forceRepaint();
}

/**
 * Listens to and updates based on selection changes (specific for seadragon).
 *
 * @param packet - gating filter
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
    // pause new rendering until data loads
    const resume = seaDragonViewer.sleep(); 
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
    resume();
}
eventHandler.bind(CSVGatingList.events.GATING_BRUSH_END, gatingBrushEnd);

/**
 * Listens to feature gating selection changes.
 *
 * @param d - The name of the channel and its gating range information
 */
const actionFeatureGatingChange = (d) => {
    // console.log("gating event received");
    seaDragonViewer.updateChannelRange(dataLayer.getFullChannelName(d.name), d.dataRange[0], d.dataRange[1]);
}
eventHandler.bind(ChannelList.events.BRUSH_END, actionFeatureGatingChange);

/**
 * Reset the gating list to inital values.
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
