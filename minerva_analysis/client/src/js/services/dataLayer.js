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
    }

    async init() {
        try {
            await fetch('/init_database?' + new URLSearchParams({
                datasource: datasource
            }))

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

    async getUploadedGatingCsvValues() {
        try {
            let response = await fetch('/get_uploaded_gating_csv_values?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Uploaded Gates", e);
        }
    }

    async getSavedGatingList() {
        try {
            let response = await fetch('/get_saved_gating_list?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Saved Gating List", e);
        }
    }

    async getUploadedChannelCsvValues() {
        try {
            let response = await fetch('/get_uploaded_channel_csv_values?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Uploaded Channels", e);
        }
    }

    async getSavedChannelList() {
        try {
            let response = await fetch('/get_saved_channel_list?' + new URLSearchParams({
                datasource: datasource
            }))
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Getting Saved Channel List", e);
        }
    }

    downloadGatingCSV(channels, selections, lassos, selection_ids, fullCsv = false) {
        let form = document.createElement("form");
        form.action = "/download_gating_csv";

        form.method = "post";

        let filename = '';
        if (!fullCsv) {
            filename = document.getElementById('download_input1').value;
        }else{
            filename = document.getElementById('download_input2').value;
        }
        let fileNameElemment = document.createElement("input");
        fileNameElemment.type = "hidden";
        fileNameElemment.value = _.toString(filename);
        fileNameElemment.name = "filename";
        form.appendChild(fileNameElemment);

        let fullCsvElemment = document.createElement("input");
        fullCsvElemment.type = "hidden";
        fullCsvElemment.value = _.toString(fullCsv);
        fullCsvElemment.name = "fullCsv";
        form.appendChild(fullCsvElemment);

        let encoding = document.getElementById('encoding').value;
        let encodingElement = document.createElement("input");
        encodingElement.type = "hidden";
        encodingElement.value = _.toString(encoding);
        encodingElement.name = "encoding";
        form.appendChild(encodingElement);

        let selectionsElement = document.createElement("input");
        selectionsElement.type = "hidden";
        selectionsElement.value = JSON.stringify(selections);
        selectionsElement.name = "filter";
        form.appendChild(selectionsElement);

        let channelsElement = document.createElement("input");
        channelsElement.type = "hidden";
        channelsElement.value = JSON.stringify(channels);
        channelsElement.name = "channels";
        form.appendChild(channelsElement);

        let lassosElement = document.createElement("input");
        lassosElement.type = "hidden";
        lassosElement.value = JSON.stringify(lassos);
        lassosElement.name = "lassos";
        form.appendChild(lassosElement);

        let idsElement = document.createElement("input");
        idsElement.type = "hidden";
        idsElement.value = JSON.stringify(selection_ids);
        idsElement.name = "selection_ids";
        form.appendChild(idsElement);

        let datasourceElement = document.createElement("input");
        datasourceElement.type = "hidden";
        datasourceElement.value = datasource;
        datasourceElement.name = "datasource";
        form.appendChild(datasourceElement);

        document.body.appendChild(form);
        form.submit()
    }

    async saveGatingList(channels, selections, lassos) {
        const self = this;
        try {
            let response = await fetch('/save_gating_list', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        datasource: datasource,
                        filter: selections,
                        channels: channels,
                        lassos: lassos
                    }
                )
            });
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Saving Gating List", e);
        }
    }

    downloadChannelsCSV(map_channels, active_channels, list_colors, list_ranges, list_channels) {
        let form = document.createElement("form");
        form.action = "/download_channels_csv";

        form.method = "post";

        let filename = datasource + '_channel_list';
        let fileNameElemment = document.createElement("input");
        fileNameElemment.type = "hidden";
        fileNameElemment.value = _.toString(filename);
        fileNameElemment.name = "filename";
        form.appendChild(fileNameElemment);

        let mapElement = document.createElement("input");
        mapElement.type = "hidden";
        mapElement.value = JSON.stringify(map_channels);
        mapElement.name = "map_channels";
        form.appendChild(mapElement);

        let activeElement = document.createElement("input");
        activeElement.type = "hidden";
        activeElement.value = JSON.stringify(active_channels);
        activeElement.name = "active_channels";
        form.appendChild(activeElement);

        let colorsElement = document.createElement("input");
        colorsElement.type = "hidden";
        colorsElement.value = JSON.stringify(list_colors);
        colorsElement.name = "list_colors";
        form.appendChild(colorsElement);

        let rangesElement = document.createElement("input");
        rangesElement.type = "hidden";
        rangesElement.value = JSON.stringify(list_ranges);
        rangesElement.name = "list_ranges";
        form.appendChild(rangesElement);

        let channelsElement = document.createElement("input");
        channelsElement.type = "hidden";
        channelsElement.value = JSON.stringify(list_channels);
        channelsElement.name = "list_channels";
        form.appendChild(channelsElement);

        let datasourceElement = document.createElement("input");
        datasourceElement.type = "hidden";
        datasourceElement.value = datasource;
        datasourceElement.name = "datasource";
        form.appendChild(datasourceElement);
        document.body.appendChild(form);
        form.submit()
    }

    async saveChannelList(map_channels, active_channels, list_colors, list_ranges, list_channels) {
        const self = this;
        try {
            let response = await fetch('/save_channel_list', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        datasource: datasource,
                        map_channels: map_channels,
                        active_channels: active_channels,
                        list_colors: list_colors,
                        list_ranges: list_ranges,
                        list_channels: list_channels
                    }
                )
            });
            let response_data = await response.json();
            return response_data;
        } catch (e) {
            console.log("Error Saving Channel List", e);
        }
    }

    async getColumnDistributions(columns) {
        try {
            let response = await fetch('/get_column_distributions?' + new URLSearchParams({
                columns: columns,
                datasource: datasource
            }))
            let distributions = await response.json();
            return distributions;
        } catch (e) {
            console.log("Error Getting Nearest Cell", e);
        }
    }

    async submitGatingUpload(formData) {
        try {
            formData.append('datasource', datasource);
            let response = await fetch('/upload_gates', {
                method: "POST",
                body: formData
            })
            let cell = await response.json();
            return cell;
        } catch (e) {
            console.log("Error Getting Submitting Form Upload", e);
        }
    }

    async submitChannelUpload(formData) {
        try {
            formData.append('datasource', datasource);
            let response = await fetch('/upload_channels', {
                method: "POST",
                body: formData
            })
            let cell = await response.json();
            return cell;
        } catch (e) {
            console.log("Error Getting Submitting Form Upload", e);
        }
    }

    async getAllCells(start_keys, use_integer) {
        const dtype = use_integer ? 'integer' : 'float'
        const base_url = `/get_all_cells/${dtype}/?`
        try {
            const headers = new Headers();
            headers.append("Content-Type","application/octet-stream");
            headers.append("Content-Encoding","gzip");
            const response = await fetch(base_url + new URLSearchParams({
                start_keys: start_keys,
                datasource: datasource
            }), {
                headers: headers
            })
            return response.arrayBuffer();
        } catch (e) {
            console.log("Error Getting Gated Cell Ids", e);
        }
    }

    async getGatedCellIds(filter, start_keys) {
        try {
            let response = await fetch('/get_gated_cell_ids?' + new URLSearchParams({
                filter: JSON.stringify(filter),
                start_keys: start_keys,
                datasource: datasource
            }))
            let cellIds = await response.json();
            return cellIds;
        } catch (e) {
            console.log("Error Getting Gated Cell Ids", e);
        }
    }

    async getGatedCellIdsCustom(filter, start_keys) {
        try {
            // const start = performance.now()
            let response = await fetch('/get_gated_cell_ids_custom?' + new URLSearchParams({
                filter: JSON.stringify(filter),
                start_keys: start_keys,
                datasource: datasource
            }))
            let cellIds = await response.json();
            // const end = performance.now()
            // console.log(end - start)
            // console.log(cellIds)
            return cellIds;
        } catch (e) {
            console.log("Error Getting Gated Cell Ids", e);
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

    async getChannelGMM(channel) {
        try {
            let response = await fetch('/get_channel_gmm?' + new URLSearchParams({
                channel: channel,
                datasource: datasource
            }))
            let packet_gmm = await response.json();
            return packet_gmm;
        } catch (e) {
            console.log("Error Getting Channel GMM", e);
        }
    }

    async getGatingGMM(channel, selection_ids) {
        try {
            let response = await fetch('/get_gating_gmm', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        channel: channel,
                        datasource: datasource,
                        selection_ids: selection_ids
                    }
                )
            });
            let packet_gmm = await response.json();
            return packet_gmm;
        } catch (e) {
            console.log("Error Getting Gating GMM", e);
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
        this.currentSelection.set(item[this.config.featureData[0].idField], item);

        // console.log('current selection size:', this.currentSelection.size);
        if (this.currentSelection.size > 0) {
            // console.log('id: ', this.currentSelection.values().next().value.id);
        }
    }


    addAllToCurrentSelection(items, allowDelete, clearPriors) {
        // console.log("update current selection")
        var that = this;
        let idField = this.config.featureData[0].idField
        that.currentSelection = new Map(items.map(i => [(i[idField]), i]));
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

    /**
     * whether the current data is log transformed or not
     * @returns {boolean}
     */
    isTransformed(){
      if (this.config["featureData"][0]["isTransformed"]  !== undefined &&
          this.config["featureData"][0]["isTransformed"] == true){
          return true;
      }
      return false;
    }

     async getCellsInPolygon(points) {
        try {
            let response = await fetch('/get_cells_in_polygon', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        datasource: datasource,
                        points: points,
                    }
                )
            });
            let cells = await response.json();
            return cells;
        } catch (e) {
            console.log("Error Getting Polygon Cells", e);
        }
    }

    async getCellsInLassos(list_lassos) {
        try {
            let response = await fetch('/get_cells_in_lassos', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(
                    {
                        datasource: datasource,
                        list_lassos: list_lassos,
                    }
                )
            });
            let cells = await response.json();
            return cells;
        } catch (e) {
            console.log("Error Getting Cells in Lassos", e);
        }
    }

}
