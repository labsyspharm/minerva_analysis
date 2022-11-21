/**
 * main.js Initializes main client/interface setup, and distributes events to respective views
 */

//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select("body").node());
const datasource = flaskVariables.datasource;

//VIEWS
const __minervaAnalysis = {
  dataLayer: null,
  channelList: null,
  csv_gatingList: null
}

//DATA MANAGEMENT
const dataSrcIndex = 0;

//CHANNELS
const imageChannels = {}; // lookup table between channel id and channel name (for image viewer)
const imageChannelsIdx = {};

//OTHER SETTINGS
document.getElementById("openseadragon").addEventListener("contextmenu", (event) => event.preventDefault()); //Disable right clicking on element

//LOAD DATA
// Data prevent caching on the config file, as it may have been modified
d3.json(`/config?t=${Date.now()}`).then(function (config) {
    return init(config[datasource]);
});

//INITS

/**
 * Init all views.
 *
 * @param conf - The configuration json file
 */
async function init(config) {
    //maximum selections
    config.maxSelections = 4;
    config.extraZoomLevels = 3;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
        let name = config["imageData"][idx].name;
        if (name !== "Area") {
            imageChannelsIdx[idx] = name;
        }
    }

    //initialize metadata
    const dataLayer = new DataLayer(config, imageChannels);
    const numericData = new NumericData(config, dataLayer);
    const columns = await dataLayer.getChannelNames(true);
    const imgMetadata = await dataLayer.getMetadata();

    //Create channel panels
    channelList = new ChannelList(config, columns, dataLayer, eventHandler);
    csv_gatingList = new CSVGatingList(config, columns, dataLayer, eventHandler);
    __minervaAnalysis.csv_gatingList = csv_gatingList;
    __minervaAnalysis.channelList = channelList;
    __minervaAnalysis.dataLayer = dataLayer;
    

    //Create image viewer
    const imageArgs = [imgMetadata, numericData, eventHandler];
    const seaDragonViewer = new ImageViewer(config, ...imageArgs);
    const viewerManager = new ViewerManager(seaDragonViewer, channelList);

    //Initialize with database description
    const [dd, { ids, centers }] = await Promise.all([dataLayer.getDatabaseDescription(), numericData.loadCells()]);
    channelList.init(dd);
    csv_gatingList.init(dd, seaDragonViewer);
    const imageInit = [viewerManager, channelList, csv_gatingList, centers, ids];
    await Promise.all([dataLayer.init(), seaDragonViewer.init(...imageInit)]);

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
    };
    eventHandler.bind(ChannelList.events.COLOR_TRANSFER_CHANGE, actionColorTransferChange);

    /**
     * Listen to Render Mode Events and forwards it to respective views.
     *
     * @param d - The render mode object
     */
    const actionRenderingModeChange = (d) => {
        seaDragonViewer.updateRenderingMode(d);
    };
    eventHandler.bind(ImageViewer.events.renderingMode, actionRenderingModeChange);

    /**
     * Listen to Channels set for Rendering and forwards it to respective views.
     *
     * @param d - The channel package object
     */
    const actionChannelsToRenderChange = (d) => {
        d3.select("body").style("cursor", "progress");

        //map to full name
        d.name = dataLayer.getFullChannelName(d.name);

        //send to image viewer
        const action = ["remove", "add"][+d.status];
        seaDragonViewer.updateActiveChannels(d.name, action);

        d3.select("body").style("cursor", "default");
    };
    eventHandler.bind(ChannelList.events.CHANNELS_CHANGE, actionChannelsToRenderChange);

    /**
     * Listen to regional or single cell selection.
     *
     * @param d - The selections
     */
    const actionImageClickedMultiSel = (d) => {
        d3.select("body").style("cursor", "progress");
        const { idField } = config.featureData[0];
        // add newly clicked item to selection
        if (!Array.isArray(d.item)) {
            dataLayer.addToCurrentSelection(d.item, true, d.clearPriors);
            const picked = [d.item[idField]];
            updateSeaDragonSelection({ picked });
        } else {
            dataLayer.addAllToCurrentSelection(d.item);
            const picked = d.item.map(i => i[idField]);
            updateSeaDragonSelection({ picked });
        }
        d3.select("body").style("cursor", "default");
    };
    eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

    /**
     * Listen to Channel Select Click Events.
     *
     * @param sels - The selected/deselected channels
     */
    const channelSelect = async (sels) => {
        updateSeaDragonSelection();
        let channelCells = await dataLayer.getChannelCellIds(sels);
        dataLayer.addAllToCurrentSelection(channelCells);
    };
    eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);

    /**
     * Listens to and updates based on selection changes (specific for seadragon).
     *
     * @param props - may contain cell id
     */
    function updateSeaDragonSelection(props = {}) {
        if ("picked" in props) {
          seaDragonViewer.pickedIds = props.picked;
        }
        seaDragonViewer.forceRepaint();
    }

    /**
     * Remove currently selected picked cell ids
     */
    function clearSeaDragonSelection() {
      updateSeaDragonSelection({ picked: [] });
    }

    const handler = () => updateSeaDragonSelection();
    eventHandler.bind(CSVGatingList.events.GATING_BRUSH_END, handler);
    eventHandler.bind(CSVGatingList.events.GATING_BRUSH_MOVE, handler);

    eventHandler.bind(ChannelList.events.BRUSH_MOVE, (d) => {
        const fullName = dataLayer.getFullChannelName(d.name);
        seaDragonViewer.updateChannelRange(fullName, d.dataRange[0], d.dataRange[1]);
    });

    /**
     * Reset the gating list to inital values.
     */
    const reset_lists = () => {
        csv_gatingList.resetGatingList();
        channelList.resetChannelList();
        seaDragonViewer.forceRepaint();
    };
    eventHandler.bind(ChannelList.events.RESET_LISTS, reset_lists);

    const reset_gatinglist = () => {
        csv_gatingList.resetGatingList();
        seaDragonViewer.forceRepaint();
    };
    eventHandler.bind(CSVGatingList.events.RESET_GATINGLIST, reset_gatinglist);

    const add_scalebar = () => {
        seaDragonViewer.addScaleBar();
        seaDragonViewer.forceRepaint();
    };
    eventHandler.bind(ImageViewer.events.addScaleBar, add_scalebar);
}
