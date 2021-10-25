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
        this.phenotypes = [];
        this.phenotypeColumnName = '';
        this.phenotypeDescription = '';
    }

    async init() {
        try {
            document.body.style.cursor = 'wait';
            let response = await fetch('/init_database?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            this.phenotypes = await this.getPhenotypes();
            this.phenotypeColumnName = await this.getPhenotypeColumnName();
            this.phenotypeDescription = await this.getPhenotypeDescription();
            document.body.style.cursor = 'default';
            // fetch('/start_spatial_correlation').then(() => {
            // }).catch(err => console.log(err))

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

    async getCellIdsPhenotype(sels) {
        try {
            let response = await fetch('/get_cell_ids_phenotype?' + new URLSearchParams({
                filter: JSON.stringify(sels),
                datasource: datasource
            }))
            let cellIds = await response.json();
            return cellIds;
        } catch (e) {
            console.log("Error Getting Channel Cell Ids", e);
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

    async getPhenotypeColumnName() {
        if (this.phenotypeColumnName != '') {
            return this.phenotypeColumnName;
        }
        try {
            let response = await fetch('/get_phenotype_column_name?' + new URLSearchParams({
                datasource: datasource,
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Sample Row", e);
        }
    }

    async getPhenotypeDescription() {
        if (this.phenotypeDescription != '') {
            return this.phenotypeDescription;
        }
        try {
            let response = await fetch('/get_phenotype_description?' + new URLSearchParams({
                datasource: datasource,
            }))
            let response_data = await response.json();
            return new Map(response_data);
        } catch (e) {
            console.log("Error Getting Sample Row", e);
        }
    }

    //helper function
    getNameForPhenotypeId(id) {
        if (this.phenotypeDescription != '' && this.phenotypeDescription != undefined) {
            if (this.phenotypeDescription.has(id)) {
                return this.phenotypeDescription.get(id);
            }
        }
        return id;
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

    async getDatabaseDescription() {
        try {
            let response = await fetch('/get_database_description?' + new URLSearchParams({
                datasource: datasource
            }))
            let description = await response.json();
            return description;
        } catch (e) {
            console.log("Error Getting DB Description", e);
        }
    }

    async getPhenotypes() {
        try {
            let response = await fetch('/get_phenotypes?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Phenotypes", e);
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

    async getNeighborhoodForSpatialCorrelation(maxDistance, x, y) {
        try {
            let response = await fetch('/get_neighborhood_for_spat_corr?' + new URLSearchParams({
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

    async getKResultsForSpatialCorrelation(maxDistance, x, y, channels) {
        try {
            let response = await fetch('/get_k_results_for_spat_corr?' + new URLSearchParams({
                max_distance: maxDistance,
                point_x: x,
                point_y: y,
                channels,
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
        // TODO - this is now using csv's original id rather than our placed id - jj
        this.currentSelection.set(item[config.featureData[0].idField], item);

        // console.log('current selection size:', this.currentSelection.size);
        if (this.currentSelection.size > 0) {
            // console.log('id: ', this.currentSelection.values().next().value.id);
        }
    }


    addAllToCurrentSelection(items, allowDelete, clearPriors) {
        // console.log("update current selection")
        var that = this;
        // TODO - this is now using csv's original id rather than our placed id - jj
        that.currentSelection = new Map(items.map(i => [(i[config.featureData[0].idField]), i]));
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

    // async getHistogramComparison(maxDistance, x, y, channels) {
    //     try {
    //         let response = await fetch('/get_histogram_comparison2?' + new URLSearchParams({
    //             point_x: x,
    //             point_y: y,
    //             max_distance: maxDistance,
    //             channels: channels,
    //             datasource: datasource
    //         }))
    //         return await response.json();
    //     } catch (e) {
    //         console.log("Error getting histogram comparison", e);
    //     }
    // }

    async getHistogramComparison(datasource, channels, x, y, maxDistance, viewportBounds, zoomlevel, sensitivity) {
        try {
            let response = await fetch('/histogram_comparison?' +
                new URLSearchParams({
                    point_x: x,
                    point_y: y,
                    max_distance: maxDistance,
                    channels: channels,
                    datasource: datasource,
                    viewport: [viewportBounds[0].x, viewportBounds[0].y, viewportBounds[1].x, viewportBounds[1].y],
                    zoomlevel: zoomlevel,
                    sensitivity: sensitivity
                }));
            return await response.json();
        } catch (e) {
            console.log("Error getting histogram comparison", e);
        }
    }

    async getHistogramComparisonSimMap(datasource, channels, x, y, maxDistance, viewportBounds, zoomlevel, sensitivity) {
        try {
            let response = await fetch('/histogram_comparison_simmap?' +
                new URLSearchParams({
                    point_x: x,
                    point_y: y,
                    max_distance: maxDistance,
                    channels: channels,
                    datasource: datasource,
                    viewport: [viewportBounds[0].x, viewportBounds[0].y, viewportBounds[1].x, viewportBounds[1].y],
                    zoomlevel: zoomlevel,
                    sensitivity: sensitivity
                }));
            return await response.json();
        } catch (e) {
            console.log("Error getting histogram comparison", e);
        }
    }

    async saveDot(data) {

        try {
            let imageData = {
                'height': data.imageData.height,
                'width': data.imageData.width,
                'data': Array.from(data.imageData.data)
            }
            let response = await fetch('/save_dot', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify(
                    {
                        datasource: datasource,
                        dot: {
                            'id': data.id,
                            'name': data.name || '',
                            'description': data.description || '',
                            group: data.group || '',
                            shape_type: data.lensShape || '',
                            shape_info: {
                                radius: data.lensRadius || '',
                                x: data.pointerOsdRefPointX || '',
                                y: data.pointerOsdRefPointY || '',
                            },
                            cell_ids: [], // Hook this up if we're actually saving something here
                            // This doesn't seem to be working, both arrays are empty
                            viewer_info: {
                                x: data.pointerPositionOnFullImage[0],
                                y: data.pointerPositionOnFullImage[1],
                                zoomViewerAuxi: data.zoomViewerAuxi,
                                zoomViewerAuxiDisplay: data.zoomViewerAuxiDisplay,
                                zoomViewerMain: data.zoomViewerMain,
                                zoomViewerMainDisplay: data.zoomViewerMainDisplay,
                            },
                            channel_info: {
                                channel_color_schemes: {},
                                channel_intensities: {},
                                channelsViewerAuxi: data.channelsViewerAuxi || [],
                                channelsViewerMain: data.channelsViewerMain || [],
                            },
                            image_data: imageData,
                            date: data.date
                        }
                    })
            });
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Saving Dot", e);
        }
    }

    async loadDots() {
        try {
            let response = await fetch('/load_dots?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            let dots = _.map(response_data, dot => {
                let obj = {
                    channelsViewerAuxi: dot.channel_info.channelsViewerAuxi || [],
                    channelsViewerMain: dot.channel_info.channelsViewerMain || [],
                    date: new Date(dot.date),
                    description: dot.description,
                    name: dot.name,
                    id: dot.id,
                    lensRadius: dot.shape_info.radius,
                    lensShape: dot.shape_type,
                    pointerOsdRefPointX: dot.shape_info.x,
                    pointerOsdRefPointY: dot.shape_info.y,
                    pointerPositionOnFullImage: [dot.viewer_info.x, dot.viewer_info.y],
                    zoomViewerAuxi: dot.viewer_info.zoomViewerAuxi,
                    zoomViewerAuxiDisplay: dot.viewer_info.zoomViewerAuxiDisplay,
                    zoomViewerMain: dot.viewer_info.zoomViewerMain,
                    zoomViewerMainDisplay: dot.viewer_info.zoomViewerMainDisplay,
                    fromDb: true
                }
                let imageData = new ImageData(new Uint8ClampedArray(dot.image_data.data), dot.image_data.width, dot.image_data.height);
                obj.imageData = imageData;
                return obj;
            })
            return dots;
        } catch (e) {
            console.log("Error Loading Dots", e);
        }
    }

    async deleteDot(id) {
        try {
            let response = await fetch('/delete_dot?' + new URLSearchParams({
                datasource: datasource,
                id: id
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error deleting Dots", e);
        }
    }
}
