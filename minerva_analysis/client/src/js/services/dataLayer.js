//todo add crossfilter stuff here... build some lensingFilters and sorters for individual and combined dimensions

class DataLayer {

    constructor(config, imageChannels) {
        var that = this;
        //vars and consts
        this.config = config;
        //all image channels
        this.imageChannels = imageChannels;

        this.imageBitRange = [0, 65536];
        //selections
        this.currentSelection = new Map();
        //x,z coords
        this.x = this.config["featureData"][dataSrcIndex]["xCoordinate"];
        this.y = this.config["featureData"][dataSrcIndex]["yCoordinate"];
        this.cellGroups = [];
    }

    async init() {
        try {
            let response = await fetch('/init_database?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            this.cellGroups = await this.getCellGroups();

        } catch (e) {
            console.log("Error Initializing Dataset", e);
        }
    }

    async getRow(row) {
        try {
            let response = await fetch('/get_database_row?' + new URLSearchParams({
                row: row,
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Row", e);
        }
    }

    async getChannelCellIds(sels) {
        try {
            let response = await fetch('/get_channel_cell_ids?' + new URLSearchParams({
                filter: JSON.stringify(sels),
                datasource: datasource
            }))
            let cellIds = await response.json();
            return cellIds;
        } catch (e) {
            console.log("Error Getting Channel Cell Ids", e);
        }
    }

    async getChannelNames(shortNames = true) {
        try {
            let response = await fetch('/get_channel_names?' + new URLSearchParams({
                datasource: datasource,
                shortNames: shortNames
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Sample Row", e);
        }
    }

    async getColorScheme(refresh = false) {
        try {
            let response = await fetch('/get_color_scheme?' + new URLSearchParams({
                datasource: datasource,
                refresh: refresh
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Sample Row", e);
        }
    }

    async getCellsByCellGroup(cellGroup) {
        try {
            let response = await fetch('/get_cells_by_cell_group?' + new URLSearchParams({
                datasource: datasource,
                cellGroup: cellGroup
            }))
            let cells = await response.json();
            return cells;
        } catch (e) {
            console.log("Error Getting Cells By Cell Group", e);
        }
    }

    async getCellsInPolygon(points, similar = false, embedding = false) {
        try {
            let response = await fetch('/get_cells_in_polygon?' + new URLSearchParams({
                datasource: datasource,
                points: JSON.stringify(points),
                similar_neighborhood: similar,
                embedding: embedding
            }))
            let cells = await response.json();
            return cells;
        } catch (e) {
            console.log("Error Getting Polygon Cells", e);
        }
    }

    async getCellGroups() {
        try {
            let response = await fetch('/get_cell_groups?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Cell Groups", e);
        }
    }

    async getNearestCell(point_x, point_y) {
        try {
            let response = await fetch('/get_nearest_cell?' + new URLSearchParams({
                point_x: point_x,
                point_y: point_y,
                datasource: datasource
            }))
            let cell = await response.json();
            return cell;
        } catch (e) {
            console.log("Error Getting Nearest Cell", e);
        }
    }

    async getNeighborhood(maxDistance, x, y) {
        try {
            let response = await fetch('/get_neighborhood?' + new URLSearchParams({
                point_x: x,
                point_y: y,
                max_distance: maxDistance,
                datasource: datasource
            }))
            let neighborhood = await response.json();
            return neighborhood;
        } catch (e) {
            console.log("Error Getting Nearest Cell", e);
        }
    }

    async getNeighborhoodForCell(maxDistance, selectedCell) {
        return this.getNeighborhood(maxDistance, selectedCell[this.x], selectedCell[this.y]);
    }


    getCurrentSelection() {
        return this.currentSelection;
    }

    clearCurrentSelection() {
        this.currentSelection.clear();
    }

    getImageBitRange(float = false) {
        const self = this;
        if (!float) {
            return self.imageBitRange;
        } else {
            return [0.0, 1.0];
        }
    }

    addToCurrentSelection(item, allowDelete, clearPriors) {

        // delete item on second click
        if (allowDelete && this.currentSelection.has(item)) {
            this.currentSelection.delete(item);
            if (clearPriors) {
                this.currentSelection.clear();
            }

            // console.log('current selection size:', this.currentSelection.size);
            if (this.currentSelection.size > 0) {
                // console.log('id: ', this.currentSelection.values().next().value.id);
            }
            return;
        }

        // clear previous items
        if (clearPriors) {
            this.currentSelection.clear();
        }

        // add new item
        this.currentSelection.set(item.id, item);

        // console.log('current selection size:', this.currentSelection.size);
        if (this.currentSelection.size > 0) {
            // console.log('id: ', this.currentSelection.values().next().value.id);
        }
    }


    addAllToCurrentSelection(items, allowDelete, clearPriors) {
        // console.log("update current selection")
        var that = this;
        that.currentSelection = new Map(_.get(items, 'cells', items).map(i => [i.CellID - 1 || i.id, i]));
        that.currentRawSelection = items;
        // console.log("update current selection done")
    }

    isImageFeature(key) {
        if (this.imageChannels.hasOwnProperty(key)
            && key != 'CellId' && key != 'id' && key != 'CellID' && key != 'ID' && key != 'Area') {
            return true;
        }
        return false;
    }

    getShortChannelName(fullname) {
        var shortname = fullname;
        this.config["imageData"].forEach(function (channel) {
            if (channel.fullname == fullname) {
                shortname = channel.name;
            }
        });
        return shortname;
    }

    getFullChannelName(shortname) {
        var fullname = shortname;
        this.config["imageData"].forEach(function (channel) {
            if (channel.name == shortname) {
                fullname = channel.fullname;
            }
        });
        return fullname;
    }

    async getMetadata() {
        try {
            let response = await fetch('/get_ome_metadata?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Metadata", e);
        }
    }

    async getScatterplotData() {
        try {
            let response = await fetch('/get_scatterplot_data?' + new URLSearchParams({
                datasource: datasource
            }))
            let scatterplotData = await response.json();
            return scatterplotData;
        } catch (e) {
            console.log("Error Getting Nearest Cell", e);
        }
    }

    async getCells(ids) {
        try {
            let response = await fetch('/get_cells', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        datasource: datasource,
                        elem: {
                            'ids': ids.points
                        }
                    })
            });
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Cells", e);
        }
    }

}
