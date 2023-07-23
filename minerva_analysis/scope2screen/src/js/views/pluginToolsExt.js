import {PtDotter} from "./pluginTools/ptDotter";
import {KeyControl} from "./pluginTools/keyControl";

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
        },
        'plugin_keys': {
            instance: new KeyControl(this)
        }
    }
    selections = {
        activePlugin: ''
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

        // Click
        this.els.pluginEls.on('click', this.trayEventClick.bind(this));

        // Keyboard
        document.addEventListener('keydown', e => {

            if (e.key === 'D') {
                if (this.selections.activePlugin) {

                    // Selection
                    this.selections.activePlugin = 'plugin_dotter';

                    // Emulate click
                    this.trayEventClickForce('plugin_dotter');
                }
            }
        });
    }

    /**
     * @function destroyPluginTool
     *
     * @returns void
     */
    destroyPluginTool(ref) {

        this.plugins[ref].instance.destroy();
    }

    /**
     * @function loadPluginTool
     *
     * @returns void
     */
    loadPluginTool(ref) {

        setTimeout(() => {
            this.plugins[ref].instance.load();
        }, this.configs.duration * 2);
    }

    /**
     * @function trayEventClick
     *
     * @returns void
     */
    trayEventClick(e) {

        // Check
        if (this.selections.activePlugin !== e.currentTarget.id) {

            // Selection
            this.selections.activePlugin = e.currentTarget.id;

            // Load
            this.loadPluginTool(e.target.parentElement.id);

            // Update
            this.opened = true;
        } else {

            // Selection
            this.selections.activePlugin = '';

            // Load
            this.destroyPluginTool(e.target.parentElement.id);

            // Update
            this.opened = false;
        }

        // Widths
        this.trayOpenClose();

    }

    /**
     * @function trayEventClickForce
     *
     * @returns void
     */
    trayEventClickForce(pluginId) {

        // Update
        this.opened = true;

        // Widths
        this.trayOpenClose();

        // Load
        this.loadPluginTool(pluginId);

    }

    /**
     * @function trayOpenClose
     *
     * @returns void
     */
    trayOpenClose() {

        //
        if (this.opened) {
            this.els.openseadragonEl.transition().duration(this.configs.duration).style('width', this.configs.osdOpenW);
            this.els.toolboxEl.transition().duration(this.configs.duration).style('width', this.configs.tbOpenW);
        } else {
            this.els.openseadragonEl.transition().duration(this.configs.duration).style('width', this.configs.osdClosedW);
            this.els.toolboxEl.transition().duration(this.configs.duration).style('width', this.configs.tbClosedW);
        }
    }


}