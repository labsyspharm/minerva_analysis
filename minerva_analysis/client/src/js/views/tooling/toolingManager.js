export class ToolingManager {

    // Class vars
    datum = {
        buttonsToWindows: [],
    };
    elements = {
        interfaceWrapperD3: null,
        toolingButtonChannelSelectionD3: null,
        toolingButtons: null,
        toolingTitleL: null,
        toolingTitleR: null,
        toolingWindows: null,
        toolingWrapperLD3: null,
        toolingWrapperRD3: null,
        viewerWrapperD3: null,
    };
    settings = {
        configs: {
            elementWrappers: {
                toolingWrapperL: {
                    name: 'toolingWrapperL',
                    display: 'Tooling Wrapper Left',
                    //
                    isExpanded: true,
                    stylePosition: 'absolute',
                    stylePositioning: {
                        top: 0,
                        right: 'unset',
                        bottom: 'unset',
                        left: 0,
                    },
                    styleWidthAsPercent: 3.75,
                    styleWidthExpandedAsVW: 20,
                    styleZIndex: 2,
                    visible: true,
                },
                interfaceWrapper: {
                    name: 'Interface Wrapper',
                    display: 'View',
                    //
                    isExpanded: false,
                    stylePosition: 'relative',
                    stylePositioning: {
                        top: 'unset',
                        right: 'unset',
                        bottom: 'unset',
                        left: 'unset',
                    },
                    styleWidthAsPercent: 100,
                    styleZIndex: 1,
                    visible: true,
                },
                toolingWrapperR: {
                    name: 'toolingWrapperR',
                    display: 'Tooling Wrapper Right',
                    //
                    isExpanded: false,
                    stylePosition: 'absolute',
                    stylePositioning: {
                        top: 0,
                        right: 0,
                        bottom: 'unset',
                        left: 'unset',
                    },
                    styleWidthAsPercent: 3.75,
                    styleWidthExpandedAsVW: 20,
                    styleZIndex: 2,
                    visible: true,
                },
            },
            fontSizes: {
                'xs': '0.8vw',
                's': '0.9vw',
                'm': '0.9vw',
                'l': '1.1vw',
                'xl': '1.2vw',
            }
        },
    };

    constructor() {

        // Init
        this.init();
    }

    /** 1.
     * init
     */
    init() {

        // INTERFACE
        this.elements.interfaceWrapperD3 = d3.select('#interfaceWrapper');

        // WRAPPERS & CONTAINS
        this.elements.toolingWrapperLD3 = this.elements.interfaceWrapperD3.select('#toolingWrapperL')
            .datum(this.settings.configs.elementWrappers.toolingWrapperL)
            .style('visibility', 'visible');
        this.elements.viewerWrapperD3 = this.elements.interfaceWrapperD3.select('#viewerWrapper')
            .datum(this.settings.configs.elementWrappers.interfaceWrapper);
        this.elements.toolingWrapperRD3 = this.elements.interfaceWrapperD3.select('#toolingWrapperR')
            .datum(this.settings.configs.elementWrappers.toolingWrapperR)
            .style('visibility', 'visible');
        const wrappersAll =
            [this.elements.toolingWrapperLD3, this.elements.viewerWrapperD3, this.elements.toolingWrapperRD3];
        wrappersAll.forEach(elD3 => {
            elD3
                .style('width', d => `${d.styleWidthAsPercent}%`);
        });

        // TITLES
        this.elements.toolingTitleL = this.elements.toolingWrapperLD3.select('.toolingTitle');
        this.elements.toolingTitleL.select('h1')
            .html('EXPLORE');
        this.elements.toolingTitleR = this.elements.toolingWrapperRD3.select('.toolingTitle');
        this.elements.toolingTitleR.select('h1')
            .html('ANALYZE');
        const titlesAll = [this.elements.toolingTitleL, this.elements.toolingTitleR];
        titlesAll.forEach(elD3 => {
            elD3
                .select('h1')
                .style('font-size', this.settings.configs.fontSizes.xl)
                .style('color', 'white');
        });

        // BUTTONS
        this.elements.toolingButtons = this.elements.interfaceWrapperD3.selectAll('.toolingButton')
            .on('click', this.onButtonClick.bind(this));

        // WINDOWS
        this.elements.toolingWindows = this.elements.interfaceWrapperD3.selectAll('.toolingWindow')
        this.elements.toolingWindows.selectAll('h1')
            .style('margin', '0 0 3vh 0')
            .style('font-size', this.settings.configs.fontSizes.l)
            .style('letter-spacing', '0.05vw')
            .style('color', 'white');
        this.elements.toolingWindows.selectAll('h2')
            .style('width', '100%')
            .style('font-size', this.settings.configs.fontSizes.xs)
            .style('margin', '1vh 0')
            .style('letter-spacing', '0.1vw')
            .style('color', 'white')
            .style('font-weight', 400)
            .style('display', 'flex')
            .style('flex-flow', 'row wrap')
            .style('align-items', 'center')
            .select('span')
            .style('font-size', this.settings.configs.fontSizes.xs)
            .style('color', 'orange');

        // Connect buttons and windows
        const buttons = Array.from(document.querySelectorAll('.toolingButton'));
        const windows = Array.from(document.querySelectorAll('.toolingWindow'));

        // Iterate and construct as data
        buttons.forEach(b => {

            const buttonMatchId = b.id.replace('toolingButton', '');

            const w = windows.find(w => w.id.includes(buttonMatchId));
            if (w) {
                this.datum.buttonsToWindows.push({
                    name: buttonMatchId,
                    parent: w.parentElement.parentElement.id,
                    //
                    buttonEl: b,
                    windowEl: w,
                    isActive: false,
                });
            }

        });

        // ... wrangle
        this.wrangle()
    }

    /** 2.
     * wrangle
     */
    wrangle() {

        // ... render
        this.render();
    }

    /** 3.
     * render
     */
    render() {

        // Interface setup
        this.elements.toolingWrapperLD3.select('.toolingContainAbs')
            .style('width', d => {
                if (d.isExpanded) {
                    return `${d.styleWidthExpandedAsVW}vw`
                }
                return '0';
            });
        this.elements.toolingWrapperRD3.select('.toolingContainAbs')
            .style('width', d => {
                if (d.isExpanded) {
                    return `${d.styleWidthExpandedAsVW}`
                }
                return '0';
            });

        // Buttons indicated, windows visible
        const activeHOnLeft = Math.floor(1 /
            this.datum.buttonsToWindows.filter(bw => bw.parent === 'toolingWrapperL' && bw.isActive).length * 100)
        this.datum.buttonsToWindows.forEach(bw => {

            d3.select(bw.buttonEl)
                .style('border', bw.isActive ? '0.05vw solid white' : '0.05vw solid transparent');
            d3.select(bw.windowEl)
                .style('height', !bw.isActive ? 0 : `${activeHOnLeft}%`);
        });

    }

    /** EVENT :: onButton
     * onButtonClick
     */
    onButtonClick(e, d) {

        // Update button
        const bw = this.datum.buttonsToWindows.find(bw => e.currentTarget.id.includes(bw.name));
        if (bw) {
            bw.isActive = !bw.isActive;
            this.wrangle();
        }

    }

}