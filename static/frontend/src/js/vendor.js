import {Buffer} from 'buffer/';
import {PNG} from 'pngjs'
import 'popper.js'
import 'jquery'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'pngjs'
import {regeneratorRuntime} from "regenerator-runtime";
import * as d3 from 'd3';
import {sliderBottom} from 'd3-simple-slider';
import 'lodash'
import 'jquery-form'
import '@fortawesome/fontawesome-free/js/all'
import Sortable from 'sortablejs';
import Mark from 'mark.js'
import $ from 'jquery'
import 'node-fetch'
import convert from 'color-convert'
import * as OpenSeadragon from 'openseadragon';
import {ViewerManager} from './views/viewerManager';
import * as Lensing from 'lensing';
import {LensingFiltersExt} from './views/lensingFiltersExt';

window.convert = convert;
window.$ = $;
window.d3 = d3;
window.d3.sliderBottom = sliderBottom;
window.PNG = PNG;
window.Buffer = Buffer;
window.Sortable = Sortable;
window.Mark = Mark;
window.OpenSeadragon = OpenSeadragon;
window.ViewerManager = ViewerManager;
window.Lensing = Lensing;
window.LensingFiltersExt = LensingFiltersExt;

