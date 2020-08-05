import {Buffer} from 'buffer/';
import {PNG} from 'pngjs'
import 'popper.js'
import 'jquery'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'pngjs'
import * as d3 from 'd3';
import 'lodash'
import 'jquery-form'
import '@fortawesome/fontawesome-free/js/all'
import Sortable from 'sortablejs';
import Mark from 'mark.js'
import $ from 'jquery'
import 'node-fetch'
import convert from 'color-convert'
import * as l from 'lensing';
import {ViewerManager} from './viewerManager'

window.convert = convert;
window.$ = $;
window.d3 = d3;
window.PNG = PNG;
window.Buffer = Buffer;
window.Sortable = Sortable;
window.Mark = Mark;
window.l = l;
window.ViewerManager = ViewerManager;

