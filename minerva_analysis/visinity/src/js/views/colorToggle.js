class ColorToggle {

    constructor(parentId, boundItems, colorByCellType=false) {
        this.parentId = parentId;
        this.boundItems = boundItems;
        this.svgData = [
            {
                'name': 'orange',
                'path': 'M0.6,12C0.6,5.7,5.7,0.6,12,0.6v22.8C5.7,23.4,0.6,18.3,0.6,12z',
                'one': '#FFA500',
                'many': '#AFAFAF',
            }, {
                'name': 'green',
                'path': 'M12,0.6c6.3,0,11.4,5.1,11.4,11.4H12V0.6z',
                'many': '#38B57D',
                'one': '#898989',
            }, {
                'name': 'lightblue',
                'path': 'M20.1,3.9c4.5,4.5,4.5,11.7,0,16.1L12,12L20.1,3.9z',
                'many': '#2CC1D6',
                'one': '#979797',
                'type': 'many'
            }, {
                'name': 'blue',
                'path': 'M23.4,12c0,6.3-5.1,11.4-11.4,11.4L12,12L23.4,12z',
                'many': '#105090',
                'one': '#444444',
            }, {
                'name': 'purple',
                'path': 'M20.1,20.1c-2.2,2.2-5.1,3.3-8.1,3.3L12,12L20.1,20.1z',
                'many': '#603181',
                'one': '#484848'
            },
        ]
        this.colorByCellType = colorByCellType;
        this.init();

    }

    init() {
        const self = this;
        d3.select(`#${self.parentId}_color_toggle`).remove();
        self.svg = d3.select(`#${self.parentId}`)
            .append('svg')
            .attr('id', `${self.parentId}_color_toggle`)
            .classed('color_toggle', true)
            .attr('height', 24)
            .attr('width', 24)
        self.g = self.svg.append('g')
            .on('click', self.recolor.bind(self))
        self.color()
        // .attr('stroke', '#FFFFFF')
        // .attr('stroke-width', '0.5')
        // .attr('stroke-miterlimit', '10')

        //    stroke:#FFFFFF;stroke-width:0.5;stroke-miterlimit:10
    }

    color() {
        const self = this;
        self.g.selectAll('.color_toggle_slice')
            .data(self.svgData)
            .join('path')
            .attr('class', d => `color_toggle_slice color_toggle_slice_${d.name} color_toggle_slice_${d.type}`)
            .attr('d', d => d.path)
            .attr('fill', d => {
                if (self.colorByCellType) {
                    return d.many
                } else {
                    return d.one;
                }
            })
    }

    recolor() {
        const self = this;
        self.colorByCellType = !self.colorByCellType;
        self.color();
        self.boundItems.forEach(e=>{
            e.changeColoring(self.colorByCellType);
        })
        

    }
}