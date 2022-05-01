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
import 'viawebgl'
import * as viaWebGL from 'viawebgl';
import {ViewerManager} from './views/viewerManager';
import Dropzone from 'dropzone';

window.convert = convert;
window.$ = $;
window.d3 = d3;
window.d3.sliderBottom = sliderBottom;
window.PNG = PNG;
window.Buffer = Buffer;
window.Sortable = Sortable;
window.Mark = Mark;
window.OpenSeadragon = viaWebGL.OpenSeadragon;
window.Dropzone = Dropzone;
window.viaWebGL = viaWebGL;
window.ViewerManager = ViewerManager;

