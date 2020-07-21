//todo add crossfilter stuff here... build some filters and sorters for individual and combined dimensions

class DataFilter {

    constructor(config, imageChannels) {
        var that = this;
        //vars and consts
        this.config = config;
        //all image channels
        this.imageChannels = imageChannels;
        //selections
        this.currentSelection = new Set();
        //x,z coords
        this.x = this.config["featureData"][dataSrcIndex]["xCoordinate"];
        this.y = this.config["featureData"][dataSrcIndex]["yCoordinate"];
        this.init();
    }

    async init() {
        let response = await fetch('/init_database?' + new URLSearchParams({
            datasource: 'melanoma'
        }))
        let response_data = await response.json();
        return response_data;
    }

    async getRow(row) {
        let response = await fetch('/get_database_row?' + new URLSearchParams({
            row: row,
            datasource: 'melanoma'
        }))
        let response_data = await response.json();
        return response_data;

    }

    async findNearestCell(point_x, point_y, max_distance = 100) {
        let response = await fetch('/get_nearest_cell?' + new URLSearchParams({
            point_x: point_x,
            point_y: point_y,
            max_distance: max_distance,
            datasource: 'melanoma'
        }))
        let cell = await response.json();
        return cell;
    }


    getCurrentSelection() {
        return this.currentSelection;
    }

    clearCurrentSelection() {
        this.currentSelection.clear();
    }


    addToCurrentSelection(item, allowDelete, clearPriors) {

        // delete item on second click
        if (allowDelete && this.currentSelection.has(item)) {
            this.currentSelection.delete(item);
            if (clearPriors) {
                this.currentSelection.clear();
            }

            console.log('current selection size:', this.currentSelection.size);
            if (this.currentSelection.size > 0) {
                console.log('id: ', this.currentSelection.values().next().value.id);
            }
            return;
        }

        // clear previous items
        if (clearPriors) {
            this.currentSelection.clear();
        }

        // add new item
        this.currentSelection.add(item);

        console.log('current selection size:', this.currentSelection.size);
        if (this.currentSelection.size > 0) {
            console.log('id: ', this.currentSelection.values().next().value.id);
        }
    }


    addAllToCurrentSelection(items, allowDelete, clearPriors) {
        console.log("update current selection")
        var that = this;
        that.currentSelection = new Set(items);
        console.log("update current selection done")
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

}
