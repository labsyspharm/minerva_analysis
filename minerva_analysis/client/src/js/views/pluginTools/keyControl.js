/**
 * @class KeyControl
 */
export class KeyControl {

    // Configs
    configs = {
        isOpen: false,
        justOpened: false,
    };

    // Elements
    els = {
        container: null,
    };

    /**
     * @constructor
     */
    constructor(_parent) {
        this.parent = _parent;

        // Some globals
        this.imageViewer = seaDragonViewer;
    }

    /** 1.
     * @function init
     */
    init() {
    }

    /** 2.
     * @function load
     */
    async load() {

        // Show
        this.configs.isOpen = true;

        // One time construction
        this.buildBasicStructure();

        // Set as just opened
        this.configs.justOpened = true;

    }

    /** 3.
     * @function destroy
     */
    destroy() {

        // Hide
        this.configs.isOpen = false;
    }

    /**
     * buildBasicStructure
     */
    buildBasicStructure() {

        // Clear
        this.parent.els.toolboxEl.selectAll('*').remove();

        // Add container
        this.els.container = this.parent.els.toolboxEl.append('div')
            .attr('class', 'toolboxContainer')
        let row = this.els.container.append('div')
            .attr('class', 'toolboxTop')
        row.append('div')
            .append('h1')
            .text('Key Control');
        const tooltopDiv = this.els.container.append('div')
            .attr('class', 'lensingControl');
        // tooltopDiv.append('h2')
        //     .text('');
        // tooltopDiv.append('h3')
        //     .text('Lens visibility');
        // tooltopDiv.append('p')
        //     .html('<span>l</span> - toggle visibility')
        tooltopDiv.append('h3')
            .text('Lens shape');
        tooltopDiv.append('p')
            .html('<span>L</span> <span>&#8679;l</span> - toggle shape')
        tooltopDiv.append('h3')
            .text('Lens filters');
        tooltopDiv.append('p')
            .html('<span>{</span> <span>&#8679;]</span> - previous')
        tooltopDiv.append('p')
            .html('<span>}</span> <span>&#8679;[</span> - next')
        tooltopDiv.append('p')
            .html('<span>|</span> <span>&#8679;\\</span> - none')
        tooltopDiv.append('h3')
            .text('Lens size');
        tooltopDiv.append('p')
            .html('<span>[</span> - reduce')
        tooltopDiv.append('p')
            .html('<span>]</span> - increase')
        tooltopDiv.append('p')
            .html('<span>\\</span> - increase')
        tooltopDiv.append('h3')
            .text('Lens magnification');
        tooltopDiv.append('p')
            .html('<span>m</span> - toggle modes')
        tooltopDiv.append('p')
            .html('<span>,</span> - zoom out')
        tooltopDiv.append('p')
            .html('<span>.</span> - zoom in')
        tooltopDiv.append('p')
            .html('<span>/</span> - no zoom')
        tooltopDiv.append('h3')
            .text('Lens placement');
        tooltopDiv.append('p')
            .html('<span>p</span> - toggle motion')
        tooltopDiv.append('h3')
            .text('Lens dot');
        tooltopDiv.append('p')
            .html('<span>D</span>  <span>&#8679;d</span> - snapshot')

    }
}