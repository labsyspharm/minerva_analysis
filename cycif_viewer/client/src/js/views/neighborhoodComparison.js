const datasource = flaskVariables.datasource;
let imageChannels = {};
let plots = [];
let dataSrcIndex = 0;
let config, dataLayer, neighborhoods, neighborhoodStats, container, phenotypeList, sortable;
let currentState = ''
const eventHandler = new SimpleEventHandler(d3.select('body').node());

d3.json(`/data/config.json?t=${Date.now()}`).then(function (config) {
    this.config = config;
    return init(config[datasource])
});

async function init(conf) {
    config = conf;
    //channel information
    for (let idx = 0; idx < config["imageData"].length; idx++) {
        imageChannels[config["imageData"][idx].fullname] = idx;
    }
    //INIT DATA LAYER
    dataLayer = new DataLayer(config, imageChannels);
    await dataLayer.init();
    container = document.getElementById('comparison_div');
    neighborhoods = await dataLayer.getAllNeighborhoodStats();
    phenotypeList = document.getElementById('phenotype_list');
    createGrid();
    initPhenotypeList();
    initSmallMultipleToggles();
    initSmallMultipleStarplots();
}

function initPhenotypeList() {
    const self = this;
    // Init Phenotype List
    let list = d3.select(phenotypeList).selectAll('.list-group-item')
        .data(dataLayer.phenotypes)
        .enter()
        .append('li')
        .attr('class', 'list-group-item list-group-item-secondary')
        .attr('data-id', d => d)
        .append('div')
        .attr('class', 'row')
    list.append('div')
        .attr('class', 'col-9')
        .text(d => d)
    list.append('div')
        .attr('class', 'col-3 phenotype_action')
        .on('click', (e, d) => {
            removePhenotype(e, d);
        })
        .append('span')
        .attr('class', 'material-icons')
        .text('remove')


    sortable = new Sortable(phenotypeList, {
        animation: 150,
        ghostClass: 'blue-background-class',
        // Called by any change to the list (add / update / remove)
        onSort: (e) => {
            redrawStarplots();
        }
    });
}

function initSmallMultipleToggles() {
    let parent = document.getElementById("small-multiple-toggle");
    _.each(parent.querySelectorAll(".btn-check"), (elem) => {
        elem.onclick = () => {
            switchSmallMultipleType(elem, parent);
        }
    })
}

function switchSmallMultipleType(elem, parent) {
    if (elem.id == "starplot-button") {
        if (selectAndUnselect(elem, parent)) {
            //Remove Bars
            currentState = 'starplot';
            //Add starplots
            removeAllPlots();
            initSmallMultipleStarplots();
        }
    } else if (elem.id == "barchart-button") {
        if (selectAndUnselect(elem, parent)) {
            currentState = 'barchart';
            removeAllPlots();
            initSmallMultipleBarcharts();
        }

    } else if (elem.id == "scatterplot-button") {
        if (selectAndUnselect(elem, parent)) {
            currentState = 'scatterplot';
            removeAllPlots();
            initSmallMultipleScatterplots();

        }

    }

    function selectAndUnselect(elem, parent) {
        let label = elem.labels[0];
        if (label.classList.contains("btn-dark")) {
            console.log("Already Checked")
            return false;
        } else {
            let otherButton = parent.querySelector('.btn-dark');
            otherButton.classList.remove('btn-dark');
            otherButton.classList.add('btn-light');
            label.classList.add('btn-dark');
            label.classList.remove('btn-light');
            return true;
        }
    }
}

function removeAllPlots() {

    d3.selectAll('.starplot, .barchart, .scatter_canvas').remove();
    plots = [];
}


function redrawStarplots() {
    // Gets data in order
    let data = d3.select(phenotypeList).selectAll('.list-group-item-secondary').data();
    wrangleSmallMultiples();
}

function removePhenotype(e, d) {
    let div = e.path[0];
    let span;
    if (div.tagName == "SPAN") {
        span = div;
        div = e.path[1];
    } else {
        span = div.childNodes[0];
    }
    let row = div.parentElement.parentElement;
    let array = sortable.toArray();
    if (span.innerText == "remove") {
        span.innerText = "add";
        row.classList.remove("list-group-item-secondary");
        row.classList.add("list-group-item-light");
        _.pull(array, d);
        array = _.concat(array, d);
        sortable.sort(array, true);
    } else {
        span.innerText = "remove";
        row.classList.add("list-group-item-secondary");
        row.classList.remove("list-group-item-light");
    }
    redrawStarplots();
}

function createGrid() {
    let rows = Math.floor(Math.sqrt(_.size(neighborhoods)));
    let cols = Math.ceil(_.size(neighborhoods) / rows);
    let i = 0;
    _.each(_.range(rows), r => {
        let row = document.createElement("div");
        row.className = "row compare_row";
        row.id = `compare_row_${r}`;
        _.each(_.range(cols), c => {
            let col = document.createElement("div");
            col.className = "col compare_col";
            col.id = `compare_col_${i}`;
            row.appendChild(col);
            let compare_plot_title = document.createElement("div");
            compare_plot_title.className = "row compare_plot_title";
            let title = document.createElement("h5");
            compare_plot_title.appendChild(title);
            col.appendChild(compare_plot_title);
            let compare_plot_body = document.createElement("div");
            compare_plot_body.id = `compare_starplot_${i}`
            compare_plot_body.className = "row compare_plot_body";
            col.appendChild(compare_plot_body);
            i++;
        })
        container.appendChild(row);
    })
}

function initSmallMultipleStarplots() {
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`);
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let starplot = new Starplot(`compare_starplot_${i}`, dataLayer.phenotypes, small = true);
        starplot.init();
        return starplot;
    });
    wrangleSmallMultiples();
}

function wrangleSmallMultiples(order = null, scatterplot = false) {
    _.each(plots, (plot, i) => {
        let plotData;
        if (currentState == 'scatterplot') {
            plotData = _.get(neighborhoods[i], 'cells', []);
        } else {
            plotData = _.get(neighborhoods[i], 'cluster_summary.weighted_contribution', []);
        }
        plot.wrangle(plotData, order);
    });
}

function initSmallMultipleBarcharts() {
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`);
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let barchart = new Barchart(`compare_starplot_${i}`, dataLayer.phenotypes);
        barchart.init();
        return barchart;
    });
    wrangleSmallMultiples();
}

function initSmallMultipleScatterplots() {
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`)
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let canvas_div = document.getElementById(`compare_starplot_${i}`);
        let canvas = document.createElement("canvas");
        canvas.className = 'scatterplot scatter_canvas';
        canvas.id = `compare_col_canvas_${i}`;
        canvas_div.appendChild(canvas);
        scatterplot = new Scatterplot(`compare_starplot_${i}`, `compare_col_canvas_${i}`, eventHandler, dataLayer);
        scatterplot.init();
        return scatterplot;
    });
    wrangleSmallMultiples();
}