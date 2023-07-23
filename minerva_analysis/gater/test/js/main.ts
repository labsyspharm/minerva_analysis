const d3 = require('d3');
const sinon = require('sinon');
const Stream = require('stream');
const mockttp = require("mockttp");
var configData = require('../data/config.json');
var metaData = require('../data/get_ome_metadata.json');
var channelForm = require('../data/formData/download_channels.json');
var rangeForm = require('../data/formData/gated_channel_ranges.json');
var encodingForm = require('../data/formData/gated_cell_encodings.json');
var databaseData = require('../data/get_database_description.json');
var channelGMM0 = require('../data/get_channel_gmm/Hoechst0.json');
var gatingGMM0 = require('../data/get_gating_gmm/Hoechst0.json');
var shortData = require('../data/get_channel_names/short.json');

// These are set in test/fixtures/context.html
declare var __GLOBAL__RESET__FUNCTION__: () => void;
declare var __GLOBAL__INITIALIZATION__FUNCTION__: () => void;
// Types
type StreamBuffer = (stream: ReadableStream<any>) => Promise<Uint8Array>
type LoadBuffer = (url: string) => Promise<Uint8Array>
type LoadText = (url: string) => Promise<string>
declare var __minervaAnalysis: MinervaAnalysis;
type TopColors = {
  colors: string[],
  counts: number[]
}

// Types defined by application
const OpenSeadragon = require("openseadragon");
type Viewer = typeof OpenSeadragon.Viewer;
type World = typeof OpenSeadragon.World;
interface ViewerManager {
  viewer: Viewer;
}
interface SeaDragonViewer {
  viewerManagers: ViewerManager[];
}
interface CsvGatingList {
  seaDragonViewer: SeaDragonViewer;
  download_panel_visible: boolean;
}
interface Rainbow {
  show(x: number, y: number): void;
  set(hsl: any): void;
}
interface ChannelList {
  colorTransferHandle: any;
  rainbow: Rainbow; 
}
interface MinervaAnalysis {
  csv_gatingList: CsvGatingList;
  channelList: ChannelList;
}

const MOCK_PORT = 8765;
const KARMA_DATASOURCE = "karma-test";
const CLEAR_PREFIX = "crop-mask-crc01";
const LOGO_PREFIX = "crop-crc01";
const CHANNEL_ZERO = "Hoechst0";
const KARMA_QUERY = {
  datasource: KARMA_DATASOURCE,
}
const toUrlCsv = (...items) => items.join(",");
const CELL_ID_CENTER = toUrlCsv("CellID", "X_centroid", "Y_centroid");

const toHeaders = (bytes: number, meaning: string) => {
  const extraHeaders = {
    'png': {
      'Content-Type': 'image/PNG',
    },
    'gzip': {
      'Content-Encoding': 'gzip',
      'Content-Type': 'application/octet-stream',
    }
  }[meaning]
  return { 
    ...extraHeaders,
    'Content-Length': bytes
  }
}

const expect = chai.expect;
var mockServer; 
var allCellBuffer;
var c0CellBuffer;
var clearBuffer;
var logoBuffer;


before(async () => {
  mockServer = mockttp.getLocal();
  allCellBuffer = Buffer.from(await loadBuffer('/data/cell_id_center.bin.gz'));
  c0CellBuffer = Buffer.from(await loadBuffer('/data/cell_hoechst.bin.gz'));
  clearBuffer = Buffer.from(await loadBuffer('/data/1024x1024_clear.png'));
  logoBuffer = Buffer.from(await loadBuffer('/data/1024x1024_logo.png'));
  await __GLOBAL__INITIALIZATION__FUNCTION__();
  fixture.setBase('html')
});


function streamToAsyncIterator(readable : ReadableStream) : AsyncIterableIterator<Uint8Array> {
  const reader = readable.getReader();
  return {
    next(){
      return reader.read();
    },
    return(){
      return reader.releaseLock();
    },
    [Symbol.asyncIterator](){
      return this;
    }
  } as AsyncIterableIterator<Uint8Array>;
}

const streamBuffer: StreamBuffer = async (readable) => {
  let chunks: number[] = [];
  const iterable = streamToAsyncIterator(readable);
  for await (const chunk of iterable) {
    for (const value of chunk) {
      chunks.push(value);
    }
  }
  return Uint8Array.from(chunks);
}

const loadBuffer: LoadBuffer = async (url) => {
  const stream = (await fetch(url)).body;
  return await streamBuffer(stream);
}

const loadText: LoadText = async (url) => {
  return (await fetch(url)).text();
}

const getProperty = (scope: any, k: string | symbol) => {
  const v = scope[k];
  return typeof v === "function" ? v.bind(scope) : v;
};

const fakeCreateElement = (formCallback) => {
  const { createElement } = document;
  return (...args) => {
    const el = createElement.apply(document, args);
    if (args[0] == "form") {
      el.submit = function() {
        const els = [...this.elements];
        const formData = els.reduce((o, i) => {
          return {...o, [i.name]: i.value};
        }, {});
        formCallback(formData);
      }
    }
    return el;
  };
}

beforeEach(async () => {

  await mockServer.start(MOCK_PORT);
  // Load config endpoint
  const configString = JSON.stringify(configData);
  const configMock = mockServer.forGet("/config");
  // Load channel names endpoint
  const _shortMock = mockServer.forGet("/get_channel_names");
  const shortMock = _shortMock.withQuery({
    ...KARMA_QUERY,
    shortNames: "true"
  })
  // Load ome metadata endpoint
  const _metaMock = mockServer.forGet("/get_ome_metadata");
  const metaMock = _metaMock.withQuery(KARMA_QUERY)
  // Load ome database description endpoint
  const _databaseMock = mockServer.forGet("/get_database_description");
  const databaseMock = _databaseMock.withQuery(KARMA_QUERY)
  // Load clear image endpoints
  const prefix = `/generated/data/${KARMA_DATASOURCE}`;
  const clearRegExp = `^${prefix}/${CLEAR_PREFIX}-.*`
  const clearHeaders = toHeaders(clearBuffer.length, 'png');
  const clearMock = mockServer.forGet(new RegExp(clearRegExp));
  // Load logo image endpoints
  const logoRegExp = `${prefix}/${LOGO_PREFIX}-.*`
  const logoHeaders = toHeaders(logoBuffer.length, 'png');
  const logoMock = mockServer.forGet(new RegExp(logoRegExp));
  // Load cell index endpoint
  const allCellHeaders = toHeaders(allCellBuffer.length, 'gzip');
  const _allCellMock = mockServer.forGet("/get_all_cells/integer/");
  const allCellMock = _allCellMock.withQuery({
    ...KARMA_QUERY,
    start_keys: CELL_ID_CENTER 
  });
  // Load cell gating keys endpoint
  const c0CellHeaders = toHeaders(c0CellBuffer.length, 'gzip');
  const _c0CellMock = mockServer.forGet("/get_all_cells/float/");
  const c0CellMock = _c0CellMock.withQuery({
    ...KARMA_QUERY,
    start_keys: CHANNEL_ZERO 
  });
  // Load database init endpoint
  const _initMock = mockServer.forGet("/init_database");
  const initMock = _initMock.withQuery(KARMA_QUERY)
  // Load channel data endpoints
  const _channelGMM0Mock = mockServer.forGet("/get_channel_gmm");
  const channelGMM0Mock = _channelGMM0Mock.withQuery({
    ...KARMA_QUERY,
    channel: CHANNEL_ZERO 
  });
  // Load gating data endpoints
  const _gatingGMM0Mock = mockServer.forGet("/get_gating_gmm");
  const gatingGMM0Mock = _gatingGMM0Mock.withQuery({
    ...KARMA_QUERY,
    channel: CHANNEL_ZERO 
  });
  // Download channels
  const channelsMock = mockServer.forPost("/download_channels_csv");
  const gatingMock = mockServer.forPost("/download_gating_csv");
  // Await all endpoints
  await Promise.all([
    configMock.thenJson(200, configData),
    shortMock.thenJson(200, shortData),
    metaMock.thenJson(200, metaData),
    databaseMock.thenJson(200, databaseData),
    channelGMM0Mock.thenJson(200, channelGMM0),
    gatingGMM0Mock.thenJson(200, gatingGMM0),
    initMock.thenJson(200, {success: true}),
    clearMock.thenReply(200, clearBuffer, clearHeaders),
    logoMock.thenReply(200, logoBuffer, logoHeaders),
    c0CellMock.thenReply(200, c0CellBuffer, c0CellHeaders),
    allCellMock.thenReply(200, allCellBuffer, allCellHeaders),
    channelsMock.thenCallback(() => ''),
    gatingMock.thenCallback(() => '')
])
  // Run the main entrypoint
  this.result = fixture.load('main.html');
  __GLOBAL__RESET__FUNCTION__();
});

afterEach(function(){
  fixture.cleanup();
  const els = [
    ...document.getElementsByClassName("picker-container")
  ]
  for (const el of els) {
    el.remove();
  }
  return mockServer.stop();
  // Restore spies
  sinon.restore();
});

const sleeper = async (sec: number) => {
  return await new Promise(r => setTimeout(r, sec * 1024));
}

const setChannelColorZero = async (color: string) => {
  const cList = document.getElementById("channel_list");
  const cEl = cList.getElementsByClassName("list-group-item")[0];
  const rect = cEl.getElementsByTagName("rect")[0];
  const { x, y } = rect.getBoundingClientRect();
  const { channelList } = __minervaAnalysis;
  channelList.colorTransferHandle = d3.select(rect);
  const { rainbow } = channelList;
  const hsl = d3.hsl(color);
  rainbow.show(x, y);
  await sleeper(0.25);
  rainbow.set(hsl);
  await sleeper(0.25);
  const pick = document.getElementsByClassName("picker-container")[0];
  const checkmark = pick.getElementsByClassName("save")[0];
  $(checkmark).click();
  await sleeper(0.25);
}

const clickChannelZero = async (t: number) => {
  const cList = document.getElementById("channel_list");
  const cEl = cList.getElementsByClassName("list-group-item")[0];
  $(cEl).click();
  await sleeper(t);
}

const clickMaskZero = async (t: number) => {
  const cList = document.getElementById("csv_gating_list");
  const cEl = cList.getElementsByClassName("list-group-item")[0];
  $(cEl).click();
  await sleeper(t);
}

const toWorld = (): World => {
  const { csv_gatingList } = __minervaAnalysis;
  const { seaDragonViewer } = csv_gatingList;
  const { viewerManagers } = seaDragonViewer;
  return viewerManagers[0].viewer.world;
}

const toImageData = (): ImageData => {
  const rootEl = document.getElementById("openseadragon");
  const el = document.getElementsByTagName("canvas")[0];
  const context = el.getContext("2d");
  const width = context.canvas.clientWidth;
  const height = context.canvas.clientHeight;
  return context.getImageData(0, 0, width, height);
}

const toHexColor = (r, g, b) => {
  return [r, g, b].map(n => {
    return n.toString(16).padStart(2, 0);
  }).join('')
}

const toTopColors = (): TopColors => {
  const { data } = toImageData();
  const hist = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const hex = toHexColor(r, g, b);
    const freq = hist.has(hex) ? hist.get(hex) : 0;
    hist.set(hex, freq + 1);
  }
  const sorted = [...hist].sort((a, b) => b[1] - a[1])
  const colors = sorted.map(v => v[0]);
  const counts = sorted.map(v => v[1]);
  return {
    colors,
    counts
  }
}

describe('Load', function () {
  describe('Ensure basic loading', function () {
    it('must load a channel', async function () {
      await sleeper(1);
      const world = toWorld();
      const itemCountBefore = world.getItemCount();
      await clickChannelZero(0.5);
      const itemCountAfter = world.getItemCount();
      expect(itemCountBefore).to.equal(1);
      expect(itemCountAfter).to.equal(2);
    })
  })
  describe('Ensure visual rendering', function () {
    it('must load a mask', async function () {
      await sleeper(1);
      const world = toWorld();
      await clickChannelZero(1);
      await clickMaskZero(1);
      // Disable outline mode
      await $('#gating_controls_outlines').click();
      await sleeper(1);
      // Ensure expected white/black ratio
      (({ colors, counts }: TopColors) => {
        const white_ratio = counts[0] / (counts[0] + counts[1]);
        white_ratio.should.be.approximately(0.5058, 0.01);
        expect(colors[0]).to.equal('ffffff');
        expect(colors[1]).to.equal('000000');
      })(toTopColors());
      // Set channel color
      await setChannelColorZero('#0000ff');
      // Enable outline mode
      await $('#gating_controls_outlines').click();
      await sleeper(1);
      // Ensure expected black/blue ratio
      (({ colors, counts }: TopColors) => {
        const blue_ratio = counts[0] / (counts[0] + counts[1]);
        blue_ratio.should.be.approximately(0.5932, 0.01);
        expect(colors[0]).to.equal('000000');
        expect(colors[1]).to.equal('000093');
      })(toTopColors());
      await sleeper(1);
    })
  })
  describe('Ensure download list', function () {
    it('must download channel list', async function () {
      await sleeper(1);
      const formPath = '/data/formData/download_channels.json';
      // Check form parameters
      const formCallback = (formData) => {
        expect(formData).to.deep.equal(channelForm);
      }
      const toEl = fakeCreateElement(formCallback);
      sinon.stub(document, 'createElement').callsFake(toEl);
      const cIcon = document.getElementById("channels_download_icon");
      cIcon.dispatchEvent(new Event('click'));
      const called = (document.createElement as any).getCall(0);
      expect(called.calledWith('form')).to.equal(true);
      sinon.restore();
      await sleeper(3);
    })
  })
  describe('Ensure download ranges', function () {
    it('must download channel ranges', async function () {
      await sleeper(1);
      const panel = document.getElementById('gating_download_panel');
      const { csv_gatingList } = __minervaAnalysis;
      csv_gatingList.download_panel_visible = true;
      (panel as HTMLElement).style.visibility = 'visible';
      // Check form parameters
      const formCallback = (formData) => {
        expect(formData).to.deep.equal(rangeForm);
      }
      const toEl = fakeCreateElement(formCallback);
      sinon.stub(document, 'createElement').callsFake(toEl);
      const gId = "download_gated_channel_ranges";
      const gIcon = document.getElementById(gId);
      gIcon.dispatchEvent(new Event('click'));
      const called = (document.createElement as any).getCall(0);
      expect(called.calledWith('form')).to.equal(true);
      sinon.restore();
      await sleeper(3);
    })
  })
  describe('Ensure download encodings', function () {
    it('must download cell encodings', async function () {
      await sleeper(1);
      const panel = document.getElementById('gating_download_panel');
      const { csv_gatingList } = __minervaAnalysis;
      csv_gatingList.download_panel_visible = true;
      (panel as HTMLElement).style.visibility = 'visible';
      // Check form parameters
      const formCallback = (formData) => {
        expect(formData).to.deep.equal(encodingForm);
      }
      const toEl = fakeCreateElement(formCallback);
      sinon.stub(document, 'createElement').callsFake(toEl);
      const gId = "download_gated_cell_encodings";
      const gIcon = document.getElementById(gId);
      gIcon.dispatchEvent(new Event('click'));
      const called = (document.createElement as any).getCall(0);
      expect(called.calledWith('form')).to.equal(true);
      sinon.restore();
      await sleeper(3);
    })
  })
})
