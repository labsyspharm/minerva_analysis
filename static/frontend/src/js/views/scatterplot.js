class Scatterplot {
    constructor(id, eventHandler, dataLayer) {
        this.id = id;
        this.eventHandler = eventHandler;
        this.dataLayer = dataLayer;
    }

    async init(visData) {
        this.colorMap = await dataLayer.getColorScheme(true, 'cluster');

        let data = visData.data;
        const xScale = d3.scaleLinear().domain([visData.xMin, visData.xMax]);
        const yScale = d3.scaleLinear().domain([visData.yMin, visData.yMax]);
        const xScaleOriginal = xScale.copy();
        const yScaleOriginal = yScale.copy();
        var color = d3.scaleOrdinal() // D3 Version 4
            .domain(Object.keys(this.colorMap))
            .range(_.map(this.colorMap, elem => `#${elem.hex}`));
        var legend = d3.legendColor()
            .orient('vertical')
            .shapePadding(0)
            .titleWidth(100)
            .labelOffset(5)
            .shapeWidth(10)
            .shapeHeight(10)
            .scale(color)
            .on("cellclick", function (d) {
                recolor(d);
            });

        const createAnnotationData = datapoint => ({
            note: {
                label: `ID: ${datapoint.id}`,
                bgPadding: 5,
                title: "Test"
            },
            x: datapoint.x,
            y: datapoint.y,
            dx: 20,
            dy: 20
        });

        const pointSeries = fc
            .seriesWebglPoint()
            .equals((a, b) => a === b)
            .size(1)
            .crossValue(d => d.x)
            .mainValue(d => d.y);

        const zoom = d3
            .zoom()
            .scaleExtent([0.8, 10])
            .on("zoom", () => {
                // update the scales based on current zoom
                xScale.domain(d3.event.transform.rescaleX(xScaleOriginal).domain());
                yScale.domain(d3.event.transform.rescaleY(yScaleOriginal).domain());
                redraw();
            });

        const annotations = [];

        const pointer = fc.pointer().on("point", ([coord]) => {
            annotations.pop();

            if (!coord || !quadtree) {
                return;
            }

            // find the closes datapoint to the pointer
            const x = xScale.invert(coord.x);
            const y = yScale.invert(coord.y);
            const radius = Math.abs(xScale.invert(coord.x) - xScale.invert(coord.x - 20));
            const closestDatum = quadtree.find(x, y, radius);

            // if the closest point is within 20 pixels, show the annotation
            if (closestDatum) {
                annotations[0] = createAnnotationData(closestDatum);
            }

            redraw();
        });

        const annotationSeries = seriesSvgAnnotation()
            .notePadding(15)
            .type(d3.annotationCallout);

        const chart = fc
            .chartCartesian(xScale, yScale)
            .webglPlotArea(
                // only render the point series on the WebGL layer
                fc
                    .seriesWebglMulti()
                    .series([pointSeries])
                    .mapping(d => d.data)
            )
            .svgPlotArea(
                // only render the annotations series on the SVG layer
                fc
                    .seriesSvgMulti()
                    .series([annotationSeries])
                    .mapping(d => d.annotations)
            )
            .decorate((selection) => {
                let sel = selection.enter()


                sel.append('svg')
                    .attr('class', 'legend')
                    .attr("width", "30px")
                    .attr("height", "300px")
                //
                sel.select('.legend')
                    .attr("transform", "translate(0,20)")
                    .call(legend);

                sel.select("d3fc-svg.plot-area")
                    .on("measure.range", () => {
                        xScaleOriginal.range([0, d3.event.detail.width]);
                        yScaleOriginal.range([d3.event.detail.height, 0]);
                    })
                    .call(zoom)
                    .call(pointer)

            });
        let quadtree;
        const pointFill = d => {
            return webglColor(color(d.cluster));
        }

        const fillColor = fc.webglFillColor().value(pointFill).data(data);
        pointSeries.decorate(program => fillColor(program));

        // wire up the fill color selector
        iterateElements(".controls a", el => {
            el.addEventListener("click", () => {
                iterateElements(".controls a", el2 => el2.classList.remove("active"));
                el.classList.add("active");
                fillColor.value(pointFill);
                redraw();
            });
        });

        // create a spatial index for rapidly finding the closest datapoint
        quadtree = d3
            .quadtree()
            .x(d => d.x)
            .y(d => d.y)
            .addAll(data);


        // render the chart with the required data
        // Enqueues a redraw to occur on the next animation frame
        const recolor = (cluster) => {
            const pointFillCluster = d => {
                let pointColor = webglColor(color(d.cluster));
                if (d.cluster != cluster) {
                    pointColor[3] = 0.4;
                }
                return pointColor;
            }
            const fillColorCluster = fc.webglFillColor().value(pointFillCluster).data(data);
            pointSeries.decorate(program => fillColorCluster(program));
            redraw();
        }
        const redraw = () => {
            d3.select(`#${this.id}`).datum({annotations, data}).call(chart);
        };
        redraw();
    }

}

const distance = (x1, y1, x2, y2) => {
    const dx = x1 - x2,
        dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
};

const trunc = (str, len) =>
    str.length > len ? str.substr(0, len - 1) + "..." : str;

const hashCode = s =>
    s.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
    }, 0);

const webglColor = color => {
    const {r, g, b, opacity} = d3.color(color).rgb();
    return [r / 255, g / 255, b / 255, opacity];
};

const iterateElements = (selector, fn) =>
    [].forEach.call(document.querySelectorAll(selector), fn);

const seriesSvgAnnotation = () => {
    // the underlying component that we are wrapping
    const d3Annotation = d3.annotation();

    let xScale = d3.scaleLinear();
    let yScale = d3.scaleLinear();

    const join = fc.dataJoin("g", "annotation");

    const series = selection => {
        selection.each((data, index, group) => {
            const projectedData = data.map(d => ({
                ...d,
                x: xScale(d.x),
                y: yScale(d.y)
            }));

            d3Annotation.annotations(projectedData);

            join(d3.select(group[index]), projectedData).call(d3Annotation);
        });
    };

    series.xScale = (...args) => {
        if (!args.length) {
            return xScale;
        }
        xScale = args[0];
        return series;
    };

    series.yScale = (...args) => {
        if (!args.length) {
            return yScale;
        }
        yScale = args[0];
        return series;
    };

    fc.rebindAll(series, d3Annotation);

    return series;
};