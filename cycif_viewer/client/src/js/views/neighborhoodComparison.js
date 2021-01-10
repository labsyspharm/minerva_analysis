const datasource = flaskVariables.datasource;
let imageChannels = {};
let dataSrcIndex = 0;
let config, dataLayer, neighborhoods, neighborhoodStats, container;
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
    createGrid();
    createPlots();
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

function createPlots() {
    _.each(neighborhoods, (d, i) => {
        let div = document.getElementById(`compare_col_${i}`);
        let header = div.querySelector('h5').innerHTML = d['name'];
        let starplot = new Starplot(`compare_starplot_${i}`, dataLayer.phenotypes, small = true);
        starplot.init();
        let starplotData = _.get(d, 'cluster_summary.weighted_contribution', []);
        starplot.wrangle(starplotData);

    })
}