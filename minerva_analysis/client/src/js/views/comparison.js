class Comparison {
    constructor(_config, _colorScheme, _dataLayer, _eventHandler) {
        this.config = _config;
        this.colorScheme = _colorScheme;
        this.dataLayer = _dataLayer;
        this.eventHandler = _eventHandler;
        this.currentState = ''
        this.plots = []
        this.neighborhoods = null;
        this.container = null;
        this.pinnedContainer = null;
        this.hidden = true;
    }

    async init() {
        const self = this;
        self.container = document.getElementById('comparison_grid');
        // self.pinnedContainer = document.getElementById('pinned_comparison_grid');
        self.neighborhoods = await self.dataLayer.getAllNeighborhoodStats();
        let t = self.neighborhoods;
        // self.neighborhoods = [t[6], t[7], t[8], t[9], t[0], t[1]]
        self.neighborhoods = self.neighborhoods.map((e, i) => {
            e.neighborhood_name = e.neighborhood_name || 'Cluster ' + i;
            return e
        })
        console.log('Compare Ready');

    }

    draw() {
        const self = this;
        this.hidden = !this.hidden;
        if (!this.hidden) {
            let parentHeight = document.getElementById('comparison_container').clientHeight;
            self.rowHeight = Math.round(parentHeight / 4);
            // self.pinnedContainer.style.height = self.pinnedContainer.style.maxHeight = `${self.rowHeight * 2}px`;
            // HEATMAP
            // self.container.style.height = self.container.style.maxHeight = `${self.rowHeight}px`;
            self.createGrid();
            self.initToggles();
            //HEATMAP
            self.currentState = 'barchart';

            self.initSmallMultipleBarcharts();
        } else {
            self.removeAllPlots();
            self.container.innerHTML = '';
        }
    }

    redrawParallelCoordinates() {
        const self = this;
        self.wrangleSmallMultiples(self.dataLayer.phenotypes);
    }

    initToggles() {
        const self = this;
        let smallMultipleToggles = document.getElementById("comparison_title");
        _.each(smallMultipleToggles.querySelectorAll(".btn-check"), (elem) => {
            elem.onclick = () => {
                self.switchSmallMultipleType(elem, smallMultipleToggles);
            }
        });
    }

    switchSmallMultipleType(elem, parent) {
        const self = this;
        if (elem.id == "parallel-coordinates-button") {
            if (self.selectAndUnselect(elem, parent)) {
                //Remove Bars
                self.currentState = 'parallelCoordinates';
                self.removeAllPlots();
                self.initSmallMultipleParallelCoordinates();
            }
        } else if (elem.id == "barchart-button") {
            if (self.selectAndUnselect(elem, parent)) {
                self.currentState = 'barchart';
                self.removeAllPlots();
                self.initSmallMultipleBarcharts();
            }

        } else if (elem.id == "scatterplot-button") {
            if (self.selectAndUnselect(elem, parent)) {
                self.currentState = 'scatterplot';
                self.removeAllPlots();
                self.initSmallMultipleScatterplots();
            }

        } else if (elem.id == "heatmap-button") {
            if (self.selectAndUnselect(elem, parent)) {
                self.currentState = 'heatmap';
                self.removeAllPlots();
                document.getElementById("summary_div").style.display = "block";
                document.getElementById("comparison_div_parent").style.display = "none";
                self.initHeatmap();
            }
        } else if (elem.id == "stacked-button") {
            if (self.selectAndUnselect(elem, parent)) {
                self.currentState = 'stacked';
                self.removeAllPlots();
                document.getElementById("summary_div").style.display = "block";
                document.getElementById("comparison_grid").style.display = "none";
                self.initStackedBarchart();
            }
        } else if (elem.id == "image-button") {
            if (self.selectAndUnselect(elem, parent)) {
                self.currentState = 'image';
                self.removeAllPlots();
                self.rowHeight = document.documentElement.clientHeight * 0.4;
                self.createGrid(1);
                self.initImages();
            }
        }
    }

    selectAndUnselect(elem, parent) {
        const self = this;
        let label = elem.labels[0];
        if (label?.classList.contains("btn-dark")) {
            console.log("Already Checked")
            return false;
        } else {
            let otherButton = parent.querySelector('.btn-dark');
            otherButton?.classList.remove('btn-dark');
            otherButton?.classList.add('btn-light');
            label.classList.add('btn-dark');
            label.classList.remove('btn-light');
            return true;
        }
    }

    removeAllPlots() {
        const self = this;
        d3.select('#neighborhood_wrapper').selectAll('.barchart, .scatter_canvas, .parallel_coords, .parallel-canvas, #heatmap-svg, #summary_div_barchart_svg, .tooltip, #legend-svg').remove();
        document.getElementById("summary_div").style.display = "none";
        document.getElementById("comparison_grid").style.display = null;
        self.plots = [];
    }

    initSmallMultipleParallelCoordinates() {
        const self = this;
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`compare_col_${i}`);
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            console.log(document.getElementById(`compare_parallel_coordinates_${i}`).getBoundingClientRect());
            let pc = new ParallelCoordinates(`compare_parallel_coordinates_${i}`, self.dataLayer, self.eventHandler, self.colorScheme, true);
            pc.init();
            return pc;
        });
        self.wrangleSmallMultiples();
    }

    createGrid(cols = 2) {
        const self = this;
        //Clear previous
        d3.selectAll('.compare_row').remove()
        let width = self.container.getBoundingClientRect().width;
        // let cols = 1;//Math.floor(width / 180);
        // let rows = 2;
        let rows = 4;
        //HEATMAP
        // let rows = 2;
        let i = 0;
        self.container.style.height = rows * self.rowHeight;
        _.each(_.range(rows), r => {
            let row = document.createElement("div");
            row.className = "row compare_row";
            row.id = `compare_row_${r}`;
            row.style.height = `${self.rowHeight}px`;
            row.style.width = `${width}px`;
            _.each(_.range(cols), c => {
                let col = document.createElement("div");
                col.className = "col compare_col";
                col.id = `compare_col_${i}`;
                row.appendChild(col);
                let compare_plot_title = document.createElement("div");
                compare_plot_title.className = "row compare_plot_title justify-content-center";
                let title = document.createElement("h5");
                // HEATMAP
                // if (i === 1) {
                //     title.classList.add('current_selection_comparison');
                // }
                compare_plot_title.appendChild(title);
                col.appendChild(compare_plot_title);
                let compare_plot_body = document.createElement("div");
                compare_plot_body.id = `compare_parallel_coordinates_${i}`
                compare_plot_body.className = "row compare_plot_body";
                col.appendChild(compare_plot_body);
                i++;
            })
            self.container.appendChild(row);

        })
    }

    wrangleSmallMultiples(order = null, scatterplot = false) {
        const self = this;
        _.each(self.plots, (plot, i) => {
            let plotData;
            if (self.currentState == 'scatterplot') {
                plotData = _.get(self.neighborhoods[i], 'cells', []);
            } else if (self.currentState == 'image') {
                plotData = self.relatedImageData[i][1];

            } else {
                plotData = _.get(self.neighborhoods[i], 'cluster_summary.weighted_contribution', []);
            }
            plot.wrangle(plotData, order);
        });
    }

    initSmallMultipleBarcharts() {
        const self = this;
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`compare_col_${i}`);
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            let barchart = new Barchart(`compare_parallel_coordinates_${i}`, self.dataLayer.phenotypes);
            barchart.init();
            return barchart;
        });
        self.wrangleSmallMultiples();
    }

    initSmallMultipleScatterplots() {
        const self = this;
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`compare_col_${i}`)
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            let canvas_div = document.getElementById(`compare_parallel_coordinates_${i}`);
            let canvas = document.createElement("canvas");
            canvas.className = 'scatterplot scatter_canvas';
            canvas.id = `compare_col_canvas_${i}`;
            canvas.width = canvas_div.offsetWidth;
            canvas.height = canvas_div.offsetHeight;
            canvas_div.appendChild(canvas);
            let spatialPlot = new Scatterplot(`compare_parallel_coordinates_${i}`, `compare_col_canvas_${i}`, self.eventHandler, self.dataLayer,
                null, true, false, datasource);
            spatialPlot.init();
            return spatialPlot;
        });
        self.wrangleSmallMultiples();
    }

    initHeatmap() {
        const self = this;
        let plotNames = ['overall', 'selected']
        self.plots = _.map(plotNames, (d, i) => {
            let div = document.getElementById(`compare_col_${i}`)
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'] || _.capitalize(d);
            let canvas_div = document.getElementById(`compare_parallel_coordinates_${i}`);
            let heatmap = new Heatmap(`compare_parallel_coordinates_${i}`, self.dataLayer, d, self.eventHandler);
            heatmap.init();
            return heatmap;
        })
    }

    initStackedBarchart() {
        const self = this;
        let stacked = new StackedBarchart(`summary_div`, self.dataLayer, self.colorScheme, self.neighborhoods);
        let legend = new Legend(self.dataLayer, self.colorScheme, self.eventHandler);
        legend.draw();
        stacked.init();
    }

    async initImages() {
        const self = this;
        self.relatedImageData = await self.dataLayer.getRelatedImageData()
        let tempImageData = []
        self.plots = _.map(Object.entries(self.relatedImageData), ([k, v], i) => {
            tempImageData.push([k, v]);
            let div = document.getElementById(`compare_col_${i}`)
            let header = div.querySelector('h5').innerHTML = k;
            let canvas_div = document.getElementById(`compare_parallel_coordinates_${i}`);
            let canvas = document.createElement("canvas");
            canvas.className = 'scatterplot scatter_canvas';
            canvas.id = `compare_col_canvas_${i}`;
            canvas.width = canvas_div.offsetWidth;
            canvas.height = canvas_div.offsetHeight;
            canvas_div.appendChild(canvas);
            let imagePlot = new Scatterplot(`compare_parallel_coordinates_${i}`, `compare_col_canvas_${i}`, self.eventHandler, self.dataLayer,
                null, true, true, k);
            imagePlot.init();
            return imagePlot;
        });
        self.relatedImageData = tempImageData;
        self.wrangleSmallMultiples();
    }


    rewrangle() {
        const self = this;
        if (!self.hidden) {
            self.plots[0].rewrangle();
        }

    }

}




