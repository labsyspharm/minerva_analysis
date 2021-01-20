import {PtDotter} from "./pluginTools/ptDotter";

/**
 * @class PluginToolsExt
 */

export class PluginToolsExt {

    // Class vars
    configs = {
        duration: 250,
        opened: false,
        tbClosedW: '0',
        tbOpenW: '17.5%',
        osdClosedW: '97.5%',
        osdOpenW: '80%',
    }
    els = {
        openseadragonEl: null,
        pluginEls: null,
        toolboxEl: null,
        trayEl: null
    }
    plugins = {
        'plugin_dotter': {
            instance: new PtDotter(this)
        }
    }

    /**
     * @constructor
     */
    constructor() {
        this.init();
    }

    /** 1.
     * @function init
     *
     * @returns void
     */
    init() {

        // Get toolbox, pluginTools
        this.els.openseadragonEl = d3.select('#openseadragon');
        this.els.toolboxEl = d3.select('#toolbox');
        this.els.trayEl = d3.select('#tray');
        this.els.pluginEls = this.els.trayEl.selectAll('.plugin');

        // Add events
        this.addEvents();

    }

    /**
     * @function addEvents
     *
     * @returns void
     */
    addEvents() {

        this.els.trayEl.on('click', this.trayEventClick.bind(this));
    }

    /**
     * @function loadPluginTool
     *
     * @returns void
     */
    loadPluginTool(ref) {

        this.plugins[ref].instance.load();
    }

    /**
     * @function trayClick
     *
     * @returns void
     */
    trayEventClick(e) {

        // Update
        this.opened = !this.opened;

        // Widths
        this.trayOpenClose();

        // Load
        this.loadPluginTool(e.target.parentElement.id);


    }

    /**
     * @function trayOpenClose
     *
     * @returns void
     */
    trayOpenClose() {


        //
        if (this.opened) {
            this.els.openseadragonEl.transition(this.configs.duration).style('width', this.configs.osdOpenW);
            this.els.toolboxEl.transition(this.configs.duration).style('width', this.configs.tbOpenW);
        } else {
            this.els.openseadragonEl.transition(this.configs.duration).style('width', this.configs.osdClosedW);
            this.els.toolboxEl.transition(this.configs.duration).style('width', this.configs.tbClosedW);
        }
    }


}