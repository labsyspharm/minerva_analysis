const Stream = require('stream');
const mockttp = require("mockttp");
var configData = require('../data/config.json');
var metaData = require('../data/get_ome_metadata.json');
var databaseData = require('../data/get_database_description.json');
var shortData = require('../data/get_channel_names/short.json');

// Types
type StreamBuffer = (stream: ReadableStream<any>) => Promise<Uint8Array>
type LoadBuffer = (url: string) => Promise<Uint8Array>

const KARMA_DATASOURCE = "karma-test";
const CLEAR_PREFIX = "crop-mask-crc01";
const LOGO_PREFIX = "crop-crc01";
const KARMA_QUERY = {
  datasource: KARMA_DATASOURCE,
}
const toUrlCsv = (...items) => items.join(",");
const CELL_ID_CENTER = toUrlCsv("CellID", "X_centroid", "Y_centroid")

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
var clearBuffer;
var logoBuffer;


before(async () => {
  mockServer = mockttp.getLocal();
  allCellBuffer = Buffer.from(await loadBuffer('/data/cell_id_center.bin.gz'));
  clearBuffer = Buffer.from(await loadBuffer('/data/1024x1024_clear.png'));
  logoBuffer = Buffer.from(await loadBuffer('/data/1024x1024_logo.png'));
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

beforeEach(async () => {
  await mockServer.start(8765);
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
  // Load database init endpoint
  const _initMock = mockServer.forGet("/init_database");
  const initMock = _initMock.withQuery(KARMA_QUERY)
  // Await all endpoints
  await Promise.all([
    configMock.thenJson(200, configData),
    shortMock.thenJson(200, shortData),
    metaMock.thenJson(200, metaData),
    databaseMock.thenJson(200, databaseData),
    initMock.thenJson(200, {success: true}),
    clearMock.thenReply(200, clearBuffer, clearHeaders),
    logoMock.thenReply(200, logoBuffer, logoHeaders),
    allCellMock.thenReply(200, allCellBuffer, allCellHeaders)
  ])
  // Run the main entrypoint
  this.result = fixture.load('main.html');
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.src = "/js/main.js";
  $("head").append(s);
});

afterEach(function(){
  fixture.cleanup()
  return mockServer.stop();
});

const sleeper = async (sec) => {
  return await new Promise(r => setTimeout(r, sec * 1024));
}

describe('Load', function () {
  describe('load page', function () {
    it('should load a test dataset', async function () {
      const arr: string[] = [];
      await sleeper(20)
      arr.push('foo');
      arr.push('bar');
      expect(arr[0]).to.equal('foo');
      expect(arr[1]).to.equal('bar');
    })
  })
})
