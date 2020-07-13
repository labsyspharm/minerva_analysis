//todo add crossfilter stuff here... build some filters and sorters for individual and combined dimensions

class DataFilter {

    constructor(config, data, imageChannels) {

        var that = this;

        //vars and consts
        this.config = config;

        //all image channels
        this.imageChannels = imageChannels;

        //selections
        this.currentSelection = new Set();


        //prefilter data
        this.map = new Map(); //hm maybe use a map, too..
        this.setData(data);

        //x,z coords
        this.x = this.config["featureData"][dataSrcIndex]["xCoordinate"];
        this.y = this.config["featureData"][dataSrcIndex]["yCoordinate"];

        // initialize quadtree
        this.quadTree = this.initQuadTree();

        //init data structure tree
        this.treeModel = null;
        this.tree = this.initTree();
        this.setActiveNode(this.tree, false);
        //this.addToTreeForTestPuprose(); //was to construct a test tree..
        console.log('tree insertion done');

        this.featureSelection = new Set();

        //class label id (starts at 0 with first class user defines)
        this.classLabelId = 0;

    }

    getMin(attribute) {
        //var copy = this.getData().slice(0);
        return this.getData().reduce((min, d) => d[attribute] < min ? d[attribute] : min, this.getData()[0][attribute]);
    }

    getMax(attribute) {
        //var copy = this.getData().slice(0);
        return this.getData().reduce((max, d) => d[attribute] > max ? d[attribute] : max, this.getData()[0][attribute]);
    }

    //some initial data parsing from string to float and adding additional fields
    wrangleData(data) {
        console.log('data wrangling')
        var that = this;
        this.MaxVals = new Map();
        this.MinVals = new Map();

        this.totalMax = -10000000;
        this.totalMin = 1000000;

        let columns = Object.keys(data[0]).filter(key => key != 'id' && key != 'cluster');

        columns.forEach(function (column) {
            that.MinVals.set(column, that.getMin(column));
            that.MaxVals.set(column, that.getMax(column));
        });

        that.MaxVals.forEach(function (d, key) {
            if (that.isImageFeature(key)) {
                if (!isNaN(d)) {
                    that.totalMax = Math.max(d, that.totalMax);
                }
            }
        })

        that.MinVals.forEach(function (d, key) {
            if (that.isImageFeature(key)) {
                if (!isNaN(d)) {
                    that.totalMin = Math.min(d, that.totalMin);
                }
            }
        })
        return data;
    }

    getMaxVal(column) {
        return this.MaxVals.get(column);
    }

    getMinVal(column) {
        return this.MinVals.get(column);
    }

    getTotalMax() {
        return this.totalMax;
    }

    getTotalMin() {
        return this.totalMin;
    }

    //quadtree for fast spatial lookups and filterings
    initQuadTree() {
        console.log('init quadtree..');
        const that = this;
        const quadtree = d3.quadtree()
            .x(function (d) {
                return d[that.config["featureData"][dataSrcIndex]["xCoordinate"]]
                return 0.0;
            })
            .y(function (d) {
                return d[that.config["featureData"][dataSrcIndex]["yCoordinate"]]
            })
            .addAll(that.getData());
        console.log("initialized quadtree");
        return quadtree;
    }


    //filters all points within a radius around a center point and returns points around it in an Euclidean order. - input is a point and radius
    filterFromPointInRadius(point, radius) {
        var res = quadTreeHelper.search(this.quadTree, point.x, point.y, radius);
        res.sort(function (a, b) {
            return quadTreeHelper.euclidDistance(point.x, point.y, a.x, a.y)
                - quadTreeHelper.euclidDistance(point.x, point.y, b.x, b.y);
        });
        return res;
    }


    //not in use.. but would norm the feature values of each column between 0 and 1 (min/max norm).
    normalize(data) {
        console.log('normalize');
        var normData = data;
        var nosrmData = normData.map(function (d, i) {

            var max = d3.max(d3.values(d));
            var min = d3.min(d3.values(d));
            for (var key in d) {
                d[key] = (d[key] - min) / (max - min);
            }
            return d;
        });
        return normData;
    }

    //return the current data selection
    getData() {
        return this.data;
        // return this.cfDim.idDimension.top(Infinity);
    }

    setData(data) {
        this.data = data;
    }

    updateData(data) {
        this.setData(data);
    }

    getQuadTree() {
        return this.quadTree;
    }

    getCurrentSelection() {
        return this.currentSelection;
    }

    clearCurrentSelection() {
        this.currentSelection.clear();
    }

    //TREE STRUCTURE FOR HIERARCHICAL DATA MANAGEMENT

    //init the tree with all the data as root
    initTree() {
        this.treeModel = new TreeModel();
        var root = {
            nodeId: this.generateID(),
            name: "All Data",
            class: "-",
            content: this.getData(),
            children: []
        }
        return this.treeModel.parse(root);
    }

    //add a node as child to a given node (to add to root, call with dataFilter.getTree(0 )
    addChildToNode(toNode, node) {
        node.nodeId = this.generateID();
        var nodeToAdd = this.treeModel.parse(node);
        toNode.addChild(nodeToAdd);
        return nodeToAdd;
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


    //the ACTIVE NODE contains the dataset that is currently used in the system

    setActiveNode(node, setData) {
        this.activeNode = node;
        if (setData) {
            //single selection state model
            //this.clearCurrentSelection();
            // this.addAllToCurrentSelection(node.model.content);

            //or should we have a two layer model in a sense that we can have an underlying subset and a selection on top of it?
            this.clearCurrentSelection();
            this.setData(node.model.content);
            //re-init quadtree with subset only
            if (this == null || this.getData() == null || this.getData() == undefined || this.getData().length == 0) {
                console.log('hm..data is ' + this.getData())
            }
            if (this.getData == null || this.getData() == undefined || this.getData().length < 1) {
                console.log('no data!!!!');
            }
            this.quadTree = this.initQuadTree();
        }
    }


    generateID() {
        return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
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
