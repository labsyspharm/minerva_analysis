import {LfNearestCell} from "./lensingFilters/lfNearestCell";
import {LfNearestCells} from "./lensingFilters/lfNearestCells";
import {LfChannelView} from "./lensingFilters/lfChannelView";

/**
 * @class LensingFiltersExt
 */
export class LensingFiltersExt {

    /**
     * @function getFilters
     *
     * @param _imageViewer
     * @returns array
     */
    static getFilters(_imageViewer) {

        const imageViewer = _imageViewer;

        /////////////////////////////////////////////////////////////////////////////////////// Data load - channel view
        const lfChannelView = new LfChannelView(imageViewer)

        ////////////////////////////////////////////////////////////////////////////////////// Data load - nearest cells
        const lfNearestCells = new LfNearestCells(imageViewer)

        /////////////////////////////////////////////////////////////////////////////////////// Data load - nearest cell
        const lfNearestCell = new LfNearestCell(imageViewer)

        // Add in reverse order
        return [lfNearestCells.load, lfNearestCell.load, lfChannelView.load];

    }
}
