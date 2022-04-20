/**

 */
//EVENTHANDLER
// console.log("Here");
const eventHandler = new SimpleEventHandler(d3.select('body').node());
const datasource = flaskVariables.datasource;
let applyPrevious = flaskVariables.applyPrevious;
let mode = flaskVariables.mode;
let searching = false;
let colorByCellType = true;


//VIEWS
let seaDragonViewer, channelList, parallelCoordinates, scatterplot, legend, neighborhoodTable, comparison, multiImage,
    heatmap;
let scatterColorToggle;
//SERVICES
let dataLayer, colorScheme;

//INSTANCE VARS
let config;
let dataSrcIndex = 0; // dataset id
let k = 3;
let imageChannels = {}; // lookup table between channel id and channel name (for image viewer)

//Disable right clicking on element
document.getElementById("openseadragon").addEventListener('contextmenu', event => event.preventDefault());


//LOAD DATA
// Data prevent caching on the config file, as it may have been modified
d3.json(`/data/config.json?t=${Date.now()}`).then(function (config) {
    this.config = config;
    return init(config[datasource])
});


// init all views (datatable, seadragon viewer,...)
async function init(conf) {
    console.log('Starting', new Date());
    config = conf;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA LAYER
    console.log('Starting Init', new Date());
    dataLayer = new DataLayer(config, imageChannels);
    await dataLayer.init();
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();
    comparison = new Comparison(config, colorScheme, dataLayer, eventHandler, 'comparison_grid',
        false, null, 'scatterplot', 'related_images_dropdown');
    neighborhoodTable = new NeighborhoodTable(dataLayer, eventHandler);
    parallelCoordinates = new ParallelCoordinates('parallel_coordinates_display', dataLayer, eventHandler, colorScheme);
    scatterplot = new Scatterplot('scatterplot_display', 'viewer_scatter_canvas', eventHandler, dataLayer,
        neighborhoodTable, colorScheme, false, false, datasource, 'search-info-svg');
    scatterColorToggle = new ColorToggle('recolor_neighborhood_embedding_col', [scatterplot])

    heatmap = new Heatmap(`heatmap_display`, dataLayer, eventHandler);
    heatmap.init();
    //image viewer
    if (mode === 'single') {
        // if (config?.linkedDatasets) {
        //     document.getElementById('related_image_list_wrapper').style.visibility = "visible";
        // } else {
        //     document.getElementById('related_image_list_wrapper').style.visibility = "hidden";
        // }
        // legend = new Legend(dataLayer, colorScheme, eventHandler);
        channelList = new ChannelList(config, dataLayer, eventHandler);
        seaDragonViewer = new ImageViewer(config, dataLayer, eventHandler, colorScheme);
        // multiImage = new Comparison(config, colorScheme, dataLayer, eventHandler, 'related_image_container', true, null, 'image',
        //     'related_images_dropdown');
        let compareToggle = new ColorToggle('recolor_related_images', [comparison]);
        // init synchronus methods
        seaDragonViewer.init();
        let viewerColorToggle = new ColorToggle('recolor_image_viewer', [seaDragonViewer], true);
        await channelList.init()

    } else {
        document.getElementById('openseadragon_wrapper').style.display = "none"
        document.getElementById('multi_image_wrapper').style.display = "block"
        document.getElementById('channel_list_wrapper').style.visibility = "hidden";

        multiImage = new Comparison(config, colorScheme, dataLayer, eventHandler, 'multi_image_wrapper',
            true, 4, 'image', 'multi_image_dropdown');
        let viewerColorToggle = new ColorToggle('recolor_multi_image', [multiImage], false);


    }
    console.log('Ending Multi', new Date());
    console.log('PCP Init', new Date())
    parallelCoordinates.init();
    console.log('Scatter Init', new Date())
    scatterplot.init();
    console.log('Sync Init', new Date());
    //Async stuff
    console.log('Starting Async', new Date());
    await Promise.all([neighborhoodTable.init(), scatterplot.wrangle(), comparison.init(), multiImage?.init()]);
    console.log('Ending Async', new Date());
    setupPageInteractivity();
    if (applyPrevious && applyPrevious != 'false') {
        searching = true;
        return dataLayer.applyNeighborhoodQuery()
            .then(cells => {
                if (cells) {
                    return displayNeighborhoodSelection(cells)
                }
            })
    } else {
        store(false);
    }
}

//feature color map changed in ridge plot
const actionColorTransferChange = (d) => {
    //map to full name
    d.name = dataLayer.getFullChannelName(d.name);
    seaDragonViewer.updateChannelColors(d.name, d.color, d.type);
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
        dataLayer.addAllToCurrentSelection({'cells': d.selectedItem});
    }
    // cellInformation.selectCell(d.selectedItem);
    updateSeaDragonSelection(true, true);
    d3.select('body').style('cursor', 'default');
}
eventHandler.bind(ImageViewer.events.imageClickedMultiSel, actionImageClickedMultiSel);

const displaySelection = async (d) => {
    let now = new Date().getTime();
    let selection = d.selection;
    let selectionSource = d.selectionSource || "Image";
    document.getElementById('neighborhood_current_selection').textContent = selectionSource;
    // document.getElementById('neighborhood_current_selection_count').textContent = _.size(selection.cells);
    dataLayer.addAllToCurrentSelection(selection);
    console.log('Added to Selection', new Date().getTime() - now)
    parallelCoordinates.wrangle(selection);
    console.log('Added to Par Cor', new Date().getTime() - now)
    heatmap.rewrangle();
    if (d.selectionSource === "Multi Image") {
        console.log('Clearing', new Date().getTime() - now)
        multiImage?.clear(d.dataset)
        console.log('Recolor Embedding', new Date().getTime() - now)
        scatterplot.recolor(d.selection[d.dataset]["selection_ids"]);
    } else if (mode === 'multi') {
        // We return back the scatter ids on from the request payload
        scatterplot.recolor(d.selection['selection_ids']);
    } else {
        scatterplot.recolor();
    }
    updateSeaDragonSelection(false, false);

}
eventHandler.bind(ImageViewer.events.displaySelection, displaySelection);

const displayNeighborhoodSelection = async (selection) => {
    dataLayer.addAllToCurrentSelection(selection);
    document.getElementById('neighborhood_current_selection').textContent = 'Phenotype';
    // document.getElementById('neighborhood_current_selection_count').textContent = _.size(selection.cells);
    if (selection) {
        if (mode == 'single') {
            scatterplot.recolor();
        } else if (mode == 'multi') {
            scatterplot.recolor(selection['selection_ids']);
        }
        parallelCoordinates.wrangle(selection);
    }
    updateSeaDragonSelection(false, false);
}
eventHandler.bind(ImageViewer.events.displayNeighborhoodSelection, displayNeighborhoodSelection);

const selectNeighborhood = async (d) => {
    let selection = await dataLayer.getNeighborhood(d[0]);
    if (d[3] === "Lasso") {
        selection = await scatterplot.applyLasso(selection);
    }
    selection['patternName'] = d[2];
    document.getElementById('neighborhood_current_selection').textContent = 'Cluster';
    // document.getElementById('neighborhood_current_selection_count').textContent = _.size(selection.cells);
    dataLayer.addAllToCurrentSelection(selection);
    parallelCoordinates.wrangle(selection);
    if (mode=='multi'){
        scatterplot.recolor(selection['selection_ids']);
    } else {
        scatterplot.recolor(null, true);
    }
    heatmap.rewrangle();
    updateSeaDragonSelection(false, false);

}
eventHandler.bind(NeighborhoodTable.events.selectNeighborhood, selectNeighborhood);

const changeSelectionMode = (singleCellMode) => {
    dataLayer.switchViewMode(singleCellMode);
    updateSeaDragonSelection(false, false);
}
eventHandler.bind(ImageViewer.events.changeSelectionMode, changeSelectionMode);


eventHandler.bind(Scatterplot.events.selectFromScatterplot, displaySelection);

const updateSavedNeighborhoods = (d) => {
    multiImage?.rewrangle();
    comparison.rewrangle(true);
}
eventHandler.bind(NeighborhoodTable.events.updateSavedNeighborhoods, updateSavedNeighborhoods);

// const computeCellNeighborhood = async ({distance, selectedCell}) => {
//     let neighborhood = await dataLayer.getIndividualNeighborhood(distance, selectedCell);
//     displayNeighborhood(selectedCell, neighborhood);
// }
// eventHandler.bind(CellInformation.events.computeNeighborhood, computeCellNeighborhood);

// const drawNeighborhoodRadius = async ({distance, selectedCell, dragging}) => {
//     seaDragonViewer.drawCellRadius(distance, selectedCell, dragging);
// }
// eventHandler.bind(CellInformation.events.drawNeighborhoodRadius, drawNeighborhoodRadius);

// For channel select click event
const channelSelect = async (sels) => {
    let channelCells = await dataLayer.getChannelCellIds(sels);
    dataLayer.addAllToCurrentSelection({'cells': channelCells});
    updateSeaDragonSelection(true, false);
}
eventHandler.bind(ChannelList.events.CHANNEL_SELECT, channelSelect);


//current fast solution for seadragon updates
function updateSeaDragonSelection(showCellInfoPanel = false, repaint = true) {
    d3.selectAll('.contourPath').remove();
    neighborhoodTable.enableSaveButton();
    if (mode == 'single') {
        seaDragonViewer.updateSelection(dataLayer.getCurrentSelection());
        seaDragonViewer.updateSelection(dataLayer.getCurrentSelection(), repaint);
    }
    multiImage?.rewrangle();
    comparison.rewrangle();

    if (seaDragonViewer?.contourView) {
        seaDragonViewer?.drawContourLines();
    } else {
        seaDragonViewer?.clearContourLines();
    }
}

//feature range selection changed in ridge plot
const actionFeatureGatingChange = (d) => {
    // console.log("gating event received");
    seaDragonViewer.updateChannelRange(dataLayer.getFullChannelName(d.name), d.dataRange[0], d.dataRange[1]);
}
eventHandler.bind(ChannelList.events.BRUSH_END, actionFeatureGatingChange);

const selectPhenotype = async (phenotype) => {
    let cells = await dataLayer.getNeighborhoodByPhenotype(phenotype);
    await displayNeighborhoodSelection(cells);
}
eventHandler.bind(ParallelCoordinates.events.selectPhenotype, selectPhenotype);

const selectPhenotypePair = async (d) => {
    console.log(d);
    let phenotypes = [d.row, d.col];
    let selection = null;
    if (d.plotName != 'overall') {
        selection = dataLayer.getCurrentRawSelection();
    }
    let cells = await dataLayer.getNeighborhoodByPhenotype(phenotypes, selection);
    await displayNeighborhoodSelection(cells);
}
eventHandler.bind(Heatmap.events.selectPhenotypePair, selectPhenotypePair);


function displayNeighborhood(selectedCell, neighborhood) {
    dataLayer.addAllToCurrentSelection({'cells': neighborhood});
    dataLayer.addToCurrentSelection(selectedCell, false, false);
    updateSeaDragonSelection(true, true);
}

function showHideRHS() {
    let osd_wrapper = document.getElementById('openseadragon_wrapper');
    let neighborhood_wrapper = document.getElementById('neighborhood_wrapper');
    let expand_wrapper = document.getElementById('expand_wrapper');
    let expand_icon = document.getElementById('expand_icon');
    let navbarWrapper = document.getElementById('topBar');
    if (osd_wrapper.classList.contains("openseadragon_wrapper_large")) {
        osd_wrapper.classList.remove("openseadragon_wrapper_large");
        osd_wrapper.classList.add("openseadragon_wrapper_small");
        navbarWrapper.classList.remove("topBarLarge");
        navbarWrapper.classList.add("topBarSmall");
        neighborhood_wrapper.classList.remove("neighborhood_wrapper_small");
        neighborhood_wrapper.classList.add("neighborhood_wrapper_large");
        expand_wrapper.classList.remove('expand_wrapper_right');
        expand_wrapper.classList.add('expand_wrapper_left');
        expand_icon.innerText = 'keyboard_double_arrow_right';
        resizeAnalysisWrapper(false);
    } else {
        osd_wrapper.classList.add("openseadragon_wrapper_large");
        osd_wrapper.classList.remove("openseadragon_wrapper_small");
        neighborhood_wrapper.classList.add("neighborhood_wrapper_small");
        neighborhood_wrapper.classList.remove("neighborhood_wrapper_large");
        expand_wrapper.classList.remove('expand_wrapper_left');
        expand_wrapper.classList.add('expand_wrapper_right');
        expand_icon.innerText = 'keyboard_double_arrow_left';
        navbarWrapper.classList.remove("topBarSmall");
        navbarWrapper.classList.add("topBarLarge");
        resizeAnalysisWrapper(true)
    }

    function resizeAnalysisWrapper(expand = true) {
        createTransitionEndEventListener('#analysis_wrapper', () => {
            parallelCoordinates.rewrangle()
            scatterplot.rewrangle()
        })
        let analysis_wrapper = document.getElementById('analysis_wrapper');
        if (expand) {
            analysis_wrapper.classList.add("analysis_wrapper_large");
            analysis_wrapper.classList.remove("analysis_wrapper_small");
        } else {
            analysis_wrapper.classList.remove("analysis_wrapper_large");
            analysis_wrapper.classList.add("analysis_wrapper_small");
        }
    }

    //TODO Redraw scatterplot
    comparison.draw();
}

function setupColExpand() {
    document.getElementById('expand_icon').addEventListener("click", () => {
        showHideRHS();
    });
}

function expandContractColumn(button) {
    let channel_list = document.getElementById('channel_list');
    let pattern_list = document.getElementById('neighborhood_table_card');
    if (button.classList.contains('fa-chevron-up')) {
        button.classList.remove('fa-chevron-up');
        button.classList.add('fa-chevron-down');

        if (button.id == 'expand-contract-channels') {
            channel_list.classList.remove('channel_list_big');
            channel_list.classList.add('channel_list_small');
        } else {
            pattern_list.classList.remove('neighborhood_table_card_big');
            pattern_list.classList.add('neighborhood_table_card_small');
        }

    } else {
        button.classList.remove('fa-chevron-down');
        button.classList.add('fa-chevron-up');
        if (button.id == 'expand-contract-channels') {

            channel_list.classList.remove('channel_list_small');
            channel_list.classList.add('channel_list_big');
        } else {
            pattern_list.classList.remove('neighborhood_table_card_small');
            pattern_list.classList.add('neighborhood_table_card_big');
        }
    }
}

// function setupShowHideColumn() {
//     let channelButton = document.getElementById('expand-contract-channels');
//     channelButton.addEventListener('click', (event) => {
//             let button = event.target;
//             if (button.classList.contains('fa-chevron-up')) {
//                 button.classList.remove('fa-chevron-up');
//                 button.classList.add('fa-chevron-down');
//             } else {
//                 button.classList.remove('fa-chevron-down');
//                 button.classList.add('fa-chevron-up');
//                 setupShowHideColumn();
//             }
//         }
//     )
//
// }

function createTransitionEndEventListener(selector, func) {
    let input = document.querySelector(selector);
    let transitionEndEventName = getTransitionEndEventName();
    input.addEventListener(transitionEndEventName, func);


    function getTransitionEndEventName() {
        const transitions = {
            "transition": "transitionend",
            "OTransition": "oTransitionEnd",
            "MozTransition": "transitionend",
            "WebkitTransition": "webkitTransitionEnd"
        }
        let bodyStyle = document.body.style;
        for (let transition in transitions) {
            if (bodyStyle[transition] != undefined) {
                return transitions[transition];
            }
        }
    }
}

function setupPageInteractivity() {
    setupColExpand();

//    Setup Neighborhood Query Button
    const neighborhoodButton = document.getElementById("neighborhood_icon");
    neighborhoodButton.addEventListener("click", event => {
        if (document.getElementById('neighborhood_current_selection').innerText == "Composition") {
            return parallelCoordinates.search();
        }
        d3.select('#selectionPolygon').remove();
        neighborhoodButton.style.stroke = "orange";
        let sim = document.getElementById('similarity_val').innerHTML || '0.8';
        let simVal = parseFloat(sim);
        // seaDragonViewer.showLoader();
        if (_.size(dataLayer.getCurrentSelection()) > 0) {
            return dataLayer.getSimilarNeighborhoodToSelection(simVal)
                .then(cells => {
                    // seaDragonViewer.hideLoader();
                    return displayNeighborhoodSelection(cells);
                })

        }
    })

    const similaritySlider = document.getElementById("neighborhood_similarity");
    similaritySlider.onchange = (e) => {
        let val = document.getElementById("neighborhood_similarity").value;
        let span = document.getElementById('similarity_val');
        span.innerHTML = ''
        span.innerHTML = _.toString((val / 100).toFixed(2));
    }


}