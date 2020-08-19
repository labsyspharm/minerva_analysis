var infovis = {};

infovis.renderMatrix = function (wid_waypoint, id, visdata, events, eventHandler) {

    var ticks = 6;

    //some additional checks and data wrangling to ensure this add-on is downward compatible
    if (visdata.colorTicks != null && visdata.colorTicks != undefined) {
        ticks = visdata.colorTicks;
    }
    if (typeof visdata === 'string' || visdata instanceof String) {
        console.log('shift datastructure due to old yaml matrix description.')
        var dat = visdata;
        visdata = {};
        visdata.data = dat;
    } //end additional checks and data wrangling

    //discrete color map (from d3 coorbrewer) defined for min 3 and max 9 ticks, so if user specifies more we still have 9.
    ticks = Math.max(3, Math.min(9, ticks));

    //finally load the data
    return d3.csv(visdata.data)
        .then(function (data) {

            // SVG drawing area
            if (d3.select("#matrix").empty()) {

                //vis object
                var vis = {};

                //tooltip
                var tooltip = d3.select("#" + id).append("div")
                    .attr("id", "tooltip_matrix")
                    .attr("class", "tooltip")
                    .style("opacity", 0);

                //PREPROCESSING

                //extract row names (cluster names)
                var rowNames = d3.map(data, function (d) {
                    return (d.ClustName)
                }).keys();

                //remove row names (we stored them extra) labels from data
                data.forEach(function (d) {
                    delete d[data.columns[0]];
                });
                data.columns.shift();

                //find min/max for color coding and legend
                vis.max = Number.MIN_VALUE;
                vis.min = Number.MAX_VALUE;
                data.forEach(function (d) {
                    var numberArray = Object.values(d).map(function (i) {
                        return parseFloat(i);
                    });

                    vis.min = Math.min(vis.min, d3.min(numberArray));
                    vis.max = Math.max(vis.max, d3.max(numberArray));
                });
                //END PREPROCESSING

                //all framing stuff
                vis.margin = {top: 40, right: 70, bottom: 0, left: 80};
                vis.size = wid_waypoint.clientWidth;
                vis.width = vis.size - vis.margin.left - vis.margin.right;
                vis.cellPadding = 4;
                vis.cellWidth = (vis.width / Object.keys(data[0]).length) - vis.cellPadding;
                vis.cellHeight = vis.cellWidth;
                vis.height = data.length * (vis.cellWidth + vis.cellPadding) + vis.margin.top + vis.margin.bottom;

                //colorscale (YlGnBu is colorblind safe, print friendly, photocopy safe)


                var myColor = null;
                //some additional checks to ensure this add-on is downward compatible
                console.log(visdata.colormapInvert)
                if (visdata.colormapInvert == null || visdata.colormapInvert == undefined || !visdata.colormapInvert) {
                    myColor = d3.scaleQuantize().domain([vis.min, vis.max]).range(colorbrewer.YlGnBu[ticks]);
                } else {
                    myColor = d3.scaleQuantize().domain([vis.min, vis.max]).range(colorbrewer.YlGnBu[ticks].reverse());
                }

                //the svg everything goes into
                // d3.select("#"+id).style('position', 'relative');
                vis.svg = d3.select("#" + id).append("svg")
                    .attr('id', 'matrix')
                    .attr("width", vis.width + vis.margin.left + vis.margin.right)
                    .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

                //a row
                var row = vis.svg.selectAll(".matrix-row")
                    .data(data, function (dataRow) {
                        return dataRow;
                    })
                    .enter()
                    .append("g")
                    .attr("class", "matrix-row")
                    .attr('id', function (d, i) {
                        return 'matrixrow_' + i;
                    })
                    .attr("transform", function (d, index) {
                        return "translate(0," + (
                            vis.cellHeight + vis.cellPadding) * index + ")";
                    });

                //the labels on the y axis (left)
                row.append("text")
                    .attr("class", "matrix-label matrix-row-label")
                    .attr("x", -10)
                    .attr("y", vis.cellHeight / 2)
                    .attr("dy", ".35em")
                    .attr("text-anchor", "end")
                    .text(function (d, i) {
                        return rowNames[i];
                    })
                    .style('opacity', 1)
                    .on("click", function (d, i) {
                        events.clickHandler(rowNames[i], '')
                    });

                // the cells (colored rectangles)
                var cell = row.selectAll(".matrix-cell-business")
                    .data(function (row) {
                        return Object.values(row);
                    })
                    .enter().append("rect")
                    .attr("class", "matrix-cell matrix-cell-business")
                    .attr("height", vis.cellHeight)
                    .attr("width", vis.cellWidth)
                    .attr("x", function (d, index) {
                        return (vis.cellWidth + vis.cellPadding) * index;
                    })
                    // .attr("y", vis.cellHeight / 2)
                    .attr("fill", function (d) {
                        return myColor(d);
                    })
                    .on("mouseover", function (d, i) {
                        d3.select(this).style("cursor", "pointer");
                        d3.select(this).attr('stroke', 'white')
                            .attr('stroke-width', '2');
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .8);
                        tooltip.html('' + parseFloat(d).toFixed(2));
                        tooltip.style("left", (d3.event.pageX) + "px");
                        tooltip.style("top", (
                            parseInt(d3.select(this.parentNode).attr('id').split("_")[1]) + 1)
                            * (vis.cellHeight + vis.cellPadding) + "px");
                    })
                    .on("mouseout", function (d) {
                        d3.select(this).style("cursor", "default");
                        d3.select(this).attr('stroke', 'black')
                            .attr('stroke-width', '0');
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    })
                    .on("click", function (d, i) {
                        var j = this.parentElement.id.split('_')[1];
                        events.clickHandler(rowNames[j], data.columns[i])
                    });

                // the x-axis labels (top)
                var columnLabel = vis.svg.selectAll(".matrix-column-label")
                    .data(Object.keys(data[0]))
                    .enter()
                    .append("text")
                    .attr("class", "matrix-label matrix-column-label")
                    .attr("text-anchor", "start")
                    .attr("transform", function (d, index) {
                        return "translate(" + (index * (vis.cellWidth + vis.cellPadding) + (vis.cellWidth + vis.cellPadding) / 2) + ",-8) rotate(270)"
                    })
                    .text(function (d, i) {
                        return d;
                    })
                    .on("click", function (d, i) {
                        events.clickHandler('', data.columns[i])
                    });

                //dynamic legend
                vis.svg.append("g")
                    .attr("class", "colorLegend")
                    .attr("transform", "translate(" + (vis.width + 5) + ",0)");
                var colorLegend = legendColor()
                    .ascending(true)
                    .labelAlign('start')
                    .shapeWidth(5)
                    .shapeHeight(((data.length * (vis.cellWidth + vis.cellPadding)) - vis.cellPadding) / ticks - 1)
                    .cells(d3.range(vis.min, vis.max, (vis.max - vis.min) / (ticks)))
                    .scale(myColor);
                vis.svg.select(".colorLegend")
                    .call(colorLegend);


            }//if not yet drawn

        })
        .catch(function (error) {
            console.log('error loading vis data:' + error);
        })
}


infovis.renderBarChart = function (wid_waypoint, id, visdata, events, eventHandler) {

    //formatter .. to scientific notation
    var formatter = d3.format(".2n");

    var vis = {};

    //layout
    vis.margin = {top: 20, right: 20, bottom: 30, left: 40};
    vis.width = wid_waypoint.clientWidth - vis.margin.left - vis.margin.right;
    vis.height = vis.width;
    vis.padding = 15;

    //tooltip
    vis.tooltip = d3.select("#" + id).append("div")
        .attr("class", "tooltip")
        .attr("id", "tooltip_barChart")
        .style("opacity", 0);

    //create svg
    vis.svg = d3.select("#" + id).append("svg")
        .attr("width", vis.width + vis.margin.left + vis.margin.right)
        .attr("height", vis.height + vis.margin.top + vis.margin.bottom);

    //axis
    vis.x = d3.scaleBand().rangeRound([0, vis.width]).padding(0.1);
    vis.y = d3.scaleLinear().rangeRound([vis.height, 0]);

    var g = vis.svg.append("g")
        .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

    //read from csv data file
    return d3.csv(visdata)
        //some mapping..
        .then((data) => {
            return data.map((d) => {
                d.frequency = +d.frequency;
                return d;
            });
        })
        .then((data) => {
            //data domains..ranges
            vis.x.domain(data.map(function (d) {
                return d.type;
            }));
            vis.y.domain([0, d3.max(data, function (d) {
                return d.frequency;
            })]);

            //transform  x axis to bottom of chart
            g.append("g")
                .attr("class", "axis axis--x")
                .attr("transform", "translate(" + vis.padding + "," + vis.height + ")")
                .call(d3.axisBottom(vis.x));

            //set up y axis to left of chart
            g.append("g")
                .attr("class", "axis axis--y")
                .call(d3.axisLeft(vis.y).ticks(10).tickFormat(formatter))
                .append("text")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", "0.71em")
                .attr("text-anchor", "end")
                .text("Number of Cells")
                .attr('fill', 'white');

            //plot the bars
            g.selectAll(".bar")
                .data(data)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", function (d) {
                    return vis.padding + vis.x(d.type);
                })
                .attr("y", function (d) {
                    return vis.y(0);
                })
                .attr("width", vis.x.bandwidth())
                .attr("height", function (d) {
                    return vis.height - vis.y(0);
                });

            //little animation
            vis.svg.selectAll("rect")
                // .transition()
                // .duration(800)
                .attr("y", function (d) {
                    return vis.y(d.frequency);
                })
                .attr("height", function (d) {
                    return vis.height - vis.y(d.frequency);
                })
            // .delay(function(d,i){return(i*100)})

            //interaction
            vis.svg.selectAll("rect")
                .on("mouseover", function (d) {
                    d3.select(this).style("cursor", "pointer");
                    d3.select(this).attr('stroke', 'white')
                        .attr('stroke-width', '2');
                    vis.tooltip.transition()
                        .duration(200)
                        .style("opacity", .8);
                    vis.tooltip.html('' + formatter(parseFloat(d.frequency)))
                        .style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.select(this).attr('y') - vis.margin.top) + "px");
                })
                .on("mouseout", function (d) {
                    d3.select(this).style("cursor", "default");
                    d3.select(this).attr('stroke', 'black')
                        .attr('stroke-width', '0');
                    vis.tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                })
                .on("click", function (d, i) {
                    events.clickHandler(d.type)
                });
        })
        .catch((error) => {
            throw error;
        });
}

infovis.renderBoxPlot = function (wid_waypoint, id, visdata, eventHandler) {
    //to be implemented
}

infovis.renderScatterplot = function (wid_waypoint, id, visdata, events, eventHandler) {
    var margin = {top: 20, right: 20, bottom: 30, left: 40};
    var width = wid_waypoint.clientWidth - margin.left - margin.right;
    var height = width;
    var formatter = d3.format(".2n");
    var visdata = visdata;

    //strings to arrays
    var labels = visdata.clusters.labels.split(',');
    var colors = visdata.clusters.colors.split(',');
    var order = visdata.clusters.reorder.split(',');

    // setup x
    var xValue = function (d) {
            return d[visdata.axes.x];
        },
        xScale = d3.scaleLinear().range([0, width]),
        xMap = function (d) {
            return xScale(xValue(d));
        },
        xAxis = d3.axisBottom(xScale);

    xAxis.ticks(5)
        .tickFormat(d3.format(".1f"))

    // setup y
    var yValue = function (d) {
            return d[visdata.axes.y];
        },
        yScale = d3.scaleLinear().range([height, 0]),
        yMap = function (d) {
            return yScale(yValue(d));
        },
        yAxis = d3.axisLeft(yScale);

    yAxis.ticks(5)
        .tickFormat(d3.format(".1f"))

    var cellPos = function (d) {
        return [parseInt(d['X_position']), parseInt(d['Y_position'])];
    }

    // setup fill color
    var cValue = function (d) {
        return labels[parseInt(d.clust_ID) - 1]; //starts with cluster 1, but first array field is 0
    };

    //old automatic color function
    // var color = d3.scaleOrdinal(d3.schemeCategory10);

    // color = function(c){
    //     return d3.rgb("#" + clusters.colors[c-1]);
    // }

    //config driven color coding
    var color = d3.scaleOrdinal()
        .domain(labels)
        .range(colors);

    // the legend shows the clusters in a different order, defined by the user
    var sortedColors = colors.slice().sort(function (a, b) {
        return order.indexOf(labels[colors.indexOf(a)]) - order.indexOf(labels[colors.indexOf(b)]);
    });
    var sortedColor = d3.scaleOrdinal()
        .domain(order)
        .range(sortedColors);

    // add the graph canvas to the body of the webpage
    var svg = d3.select("#" + id).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // add the tooltip area to the webpage
    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style('width', '100px');

    // load data
    return d3.csv(visdata.data).then(function (data) {
        //change string (from CSV) into number format
        data.forEach(function (d) {
            d[visdata.axes.x] = +d[visdata.axes.x];
            d[visdata.axes.y] = +d[visdata.axes.y];
        });
        //console.log(tedf)
        // don't want dots overlapping axis, so add in buffer to data domain
        var dataRange = (Math.abs(d3.max(data, xValue)) + Math.abs(d3.min(data, xValue)));
        var tenPercentBorder = dataRange / 10;
        xScale.domain([d3.min(data, xValue) - tenPercentBorder, d3.max(data, xValue) + tenPercentBorder]);
        yScale.domain([d3.min(data, yValue) - tenPercentBorder, d3.max(data, yValue) + tenPercentBorder]);

        // x-axis
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
            .append("text")
            .attr("class", "label")
            .attr("x", width)
            .attr("y", -6)
            .style("text-anchor", "end")
            .text(visdata.axes.x)
            .attr('fill', 'white');

        // y-axis
        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text(visdata.axes.y)
            .attr('fill', 'white');

        // define dot size and opacity depending on data size (more instances lead to smaller more transparent points)
        var relSize = 1.5, opacity = 0.5;
        if (data.length <= 100) {
            relSize = 3.5;
            opacity = 1.0;
        } else if (data.length <= 1000) {
            relSize = 2;
            opacity = 0.95;
        }

        // draw dots
        svg.selectAll(".dot")
            .data(data)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("r", relSize)
            .attr("cx", xMap)
            .attr("cy", yMap)
            .style("fill", function (d) {
                return "#" + color(cValue(d));
            })
            .attr('fill-opacity', opacity)
            .on('click', function (d) {
                events.clickHandler(cellPos(d));
            })
            .on("mouseover", function (d) {
                d3.select(this).style("cursor", "pointer");
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(cValue(d) + "<br/> (" +
                    "x: " + formatter(parseFloat(xValue(d))) + ", " +
                    "y: " + formatter(parseFloat(yValue(d))) + ")")
                    .style("left", (d3.event.pageX + 5) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function (d) {
                d3.select(this).style("cursor", "default");
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // draw legend
        var legend = svg.selectAll(".legend")
            .data(sortedColor.domain())
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
                return "translate(0," + i * 20 + ")";
            });

        // draw legend colored rectangles
        legend.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", function (d) {
                console.log(sortedColor(d));
                return "#" + sortedColor(d);
            })

        // draw legend text
        legend.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(function (d) {
                return d;
            }).attr('font-size', '0.8em')
            .attr('fill', 'white');
    }).catch((error) => {
        throw error;
    });
};

infovis.renderCanvasScatterplot = function (wid_waypoint, id, visdata, events, eventHandler) {

    if (d3.select("#axis-svg").empty()) {
        //eventhandler
        var eventHandler = eventHandler;

        // constants
        var numberPoints = visdata.data.length;
        var subsetSize = 0; //later..
        var zoomEndDelay = 200;

        //zoom
        var k = 1;

        //meta
        //strings to arrays
        var labels = visdata.clusters.labels.split(',');
        var colors = visdata.clusters.colors.split(',');
        var order = visdata.clusters.reorder.split(',');

        // timeout function
        var zoomEndTimeout;

        // save the index of the currently selected point
        var selectedPoint;

        // define all size variables
        var margin = {top: 10, right: 10, bottom: 30, left: 30};
        var fullWidth = wid_waypoint.clientWidth - margin.left - margin.right;
        var fullHeight = fullWidth;
        var formatter = d3.format(".2n");
        var width = fullWidth - margin.left - margin.right;
        var height = fullHeight - margin.top - margin.bottom;


        //add svg (for axis and stuff)
        var div = d3.select("#" + id).append('div')
            .style('width', fullWidth + 'px')
            .style('height', fullHeight + 'px')
        // .style('background-color', 'black');

        div.append("svg")
            .attr('id', 'axis-svg')
            .attr('class', 'plot');

        var divLegend = d3.select("#" + id).append('div')
            .style('width', fullWidth + 'px')
            .style('height', 100 + 'px')
        // .style('background-color', 'black');

        divLegend
            .append("svg")
            .attr('id', 'axis-svg-legend');

        //add canvas (for the actual plot)
        div.append('canvas')
            .attr('id', 'plot-canvas')
            .attr('class', 'plot');

        //load data
        return d3.csv(visdata.data).then(function (dat) {
            subsetSize = Math.min(dat.length, 10000);

            console.log('shifting data');
            var data = dat.map(function (d, i) {
                return [parseFloat(d[visdata.axes.x]), parseFloat(d[visdata.axes.y]), d, i, false]
            });

            var fromImageData = dat.map(function (d, i) {
                return [parseFloat(d.X_position), parseFloat(d.Y_position), d, i, false]
            });

            // create a quadtree for fast hit detection
            var quadTree = d3.quadtree(data);
            var fromImageQuadTree = d3.quadtree(fromImageData);

            // selected sample random numbers -- this is the subset of points
            // drawn during 'zoom' events
            var randomIndex = _.sampleSize(data, subsetSize);

            var pointRadius = 1.5, opacity = 0.5;
            if (data.length <= 100) {
                pointRadius = 5.5;
                opacity = 1.0;
            } else if (data.length <= 1000) {
                pointRadius = 4;
                opacity = 0.90;
            } else if (data.length <= 10000) {
                pointRadius = 3;
                opacity = 0.75;
            } else if (data.length <= 100000) {
                pointRadius = 2;
                opacity = 0.60;
            } else if (data.length <= 1000000) {
                pointRadius = 1;
                opacity = 0.50;
            }

            // the canvas is shifted by 1px to prevent any artefacts
            // when the svg axis and the canvas overlap
            var canvas = d3.select("#plot-canvas")
                .attr("width", width - 1)
                .attr("height", height - 1)
                .style("transform", "translate(" + (margin.left + 1) +
                    "px" + "," + (margin.top + 1) + "px" + ")");

            var svg = d3.select("#axis-svg")
                .attr("width", fullWidth)
                .attr("height", fullHeight)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," +
                    margin.top + ")");

            var svgLegend = d3.select("#axis-svg-legend")
                .attr("width", fullWidth)
                .attr("height", 100)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," +
                    margin.top + ")");

            // ranges, scales, axis, objects
            var xRange = d3.extent(data, function (d) {
                return d[0]
            });
            var yRange = d3.extent(data, function (d) {
                return d[1]
            });

            var xScale = d3.scaleLinear()
                .domain([xRange[0], xRange[1]])
                .range([0, width]);
            var x2 = xScale.copy();
            //var x3 = xScale.copy();

            var yScale = d3.scaleLinear()
                .domain([yRange[0], yRange[1]])
                .range([height, 0]);
            var y2 = yScale.copy();
            //var y3 = yScale.copy();

            var xAxis = d3.axisBottom()
                .scale(xScale)
                .tickSizeInner(-height)
                .tickSizeOuter(0)
                .tickPadding(10)

            var yAxis = d3.axisLeft()
                .scale(yScale)
                .tickSizeInner(-width)
                .tickSizeOuter(0)

            // create zoom behaviour
            var zoomBehaviour = d3.zoom()
                .scaleExtent([1, 100])
                .on("zoom", onZoom)
                .on("end", onZoomEnd);

            // append x-axis, y-axis
            var xAxisSvg = svg.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(xAxis);

            var yAxisSvg = svg.append('g')
                .attr('class', 'y axis')
                .call(yAxis);

            // on onclick handler
            canvas.on("click", onClick);

            // add zoom behaviour
            canvas.call(zoomBehaviour);

            // get the canvas drawing context
            var context = canvas.node().getContext('2d');

            draw();

            function onClick() {
                var mouse = d3.mouse(this);

                // map the clicked point to the data space
                var xClicked = xScale.invert(mouse[0]);
                var yClicked = yScale.invert(mouse[1]);

                // find the closest point in the dataset to the clicked point
                var closest = quadTree.find(xClicked, yClicked);

                // map the co-ordinates of the closest point to the canvas space
                var dX = xScale(closest[0]);
                var dY = yScale(closest[1]);

                // register the click if the clicked point is in the radius of the point
                var distance = euclideanDistance(mouse[0], mouse[1], dX, dY);

                if (distance < pointRadius * 10) {
                    if (selectedPoint) {
                        data[selectedPoint][4] = false;
                    }
                    closest[4] = true;
                    selectedPoint = closest[3];

                    // redraw the points
                    draw();
                    events.clickHandler(cellPos(closest[2]));
                }
            }

            var cellPos = function (d) {
                return [parseInt(d['X_position']), parseInt(d['Y_position'])];
            }

            function onZoom() {
                xScale = d3.event.transform.rescaleX(x2);
                xAxis.scale(xScale);
                xAxisSvg.call(xAxis);

                yScale = d3.event.transform.rescaleY(y2);
                yAxis.scale(yScale);
                yAxisSvg.call(yAxis);

                k = d3.event.transform.k;
                // var xRangeDiff = Math.abs(xRange[1] - xRange[0]);
                // var rangeNow = Math.abs(xScale.domain()[1] - xScale.domain()[0]);
                // var diff = (rangeNow/xRangeDiff) * 100;
                // k= Math.min(100,1 + 100-diff);

                clearTimeout(zoomEndTimeout);
                if (k < 5) {
                    draw(randomIndex);
                } else {
                    draw();
                }
            }

            function onZoomEnd() {
                // when zooming is stopped, create a delay before
                // redrawing the full plot
                zoomEndTimeout = setTimeout(function () {
                    draw();
                }, zoomEndDelay);
            }


            // the draw function draws the full dataset if no index
            // parameter supplied, otherwise it draws a subset according
            // to the indices in the index parameter
            function draw(index) {
                var active;

                context.clearRect(0, 0, fullWidth, fullHeight);
                // context.fillStyle = "rgba(255, 255, 255, 0.5)";
                // context.strokeWidth = 1;
                // context.strokeStyle = 'white';

                // if an index parameter is supplied, we only want to draw points
                // with indices in that array
                if (index) {
                    index.forEach(function (i) {
                        var point = data[i[3]];
                        if (!point[4]) {
                            drawPoint(false, point, pointRadius);
                        } else {
                            active = point;
                        }
                    });
                }
                // draw the full dataset otherwise
                else {
                    data.forEach(function (point) {
                        if (!point[4]) {
                            drawPoint(false, point, pointRadius);
                        } else {
                            active = point;
                        }
                    });
                }

                // ensure that the actively selected point is drawn last
                // so it appears at the top of the draw order
                if (active) {
                    drawPoint(true, active, pointRadius);
                    // context.fillStyle = "rgba(255, 255, 255, 0.5)";
                }
            }

            function drawPoint(isActive, point, r) {

                //if in viewport
                if (point[0] >= d3.extent(xScale.domain())[0] && point[0] <= d3.extent(xScale.domain())[1]
                    && point[1] >= d3.extent(yScale.domain())[0] && point[1] <= d3.extent(yScale.domain())[1]) {

                    var cx = xScale(point[0]);
                    var cy = yScale(point[1]);

                    if (!isActive) {
                        // var hexColor = colors[point[2].clust_ID-1];
                        var color = d3.rgb("#" + colors[parseInt(point[2].clust_ID) - 1]);
                        color.opacity = opacity;
                        context.fillStyle = color + "";
                        context.beginPath();
                        context.arc(cx, cy, r * (k / 10.0), 0, 2 * Math.PI);
                        context.fill();
                    } else {
                        var color = d3.rgb("#" + colors[parseInt(point[2].clust_ID) - 1]);
                        context.strokeStyle = '#FFA500';
                        context.lineWidth = 5;
                        context.fillStyle = color + "";
                        context.beginPath();
                        context.arc(cx, cy, r * (k / 10.0), 0, 2 * Math.PI);
                        context.fill();
                        context.stroke();
                    }
                }
            }

            function euclideanDistance(x1, y1, x2, y2) {
                return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
            }

            //config driven color coding
            var color = d3.scaleOrdinal()
                .domain(labels)
                .range(colors);

            // the legend shows the clusters in a different order, defined by the user
            sortedColors = colors.slice().sort(function (a, b) {
                return order.indexOf(labels[colors.indexOf(a)]) - order.indexOf(labels[colors.indexOf(b)]);
            });
            var sortedColor = d3.scaleOrdinal()
                .domain(order)
                .range(sortedColors);

            // draw legend
            var n = labels.length / 2;
            var itemWidth = 80;
            var itemHeight = 18;


            var legend = svgLegend.selectAll(".legend")
                .data(sortedColor.domain())
                .enter().append("g")
                .attr("transform", function (d, i) {
                    return "translate(" + ((i % n * itemWidth) - fullWidth * 0.7) + "," + ((Math.floor(i / n) * itemHeight * 1.2)) + ")";
                })
                .attr("class", "legend")
            // .attr("transform", function (d, i) {
            //     return "translate(0," + i * 20 + ")";
            // });

            // draw legend colored rectangles
            legend.append("rect")
                .attr("x", width - 18)
                .attr("width", 18)
                .attr("height", 18)
                .style("fill", sortedColor);

            // draw legend text
            legend.append("text")
                .attr("x", width - 24)
                .attr("y", 9)
                .attr("dy", ".35em")
                .style("text-anchor", "end")
                .text(function (d) {
                    return d;
                }).attr('font-size', '0.8em')
                .attr('fill', 'white');

            //there is a zooming bug, thus currently outcommented
            const zoomAndHighlightPoint = (d) => {
                // console.log('in scatterplot: ' + d.x + d.y);
                // var closest = fromImageQuadTree.find(d.x, d.y);
                // closest[4] = true;
                // selectedPoint = closest[3];
                //
                // //we set the viewport, so that it shows an area where the selected point is in (with some context around it)
                //
                // xScale.domain([parseFloat(closest[2][visdata.axes.x])-1, parseFloat(closest[2][visdata.axes.x])+1]);
                // x2 = xScale.copy();
                // xAxis.scale(xScale);
                // xAxisSvg.call(xAxis);
                //
                // yScale.domain([parseFloat(closest[2][visdata.axes.y])-1, parseFloat(closest[2][visdata.axes.y])+1]);
                // y2 = yScale.copy();
                // yAxis.scale(yScale);
                // yAxisSvg.call(yAxis);
                //
                // //finally draw the stuff..
                // draw();

            }//register method with event handler
            eventHandler.bind(eventHandler.events.osdClickEvent, zoomAndHighlightPoint);

        });
    }
    ;

}

export default infovis;