/**

 */
//EVENTHANDLER
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const database = flaskVariables.database;

//GENERAL EVENTS
events = {
    editingModeChanged: 'editingModeChanged',
};

//VIEWS
let seaDragonViewer;
var distViewer;
var dataFilter;
var config;
var imgSrcIndex = 0; // channel id
var dataSrcIndex = 0; // dataset id
var idCount = 0;
var k = 3;
var imageChannels = {}; // lookup table between channel id and channel name (for image viewer)

//OPTIONS
var option_selection = 'cell selection';

//DEBUG MODE
var debugImageViewer = false; //jojo debug

// init image viewer debugging UI
if (debugImageViewer) {
    initColorPickers();
    initRangeSlider();
}

function convertNumbers(row) {
    var r = {};
    r['id'] = idCount + '';
    if (config[database]["featureData"]['id'] && config[database]["featureData"]['id'] != "none") {
        r['id'] = '' + parseInt(row[config[database]["featureData"]['id']] - 1);
    }
    for (var k in row) {
        //convert from string to number and denormalize, if needed.
        // if (config[database]["featureData"][dataSrcIndex]["normalization"] == "exp"){
        //     r[k] = Math.exp(+row[k]);
        // }else{
        r[k] = +row[k];
        // }
    }
    r['cluster'] = '-';
    idCount++;
    return r;
}


//LOAD DATA


console.log('loading config');
// Data prevent caching on the config file, as it may have been modified
d3.json(`/static/data/config.json?t=${Date.now()}`).then(function (config) {
    updateProgress(true);
    console.log('loading data');
    this.config = config;
    d3.csv(config[database]["featureData"][dataSrcIndex]["src"], convertNumbers).then(function (data) {
        console.log('data loading finished');
        init(config[database], data);
    });
});


// init all views (datatable, seadragon viewer,...)
function init(conf, data) {

    console.log('initialize system');

    config = conf;

    //channel information
    for (var idx = 0; idx < config["imageData"].length; idx = idx + 1) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA FILTER
    dataFilter = new DataFilter(config, data, imageChannels);
    dataFilter.wrangleData(dataFilter.getData());

    updateProgress(false);
    //RIDGE PLOT (not ready, hence outcommented)
    distViewer = new DistributionViewer(config, dataFilter, eventHandler);
    distViewer.init(dataFilter.getData());


    //IMAGE VIEWER
    seaDragonViewer = new ImageViewer(config, dataFilter, eventHandler);
    seaDragonViewer.init();

}


//spinner wheel for whole gui
function updateProgress(loading) {
    //do sth.
    if (loading) {
        document.getElementById('loader').style.display = "block";
        document.getElementById('loadinginfo').style.display = "block";
    } else {
        document.getElementById('loader').style.display = "none";
        document.getElementById('loadinginfo').style.display = "block";
    }
}

//spinner wheel for projection gui
function updateProjectionProgress(loading) {
    //do sth.
    if (loading) {
        document.getElementById('projection_loader').style.display = "block";
    } else {
        document.getElementById('projection_loader').style.display = "none";
    }
}


//feature color map changed in ridge plot
const actionColorTransferChange = (d) => {

    //map to full name
    d.name = this.dataFilter.getFullChannelName(d.name);

    d3.select('body').style('cursor', 'progress');
    seaDragonViewer.updateChannelColors(d.name, d.color, d.type);
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(DistributionViewer.events.COLOR_TRANSFER_CHANGE, actionColorTransferChange);

//feature color map changed in ridge plot
const actionRenderingModeChange = (d) => {
    seaDragonViewer.updateRenderingMode(d);
}
eventHandler.bind(ImageViewer.events.renderingMode, actionRenderingModeChange);


//feature color map changed in ridge plot
const actionChannelsToRenderChange = (d) => {
    d3.select('body').style('cursor', 'progress');

    //map to full name
    d.name = this.dataFilter.getFullChannelName(d.name);

    //send to image viewer
    seaDragonViewer.updateActiveChannels(d.name, d.selections, d.status);
    
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(DistributionViewer.events.CHANNELS_CHANGE, actionChannelsToRenderChange);
