class Comparison {
    constructor(_config, _colorScheme, _dataLayer, _eventHandler, _containerId, _drawOnInit = false, suggestedColumns = null, _currentState = '', dropdownId = null) {
        this.config = _config;
        this.colorScheme = _colorScheme;
        this.dataLayer = _dataLayer;
        this.eventHandler = _eventHandler;
        this.containerId = _containerId;
        this.currentState = _currentState;
        this.plots = []
        this.neighborhoods = null;
        this.container = null;
        this.hidden = true;
        this.drawOnInit = _drawOnInit;
        this.columns = suggestedColumns;
        this.order = []
        if (this.columns) {
            let totalContainerWidth = document.getElementById(this.containerId).offsetWidth;
            while (totalContainerWidth / this.columns <= 200) {
                this.columns--;
            }
        }
        if (dropdownId) {
            this.dropdownId = dropdownId;
            this.initDropdown();
        }

    }

    async init() {
        const self = this;
        self.container = document.getElementById(self.containerId);
        self.neighborhoods = await self.dataLayer.getAllNeighborhoodStats();
        // self.neighborhoods = [t[6], t[7], t[8], t[9], t[0], t[1]]
        self.neighborhoods = self.neighborhoods.map((e, i) => {
            e.neighborhood_name = e.neighborhood_name || 'Cluster ' + i;
            return e
        })
        console.log('Compare Ready');
        if (self.drawOnInit) {
            self.draw();
        }

    }

    initDropdown() {
        const self = this;
        d3.select(`#${self.dropdownId}`).selectAll('a.dropdown-item')
            .on('click', self.reorder.bind(self))
    }

    reorder(e) {
        const self = this;
        //Swap Two Elements
        const swap = function (nodeA, nodeB) {
            const parentA = nodeA.parentNode;
            const siblingA = nodeA.nextSibling === nodeB ? nodeA : nodeA.nextSibling;
            // Move `nodeA` to before the `nodeB`
            nodeB.parentNode.insertBefore(nodeA, nodeB);
            // Move `nodeB` to before the sibling of `nodeA`
            parentA.insertBefore(nodeB, siblingA);
        };
        const sortBy = e.currentTarget.innerText;
        let currentOrder = self.plots.map(e => {
            return {
                'dataset': e?.dataset,
                'pValue': self.dataLayer.getCurrentRawSelection()[e?.dataset]['p_value'],
                'numResults': self.dataLayer.getCurrentRawSelection()[e?.dataset]['num_results']
            }
        })
        let newOrder = _.cloneDeep(currentOrder).sort(function (x, y) {
            if (sortBy == 'Significance') {
                return x.pValue - y.pValue || y.numResults - x.numResults;
            } else if (sortBy == 'Number of Results') {
                return y.numResults - x.numResults || x.pValue - y.pValue;
            } else {
                return x.dataset.localeCompare(y.dataset);
            }
        });
        newOrder.forEach((a, indexA) => {
            let indexB = currentOrder.findIndex(b => {
                return a.dataset == b.dataset
            })
            if (indexA == indexB) {
                return
            }
            [currentOrder[indexB], currentOrder[indexA]] = [currentOrder[indexA], currentOrder[indexB]];
            [self.plots[indexB], self.plots[indexA]] = [self.plots[indexA], self.plots[indexB]];
            let nodeA = d3.select(`#${self.containerId}_compare_col_${indexA} .grid-wrapper`).node()
            let nodeB = d3.select(`#${self.containerId}_compare_col_${indexB} .grid-wrapper`).node()
            swap(nodeA, nodeB);
        })


    }

    draw() {
        const self = this;
        this.hidden = !this.hidden;
        if (!this.hidden) {
            // let parentHeight = document.getElementById('comparison_container').clientHeight;
            // self.rowHeight = Math.round(parentHeight / 4);
            // HEATMAP
            // self.container.style.height = self.container.style.maxHeight = `${self.rowHeight}px`;
            self.initToggles();
            //HEATMAP
            self.removeAllPlots();
            // self.rowHeight = document.documentElement.clientHeight * 0.3;
            self.rowHeight = 300;
            self.initByType()
            // self.initImages();
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
            elem.onclick = async () => {
                await self.switchSmallMultipleType(elem, smallMultipleToggles);
            }
        });
    }

    initByType() {
        const self = this;
        if (self.currentState == 'barchart') {
            self.initSmallMultipleBarcharts();
        } else if (self.currentState == 'scatterplot') {
            self.initSmallMultipleScatterplots();
        } else if (self.currentState == 'heatmap') {
            self.initHeatmap();
        } else if (self.currentState == 'image') {
            self.initImages();
        }
    }

    async switchSmallMultipleType(elem, parent) {
        const self = this;
        if (elem.id == "parallel-coordinates-button") {
            if (self.selectAndUnselect(elem, parent)) {
                //Remove Bars
                await self.removeAllPlots();
                self.currentState = 'parallelCoordinates';
                self.initSmallMultipleParallelCoordinates();
            }
        } else if (elem.id == "barchart-button") {
            if (self.selectAndUnselect(elem, parent)) {
                await self.removeAllPlots();
                self.currentState = 'barchart';
                self.initSmallMultipleBarcharts();
            }

        } else if (elem.id == "scatterplot-button") {
            if (self.selectAndUnselect(elem, parent)) {
                await self.removeAllPlots();
                self.currentState = 'scatterplot';
                self.initSmallMultipleScatterplots();
            }

        } else if (elem.id == "heatmap-button") {
            if (self.selectAndUnselect(elem, parent)) {
                await self.removeAllPlots();
                self.currentState = 'heatmap';
                self.initHeatmap();
            }
        } else if (elem.id == "stacked-button") {
            if (self.selectAndUnselect(elem, parent)) {
                await self.removeAllPlots();
                self.currentState = 'stacked';

                document.getElementById("summary_div").style.display = "block";
                document.getElementById("comparison_grid").style.display = "none";
                self.initStackedBarchart();
            }
        } else if (elem.id == "image-button") {
            if (self.selectAndUnselect(elem, parent)) {
                await self.removeAllPlots();
                self.currentState = 'image';
                // self.rowHeight = document.documentElement.clientHeight * 0.4;
                // self.rowHeight = 300;
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

    async removeAllPlots() {
        const self = this;
        self.plots.forEach(plot => {
            plot?.destroy?.();
        })
        d3.select(`#${self.containerId}`).selectAll('.barchart, .scatter_canvas, .parallel_coords, .parallel-canvas, #heatmap-svg, #summary_div_barchart_svg, .tooltip, #legend-svg').remove();
        document.getElementById("summary_div").style.display = "none";
        document.getElementById("comparison_grid").style.display = null;
        self.plots = [];
    }

    initSmallMultipleParallelCoordinates() {
        const self = this;
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`${self.containerId}_compare_col_${i}`);
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            console.log(document.getElementById(`${self.containerId}_compare_parallel_coordinates_${i}`).getBoundingClientRect());
            let pc = new ParallelCoordinates(`${self.containerId}_compare_parallel_coordinates_${i}`, self.dataLayer, self.eventHandler, self.colorScheme, true);
            pc.init();
            return pc;
        });
        self.wrangleSmallMultiples();
    }

    createGrid(cols = 2, numElements) {
        const self = this;
        //Clear previous
        d3.select(`#${self.containerId}`).selectAll('.compare_row').remove()
        let width = self.container.getBoundingClientRect().width;
        let rows = Math.ceil(numElements / cols);
        //HEATMAP
        // let rows = 2;
        let i = 0;
        // self.container.style.height = rows * self.rowHeight;
        _.each(_.range(rows), r => {
            let row = document.getElementById(`compare_row_${r}`)
            if (!row) {
                row = document.createElement("div");
                row.className = "row compare_row";
                row.id = `compare_row_${r}`;
                row.style.height = `${self.rowHeight}px`;
                self.container.appendChild(row);
                row = document.getElementById(`compare_row_${r}`)
            }
            // row.style.width = `${width}px`;
            _.each(_.range(cols), c => {
                let col = document.getElementById(`${self.containerId}_compare_col_${i}`)
                if (!col) {
                    col = document.createElement("div");
                    col.className = "col compare_col";
                    col.id = `${self.containerId}_compare_col_${i}`;
                    row.appendChild(col);
                    let wrapper = document.createElement("div");
                    wrapper.className = "grid-wrapper";
                    col.appendChild(wrapper);

                    let compare_plot_title = document.createElement("div");
                    compare_plot_title.className = "row compare_plot_title justify-content-left";
                    let title = document.createElement("h5");
                    // HEATMAP
                    // if (i === 1) {
                    //     title.classList.add('current_selection_comparison');
                    // }
                    compare_plot_title.appendChild(title);
                    wrapper.appendChild(compare_plot_title);
                    let compare_plot_body = document.createElement("div");
                    compare_plot_body.id = `${self.containerId}_compare_parallel_coordinates_${i}`
                    compare_plot_body.className = "row compare_plot_body";
                    wrapper.appendChild(compare_plot_body);
                }
                i++;
            })


        })
    }

    async wrangleSmallMultiples(order = null, scatterplot = false, rewrangle = false) {
        const self = this;
        _.each(self.plots, (plot, i) => {
            let plotData;
            if (self.currentState == 'scatterplot') {
                plotData = _.get(self.neighborhoods[i], 'all_cells', null) || self.dataLayer.allCells.scatter;
                let selectionData = self.neighborhoods[i]
                plot.wrangle(plotData, {
                    'cells': selectionData.cells.map(e => e[2]),
                    'pValue': selectionData['p_value'],
                    numResults: selectionData['num_results']
                });
            } else if (self.currentState == 'image') {
                plotData = self.relatedImageData[i][1];
                plot.wrangle(plotData);
            } else {
                plotData = _.get(self.neighborhoods[i], 'composition_summary.weighted_contribution', []);
                plot.wrangle(plotData);
            }

            if (self.currentState == 'scatterplot' && mode == 'single') {

            }
        });
    }

    initSmallMultipleBarcharts() {
        const self = this;
        self.createGrid(2, _.size(self.neighborhoods));
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`${self.containerId}_compare_col_${i}`);
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];
            let barchart = new Barchart(`${self.containerId}_compare_parallel_coordinates_${i}`, self.dataLayer.phenotypes);
            barchart.init();
            return barchart;
        });
        self.wrangleSmallMultiples();
    }

    initSmallMultipleScatterplots() {
        const self = this;
        self.createGrid(2, _.size(self.neighborhoods));
        self.plots = _.map(self.neighborhoods, (d, i) => {
            let div = document.getElementById(`${self.containerId}_compare_col_${i}`)
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'];

            let canvas_div = document.getElementById(`${self.containerId}_compare_parallel_coordinates_${i}`);
            let width = canvas_div.offsetWidth;
            let height = canvas_div.offsetHeight - 20;
            // let infoSvg = document.createElement("svg");
            d3.select(canvas_div).append('svg')
                .attr("width", 200)
                .attr("height", 20)
                .attr('id', `${self.containerId}_compare_col_info_svg_${i}`);
            let canvas = document.createElement("canvas");
            canvas.className = 'scatterplot scatter_canvas';
            canvas.id = `${self.containerId}_compare_col_canvas_${i}`;
            canvas.width = canvas_div.offsetWidth;
            canvas.height = height - 50;
            canvas_div.appendChild(canvas);
            let spatialPlot = new Scatterplot(`${self.containerId}_compare_parallel_coordinates_${i}`, `${self.containerId}_compare_col_canvas_${i}`, self.eventHandler, self.dataLayer,
                null, self.colorScheme, true, false, k, `${self.containerId}_compare_col_info_svg_${i}`, width, height - 20);
            spatialPlot.init();
            return spatialPlot;
        });

        self.wrangleSmallMultiples();
    }

    initHeatmap() {
        const self = this;
        let plotNames = ['overall', 'selected'];
        // self.rowHeight = document.documentElement.clientHeight * 0.43;
        // self.rowHeight = 300;
        self.createGrid(1, 2);
        self.plots = _.map(plotNames, (d, i) => {
            let div = document.getElementById(`${self.containerId}_compare_col_${i}`)
            let header = div.querySelector('h5').innerHTML = d['neighborhood_name'] || _.capitalize(d);
            let canvas_div = document.getElementById(`${self.containerId}_compare_parallel_coordinates_${i}`);
            let heatmap = new Heatmap(`${self.containerId}_compare_parallel_coordinates_${i}`, self.dataLayer, d, self.eventHandler);
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
        self.createGrid(self.columns || 1, _.size(self.relatedImageData));
        let tempImageData = []
        self.order = []
        self.plots = _.map(Object.entries(self.relatedImageData), ([k, v], i) => {
            self.order.push(k);
            tempImageData.push([k, v]);
            let div = document.getElementById(`${self.containerId}_compare_col_${i}`)
            let header = div.querySelector('h5')
            header.innerHTML = `<a href='/${k}?applyPrevious=true&mode=single'>${k}</a>`;
            let canvas_div = document.getElementById(`${self.containerId}_compare_parallel_coordinates_${i}`);
            let width = canvas_div.offsetWidth;
            let height = canvas_div.offsetHeight - 20;
            // let infoSvg = document.createElement("svg");
            d3.select(canvas_div).append('svg')
                .attr("width", width)
                .attr("height", 20)
                .attr('id', `${self.containerId}_compare_col_info_svg_${i}`);
            let canvas = document.createElement("canvas");
            canvas.className = 'scatterplot scatter_canvas';
            canvas.id = `${self.containerId}_compare_col_canvas_${i}`;
            canvas.width = canvas_div.offsetWidth;
            canvas.height = height - 20;
            canvas_div.appendChild(canvas);


            let imagePlot = new Scatterplot(`${self.containerId}_compare_parallel_coordinates_${i}`, `${self.containerId}_compare_col_canvas_${i}`, self.eventHandler, self.dataLayer,
                null, self.colorScheme, true, true, k, `${self.containerId}_compare_col_info_svg_${i}`, width, height - 20);
            imagePlot.init();
            return imagePlot;
        });
        self.relatedImageData = tempImageData;
        self.wrangleSmallMultiples();
    }


    async rewrangle(refresh = false) {
        const self = this;
        let now = new Date().getTime();
        console.log('Rewrangling Multi')
        if (!self.hidden) {
            if (mode == 'single' || self.currentState != 'image') {
                if (refresh) {
                    self.neighborhoods = await self.dataLayer.getAllNeighborhoodStats();
                    await self.removeAllPlots();
                    self.initByType();
                }
                await self.wrangleSmallMultiples();
            } else {
                _.each(self.plots, (plot, i) => {
                    console.log('plot', new Date().getTime() - now);
                    let plotData = self.dataLayer.getCurrentSelection()[plot.dataset];
                    if (plotData) {
                        plotData = Array.from(plotData.keys());
                    } else {
                        plotData = [];
                    }
                    plot.recolor(plotData);
                })
            }
        }
    }


    changeColoring(colorByCellType) {
        const self = this;
        _.each(self.plots, (plot, i) => {
            plot?.changeColoring(colorByCellType);
        });
    }

    clear(dataset) {
        const self = this;
        _.each(self.plots, (plot, i) => {
            if (plot?.image && plot.dataset !== dataset) {
                plot.recolor([])
            }
        })
    }


}




