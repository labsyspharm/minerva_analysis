
/**
 * @class CsvGatingOverlay
 *
 * TODO:
 *  1. Query only for add / remove channels; filter for gating adjustments
 *  2. Stall animation triggered draw iterations when awaiting query
 *  3. Make code more modular (move out of main) - maybe keep in imageViewer and csvGatingList
 *
 */

export class CsvGatingOverlay {

    // Vars
    canvas = null;
    cleared = true;
    context = null;
    force = false;
    image_rect = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        degrees: 0
    };
    viewer_rect = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        degrees: 0
    };
    range = [[], []];
    run_balancer = 0;
    show_centroids = false;

    // Configs
    configs = {
        radius: [2, 15],
        px_ratio: 2,
        stroke: 2
    }

    // Tools
    coord_scale_x = d3.scaleLinear();
    coord_scale_y = d3.scaleLinear();
    full_scale = [0, 360];
    channel_scale = d3.scaleLinear().range(this.full_scale);

    /**
     * @constructor
     *
     * @param _viewer
     */
    constructor(viewer, imageViewer) {

        // Init vars
        this.viewer = viewer;
        this.image_viewer = imageViewer;
        this.channel_list = channelList;
        this.gating_list = csv_gatingList;
        this.dataLayer = dataLayer;
        this.eventHandler = eventHandler;
        this.channel_scale.domain([0, 1]);
    }

    /**
     * @function toMagnitude
     * @param id - the cell id
     *
     * @returns {Array}
     */
    toMagnitude(id) {

      // Match to channel color
      const values = this.image_viewer.selection.get(id);
      const selections = this.gating_list.selections;
      const keys = Object.keys(selections);

      return keys.map((key) => {
        if (!(key in values)) {
          throw new TypeError(`Missing "${key}" in selection "${id}".`);
        }
        return values[key];
        /*
        if (values[key] >= channel[0] && values[key] <= channel[1]) {
          return values[key];
        }
        */
      });
    }

    /**
     * @function control
     *
     * @param show
     */
    control(show) {

        // Update mode
        this.show_centroids = show;

        // Trigger event
        this.eventHandler.trigger(CSVGatingList.events.GATING_BRUSH_END,
            this.gating_list.selections);
    }


}
