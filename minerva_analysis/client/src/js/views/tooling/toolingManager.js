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
                    styleWidthExpandedAsVW: 18,
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
                    isExpanded: true,
                    stylePosition: 'absolute',
                    stylePositioning: {
                        top: 0,
                        right: 0,
                        bottom: 'unset',
                        left: 'unset',
                    },
                    styleWidthAsPercent: 3.75,
                    styleWidthExpandedAsVW: 21,
                    styleZIndex: 2,
                    visible: true,
                },
            },
            fontSizes: {
                'xs': '0.7vw',
                's': '0.9vw',
                'm': '1.1vw',
                'l': '1.3vw',
                'xl': '1.5vw',
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
        this.elements.toolingWindows = this.elements.interfaceWrapperD3.selectAll('.toolingWindow');

        this.elements.toolingWindows.selectAll('.title')
            .style('margin', '0 0 1vh 0')
            .style('font-size', this.settings.configs.fontSizes.l)
            .style('letter-spacing', '0.05vw')
            .style('padding', '0 10% 0 0')
            .style('color', 'white');
        this.elements.toolingWindows.selectAll('.description')
            .style('width', '100%')
            .style('font-size', this.settings.configs.fontSizes.xs)
            .style('color', 'rgba(255, 255, 255, 0.8')
            .style('padding', '0 10% 0 0');

        this.elements.toolingWindows.selectAll('.subtitle')
            .style('width', '100%')
            .style('font-size', this.settings.configs.fontSizes.s)
            .style('margin', '1vh 0')
            .style('letter-spacing', '0.1vw')
            .style('color', 'white')
            .style('font-weight', 600)
            .style('display', 'flex')
            .style('flex-flow', 'row wrap')
            .style('align-items', 'center')
            .select('span')
            .style('font-size', this.settings.configs.fontSizes.s)
            .style('color', 'orange');

        // Connect buttons and windows
        const buttonsL = Array.from(document.querySelectorAll('#toolingWrapperL .toolingButton'));
        const windowsL = Array.from(document.querySelectorAll('#toolingWrapperL .toolingWindow'));
        const buttonsR = Array.from(document.querySelectorAll('#toolingWrapperR .toolingButton'));
        const windowsR = Array.from(document.querySelectorAll('#toolingWrapperR .toolingWindow'));

        // Add to buttons
        function buildButtons(buttons, windows, group) {

            const buttonsArr = [];

            // Iterate and construct as data
            buttons.forEach(b => {

                const buttonMatchId = b.id.replace('toolingButton', '');

                const w = windows.find(w => w.id.includes(buttonMatchId));
                if (w) {
                    buttonsArr.push({
                        name: buttonMatchId,
                        parent: w.parentElement.parentElement.id,
                        group,
                        //
                        buttonEl: b,
                        windowEl: w,
                        windowH: 0,
                        isActive: false,
                    });
                }

            });
            return buttonsArr;
        }

        //
        this.datum.buttonsToWindows = [];
        this.datum.buttonsToWindows.push(...buildButtons(buttonsL, windowsL, 'l'));
        this.datum.buttonsToWindows.push(...buildButtons(buttonsR, windowsR, 'r'));

        // Also add

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
                    return `${d.styleWidthExpandedAsVW}vw`;
                }
                return '0';
            });
        this.elements.toolingWrapperRD3.select('.toolingContainAbs')
            .style('width', d => {
                if (d.isExpanded) {
                    return `${d.styleWidthExpandedAsVW}vw`;
                }
                return '0';
            });

        // Buttons indicated, windows visible
        const buttonsL = this.datum.buttonsToWindows.filter(bw => bw.group === 'l');
        const buttonsR = this.datum.buttonsToWindows.filter(bw => bw.group === 'r');

        // Check buttons to manage windows
        function evalButtonsToWindows(buttons) {

            const buttonsInactive = buttons.filter(b => !b.isActive);
            buttonsInactive.forEach(b => {

                b.windowH = 0;
                d3.select(b.buttonEl).style('border', '0.05vw solid transparent');
                d3.select(b.windowEl).style('height', `${b.windowH}`);
            });

            const buttonsActive = buttons.filter(b => b.isActive);
            const buttonsActiveH = buttonsActive.length > 0 ? Math.floor(1 / buttonsActive.length * 100) : 0;
            buttonsActive.forEach((b, i) => {

                b.windowH = buttonsActiveH;
                d3.select(b.buttonEl).style('border', '0.05vw solid white');
                d3.select(b.windowEl).style('height', `${b.windowH}%`);

                if (i < buttonsActive.length - 1) {
                    const grabBar = d3.select(b.windowEl)
                        .append('div')
                        .attr('class', 'toolingWindowGrabBar')
                        .style('padding', '0 0.5vw 0 0');
                    grabBar.append('div')
                        .attr('class', 'toolingWindowGrabBarLine');
                    grabBar.append('div')
                        .attr('class', 'toolingWindowGrabBarTriangle')
                        .html('&#9664;');
                }
            });

        }

        evalButtonsToWindows(buttonsL);
        evalButtonsToWindows(buttonsR);


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