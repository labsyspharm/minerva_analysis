import {LfNearestCellsAll} from "./lensingFilters/lfNearestCellsAll";
import {LfNearestCellsSel} from "./lensingFilters/lfNearestCellsSel";
import {LfChannelView} from "./lensingFilters/lfChannelView";
import {LfSegmentationOutlines} from "./lensingFilters/lfSegmentationOutlines";
import {LfChannelRelationships} from "./lensingFilters/LfChannelRelationships";
import {LfHistoSearch} from "./lensingFilters/lfHistoSearch";
import {LfMultiModal} from "./lensingFilters/lfMultiModal";
import {LfCellTypeAll} from "./lensingFilters/LfCellTypeAll";
import {LfSplit} from "./lensingFilters/LfSplit";
import {LfSpatialCorrelation} from "./lensingFilters/lfSpatialCorrelation";

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

        /////////////////////////////////////////////////////////////////////////////////////// Data load - channel view
        const lfChannelView = new LfChannelView(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////////////// Data load - nearest cells
        const lfNearestCellsSel = new LfNearestCellsSel(_imageViewer);

        /////////////////////////////////////////////////////////////////////////////////////// Data load - nearest cell
        const lfNearestCellsAll = new LfNearestCellsAll(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////// Data load - segmentation outlines
        const lfSegmentationOutlines = new LfSegmentationOutlines(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////// Data load - channel relationships
        const lfChannelRelationships = new LfChannelRelationships(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////////////////// Data load - histosnap
        const lfHistoSearch = new LfHistoSearch(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////////////////// Data load - histosnap
        const lfMultiModal = new LfMultiModal(_imageViewer);

        ////////////////////////////////////////////////////////////////////////////////////////// Data load - cell type
        const lFCellType = new LfCellTypeAll(_imageViewer);

        ///////////////////////////////////////////////////////////////////////////////////////// Data load - split lens
        const lfSplit= new LfSplit(_imageViewer);

        //////////////////////////////////////////////////////////////////////////////// Data load - spatial correlation
        const lfSpatialCorrelation= new LfSpatialCorrelation(_imageViewer);

        // Add in reverse order
        return [
            lfSegmentationOutlines.load,
            lfHistoSearch.load,
            lfSplit.load,
            lfMultiModal.load,
            lfChannelView.load,
            lFCellType.load,
            lfNearestCellsSel.load,
            lfNearestCellsAll.load,
            lfSpatialCorrelation.load,
            // lfChannelRelationships.load
        ];

    }
}
