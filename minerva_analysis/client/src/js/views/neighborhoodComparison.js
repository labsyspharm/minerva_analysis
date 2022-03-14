const datasource = flaskVariables.datasource;
let imageChannels = {};
let plots = [];
let dataSrcIndex = 0;
let config, dataLayer, colorScheme, neighborhoods, neighborhoodStats, container, phenotypeList, sortable;
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
    colorScheme = new ColorScheme(dataLayer);
    await colorScheme.init();


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
            redrawParallelCoordinates();
        }
    });
}

function initToggles() {
    let smallMultipleToggles = document.getElementById("comparison_title");
    _.each(smallMultipleToggles.querySelectorAll(".btn-check"), (elem) => {
        elem.onclick = () => {
            switchSmallMultipleType(elem, smallMultipleToggles);
        }
    });

}

function switchSmallMultipleType(elem, parent) {
    if (elem.id == "parallel-coordinates-button") {
        if (selectAndUnselect(elem, parent)) {
            //Remove Bars
            currentState = 'parallelCoordinates';
            removeAllPlots();
            initSmallMultipleParallelCoordinates();
        }
    }
        //else if (elem.id == "barchart-button") {
        //         if (selectAndUnselect(elem, parent)) {
        //             currentState = 'barchart';
        //             removeAllPlots();
        //             initSmallMultipleBarcharts();
        //         }
        //
    //     }
    else if (elem.id == "scatterplot-button") {
        if (selectAndUnselect(elem, parent)) {
            currentState = 'scatterplot';
            removeAllPlots();
            initSmallMultipleScatterplots();

        }

    } else if (elem.id == "heatmap-button") {
        if (selectAndUnselect(elem, parent)) {
            currentState = 'heatmap';
            removeAllPlots();
            document.getElementById("summary_div").style.display = "block";
            document.getElementById("comparison_div_parent").style.display = "none";
            initHeatmap();
        }
    } else if (elem.id == "stacked-button") {
        if (selectAndUnselect(elem, parent)) {
            currentState = 'stacked';
            removeAllPlots();
            document.getElementById("summary_div").style.display = "block";
            document.getElementById("comparison_div_parent").style.display = "none";
            initStackedBarchart();
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
    d3.selectAll('.barchart, .scatter_canvas, .parallel_coords, #heatmap-svg, #summary_div_barchart_svg, .tooltip, #legend-svg').remove();
    document.getElementById("summary_div").style.display = "none";
    document.getElementById("comparison_div_parent").style.display = "flex";
    plots = [];
}


function redrawParallelCoordinates() {
    // Gets data in order
    let data = d3.select(phenotypeList).selectAll('.list-group-item-secondary').data();
    wrangleSmallMultiples(data);
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
    redrawParallelCoordinates();
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
            compare_plot_title.className = "row compare_plot_title justify-content-center";
            let title = document.createElement("h5");
            compare_plot_title.appendChild(title);
            col.appendChild(compare_plot_title);
            let compare_plot_body = document.createElement("div");
            compare_plot_body.id = `compare_parallel_coordinates_${i}`
            compare_plot_body.className = "row compare_plot_body";
            col.appendChild(compare_plot_body);
            i++;
        })
        container.appendChild(row);
    })
}

function initSmallMultipleParallelCoordinates() {
    document.getElementById('phenotype_list_div').style.display = "block";
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`);
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let pc = new ParallelCoordinates(`compare_parallel_coordinates_${i}`, dataLayer, eventHandler, small = true);
        pc.init();
        return pc;
    });

    wrangleSmallMultiples();
}

function wrangleSmallMultiples(order = null, scatterplot = false) {
    _.each(plots, (plot, i) => {
        let plotData;
        if (currentState == 'scatterplot') {
            plotData = _.get(neighborhoods[i], 'cells', []);
        } else {
            plotData = _.get(neighborhoods[i], 'composition_summary.weighted_contribution', []);
        }
        plot.wrangle(plotData, order);
    });
}

function initSmallMultipleBarcharts() {
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`);
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let barchart = new Barchart(`compare_parallel_coordinates_${i}`, dataLayer.phenotypes);
        barchart.init();
        return barchart;
    });
    wrangleSmallMultiples();
}

function initSmallMultipleScatterplots() {
    document.getElementById('phenotype_list_div').style.display = "none";
    plots = _.map(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`)
        let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
        let canvas_div = document.getElementById(`compare_parallel_coordinates_${i}`);
        let canvas = document.createElement("canvas");
        canvas.className = 'scatterplot scatter_canvas';
        canvas.id = `compare_col_canvas_${i}`;
        canvas.width = canvas_div.offsetWidth;
        canvas.height = canvas_div.offsetHeight;
        canvas_div.appendChild(canvas);
        scatterplot = new Scatterplot(`compare_parallel_coordinates_${i}`, `compare_col_canvas_${i}`, eventHandler, dataLayer);
        scatterplot.init();
        return scatterplot;
    });
    wrangleSmallMultiples();
}

function initHeatmap() {
    let heatmap = new Heatmap(`summary_div`, dataLayer);
    heatmap.init();
}

function initStackedBarchart() {
    let stacked = new StackedBarchart(`summary_div`, dataLayer, colorScheme, neighborhoods);
    let legend = new Legend(dataLayer, colorScheme, eventHandler);
    legend.draw();
    stacked.init();
}