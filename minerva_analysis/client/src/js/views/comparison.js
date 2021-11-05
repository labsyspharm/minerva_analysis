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
        this.firstDraw = true;
    }

    async init() {
        const self = this;
        // self.container = document.getElementById('comparison_grid');
        self.pinnedContainer = document.getElementById('pinned_comparison_grid');
        self.neighborhoods = await self.dataLayer.getAllNeighborhoodStats();
        console.log('Compare Ready');

    }

    draw() {
        const self = this;
        this.hidden = !this.hidden;
        if (!this.hidden) {
            let parentHeight = document.getElementById('comparison_container').clientHeight;
            self.rowHeight = Math.round(parentHeight / 2);
            self.pinnedContainer.style.height = self.pinnedContainer.style.maxHeight = `${self.rowHeight * 2}px`;
            // self.container.style.height = self.container.style.maxHeight = `${self.rowHeight}px`;
            if (self.firstDraw) {
                self.createGrid();
                // self.initToggles();
                self.firstDraw = false;
            }
            console.log('Drawing');
            self.initHeatmap();
        } else {
            self.removeAllPlots();
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
                document.getElementById("comparison_div_parent").style.display = "none";
                self.initStackedBarchart();
            }
        }
    }

    selectAndUnselect(elem, parent) {
        const self = this;
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

    removeAllPlots() {
        const self = this;
        d3.select('#neighborhood_wrapper').selectAll('.barchart, .scatter_canvas, .parallel_coords, .parallel-canvas, #heatmap-svg, #summary_div_barchart_svg, .tooltip, #legend-svg').remove();
        document.getElementById("summary_div").style.display = "none";
        document.getElementById("comparison_div_parent").style.display = "flex";
        self.plots = [];
    }

    initSmallMultipleParallelCoordinates() {
        const self = this;
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`compare_col_${i}`);
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            console.log(document.getElementById(`compare_parallel_coordinates_${i}`).getBoundingClientRect());
            let pc = new ParallelCoordinates(`compare_parallel_coordinates_${i}`, self.dataLayer, self.eventHandler, true);
            pc.init();
            return pc;
        });
        self.wrangleSmallMultiples();
    }

    createGrid() {
        const self = this;
        // let width = self.container.getBoundingClientRect().width;
        let cols = 1;//Math.floor(width / 180);
        // let rows = Math.ceil(_.size(self.neighborhoods) / cols);
        let rows = 2;
        let i = 0;
        _.each(_.range(rows), r => {
            let row = document.createElement("div");
            row.className = "row compare_row";
            row.id = `compare_row_${r}`;
            row.style.height = `${self.rowHeight}px`;
            _.each(_.range(cols), c => {
                let col = document.createElement("div");
                col.className = "col compare_col";
                col.id = `compare_col_${i}`;
                row.appendChild(col);
                let compare_plot_title = document.createElement("div");
                compare_plot_title.className = "row compare_plot_title justify-content-center";
                let title = document.createElement("h5");
                if (i === 1) {
                    title.classList.add('current_selection_comparison');
                }
                compare_plot_title.appendChild(title);
                col.appendChild(compare_plot_title);
                let compare_plot_body = document.createElement("div");
                compare_plot_body.id = `compare_parallel_coordinates_${i}`
                compare_plot_body.className = "row compare_plot_body";
                col.appendChild(compare_plot_body);
                i++;
            })
            if (i <= 2) {
                self.pinnedContainer.appendChild(row);
            } else {
                self.container.appendChild(row);
            }
        })

        let test = '';
    }

    wrangleSmallMultiples(order = null, scatterplot = false) {
        const self = this;
        _.each(self.plots, (plot, i) => {
            let plotData;
            if (self.currentState == 'scatterplot') {
                plotData = _.get(self.neighborhoods[i], 'cells', []);
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
            scatterplot = new Scatterplot(`compare_parallel_coordinates_${i}`, `compare_col_canvas_${i}`, self.eventHandler, self.dataLayer);
            scatterplot.init();
            return scatterplot;
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
            let heatmap = new Heatmap(`compare_parallel_coordinates_${i}`, self.dataLayer, d);
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

}




