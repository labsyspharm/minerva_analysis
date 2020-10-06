class Starplot {
    constructor(id, colorScheme) {
        this.id = id;
        this.parent = d3.select(`#${id}`)
        this.colorScheme = colorScheme;
        this.selector = document.getElementById(id)
    }

    init(visData) {
        this.visData = visData;
        this.margin = {top: 40, right: 20, bottom: 60, left: 20},
            this.width = this.parent.node().getBoundingClientRect().width - this.margin.left - this.margin.right,
            this.height = this.parent.node().getBoundingClientRect().height - this.margin.top - this.margin.bottom;

        this.cfg = {
            w: this.width,
            h: this.height,
            margin: this.margin,
            levels: 1,				//How many levels or inner circles should there be drawn
            maxValue: 0.5,
            labelFactor: 1.25, 	//How much farther than the radius of the outer circle should the labels be placed
            wrapWidth: 300, 		//The number of pixels after which a label needs to be given a new line
            opacityArea: 0.35, 	//The opacity of the area of the blob
            dotRadius: 2, 			//The size of the colored circles of each blog
            opacityCircles: 0.1, 	//The opacity of the circles of each blob
            strokeWidth: 2, 		//The width of the stroke around each blob
            roundStrokes: false,	//If true the area and stroke will follow a round path (cardinal-closed)
            color: d3.schemeCategory10	//Color function
        };

    }

    draw(cluster) {
        const self = this;
        self.selector.style.display = "block";

        let clusterData = _.get(self.visData, `[${cluster}].clusterSummary.weighted_contribution`, {});
        let chartData = _.toPairs(clusterData);
        self.cfg.maxValue = _.max(_.values(clusterData));

        chartData = _.map(chartData, ([axis, value]) => {
            return {axis: axis, value: value}
        })
        // let phenotypes = _.keys(chartData);
        // self.config.maxValue = _.max(_.values(chartData));
        // chartData = [
        //     [//iPhone
        //         {axis: "Battery Life", value: 0.22},
        //         {axis: "Brand", value: 0.28},
        //         {axis: "Contract Cost", value: 0.29},
        //         {axis: "Design And Quality", value: 0.17},
        //         {axis: "Have Internet Connectivity", value: 0.22},
        //         {axis: "Large Screen", value: 0.02},
        //         {axis: "Price Of Device", value: 0.21},
        //         {axis: "To Be A Smartphone", value: 0.50}
        //     ]
        // ];
        let maxValue = self.cfg.maxValue;
        let allAxis = _.keys(clusterData)	//Names of each axis
        let total = allAxis.length;			//The number of different axes
        let radius = Math.min(self.cfg.w / 2, self.cfg.h / 2)	//Radius of the outermost circle

        let angleSlice = Math.PI * 2 / total;		//The width in radians of each "slice"
        let format = d3.format(",.2f");
        //Scale for the radius
        let rScale = d3.scaleLinear()
            .range([0, radius])
            .domain([0, maxValue]);

        /////////////////////////////////////////////////////////
        //////////// Create the container SVG and g /////////////
        /////////////////////////////////////////////////////////

        //Remove whatever chart with the same id/class was present before
        d3.select(`#${self.id}`).select("svg").remove();

        var svg = d3.select(`#${self.id}`).append("svg")
            .attr("width", self.cfg.w + self.cfg.margin.left + self.cfg.margin.right)
            .attr("height", self.cfg.h + self.cfg.margin.top + self.cfg.margin.bottom)
            .attr("class", "radar" + self.id);
        //Append a g element
        var g = svg.append("g")
            .attr("transform", "translate(" + (self.cfg.w / 2 + self.cfg.margin.left) + "," + (self.cfg.h / 2 + self.cfg.margin.top) + ")");

        /////////////////////////////////////////////////////////
        ////////// Glow filter for some extra pizzazz ///////////
        /////////////////////////////////////////////////////////

        //Filter for the outside glow
        var filter = g.append('defs').append('filter').attr('id', 'glow'),
            feGaussianBlur = filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur'),
            feMerge = filter.append('feMerge'),
            feMergeNode_1 = feMerge.append('feMergeNode').attr('in', 'coloredBlur'),
            feMergeNode_2 = feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        /////////////////////////////////////////////////////////
        /////////////// Draw the Circular grid //////////////////
        /////////////////////////////////////////////////////////

        //Wrapper for the grid & axes
        var axisGrid = g.append("g").attr("class", "axisWrapper");

        //Draw the background circles
        axisGrid.selectAll(".levels")
            .data(d3.range(1, (self.cfg.levels + 1)).reverse())
            .enter()
            .append("circle")
            .attr("class", "gridCircle")
            .attr("r", function (d, i) {
                return radius / self.cfg.levels * d;
            })
            .style("fill", "#CDCDCD")
            .style("stroke", "#CDCDCD")
            .style("fill-opacity", self.cfg.opacityCircles)
            .style("filter", "url(#glow)");

        //Text indicating at what % each level is
        axisGrid.selectAll(".axisLabel")
            .data(d3.range(1, (self.cfg.levels + 1)).reverse())
            .enter().append("text")
            .attr("class", "axisLabel")
            .attr("x", 4)
            .attr("y", function (d) {
                return -d * radius / self.cfg.levels;
            })
            .attr("dy", "0.4em")
            .style("font-size", "10px")
            .attr("fill", "#737373")
            .text(function (d, i) {
                return format(maxValue * d / self.cfg.levels);
            });

        /////////////////////////////////////////////////////////
        //////////////////// Draw the axes //////////////////////
        /////////////////////////////////////////////////////////

        //Create the straight lines radiating outward from the center
        var axis = axisGrid.selectAll(".axis")
            .data(allAxis)
            .enter()
            .append("g")
            .attr("class", "axis");
        //Append the lines
        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", function (d, i) {
                return rScale(maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("y2", function (d, i) {
                return rScale(maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .attr("class", "line")
            .style("stroke", "white")
            .style("stroke-width", "2px");

        //Append the labels at each axis
        axis.append("text")
            .attr("class", "legend")

            .attr("dy", "0.35em")
            .attr("x", function (d, i) {
                return rScale(maxValue * self.cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("y", function (d, i) {
                return rScale(maxValue * self.cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .text(function (d) {
                return d
            })
            .call(wrap, self.cfg.wrapWidth);

        /////////////////////////////////////////////////////////
        ///////////// Draw the radar chart blobs ////////////////
        /////////////////////////////////////////////////////////

        //The radial line function
        var radarLine = d3.lineRadial().curve(d3.curveCardinalClosed)
            .radius(function (d) {
                return rScale(d.value);
            })
            .angle(function (d, i) {
                return i * angleSlice;
            });


        //Create a wrapper for the blobs
        var blobWrapper = g.selectAll(".radarWrapper")
            .data([chartData])
            .enter().append("g")
            .attr("class", "radarWrapper");

        //Append the backgrounds
        blobWrapper
            .append("path")
            .attr("class", "radarArea")
            .attr("d", function (d, i) {
                return radarLine(d);
            })
            .style("fill", function (d, i) {
                return self.cfg.color[i];
            })
            .style("fill-opacity", self.cfg.opacityArea)
            .on('mouseover', function (d, i) {
                //Dim all blobs
                d3.selectAll(".radarArea")
                    .transition().duration(200)
                    .style("fill-opacity", 0.1);
                //Bring back the hovered over blob
                d3.select(this)
                    .transition().duration(200)
                    .style("fill-opacity", 0.7);
            })
            .on('mouseout', function () {
                //Bring back all blobs
                d3.selectAll(".radarArea")
                    .transition().duration(200)
                    .style("fill-opacity", self.cfg.opacityArea);
            });

        //Create the outlines
        blobWrapper.append("path")
            .attr("class", "radarStroke")
            .attr("d", function (d, i) {
                return radarLine(d);
            })
            .style("stroke-width", self.cfg.strokeWidth + "px")
            .style("stroke", function (d, i) {
                return self.cfg.color[i];
            })
            .style("fill", "none")
            .style("filter", "url(#glow)");

        //Append the circles
        blobWrapper.selectAll(".radarCircle")
            .data(function (d, i) {
                return d;
            })
            .enter().append("circle")
            .attr("class", "radarCircle")
            .attr("r", self.cfg.dotRadius)
            .attr("cx", function (d, i) {
                return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("cy", function (d, i) {
                return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .style("fill", function (d, i, j) {
                return self.cfg.color[j];
            })
            .style("fill-opacity", 0.8);

        /////////////////////////////////////////////////////////
        //////// Append invisible circles for tooltip ///////////
        /////////////////////////////////////////////////////////

        //Wrapper for the invisible circles on top
        var blobCircleWrapper = g.selectAll(".radarCircleWrapper")
            .data([chartData])
            .enter().append("g")
            .attr("class", "radarCircleWrapper");

        //Append a set of invisible circles on top for the mouseover pop-up
        blobCircleWrapper.selectAll(".radarInvisibleCircle")
            .data(function (d, i) {
                return d;
            })
            .enter().append("circle")
            .attr("class", "radarInvisibleCircle")
            .attr("r", self.cfg.dotRadius * 1.5)
            .attr("cx", function (d, i) {
                return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("cy", function (d, i) {
                return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", function (d, i) {
                let newX = parseFloat(d3.select(this).attr('cx')) - 10;
                let newY = parseFloat(d3.select(this).attr('cy')) - 10;

                tooltip
                    .attr('x', newX)
                    .attr('y', newY)
                    .text(format(d.value))
                    .transition().duration(200)
                    .style('opacity', 1);
            })
            .on("mouseout", function () {
                tooltip.transition().duration(200)
                    .style("opacity", 0);
            });

        //Set up the small tooltip for when you hover over a circle
        var tooltip = g.append("text")
            .attr("class", "tooltip")
            .style("opacity", 0);

        /////////////////////////////////////////////////////////
        /////////////////// Helper Function /////////////////////
        /////////////////////////////////////////////////////////

        //Taken from http://bl.ocks.org/mbostock/7555321
        //Wraps SVG text
        function wrap(text, width) {
            text.each(function () {
                var text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.4, // ems
                    y = text.attr("y"),
                    x = text.attr("x"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }//wrap

    }

    hide() {
        const self = this;
        self.selector.style.display = "none";
    }

};