const mockttp = require("mockttp")
var configData = require('../data/config.json')
var metaData = require('../data/get_ome_metadata.json')
var databaseData = require('../data/get_database_description.json')
var shortData = require('../data/get_channel_names/short.json')
const KARMA_DATASOURCE = "karma-test";
const KARMA_QUERY = {
  datasource: KARMA_DATASOURCE,
}

const expect = chai.expect;
var mockServer; 

before(function(){
  mockServer = mockttp.getLocal();
  fixture.setBase('html')
});

beforeEach(async () => {
  await mockServer.start(8765);
  // Load config endpoint
  const configString = JSON.stringify(configData);
  const configMock = mockServer.forGet("/config");
  await configMock.thenReply(200, configString);
  // Load channel names endpoint
  const shortString = JSON.stringify(shortData);
  const _shortMock = mockServer.forGet("/get_channel_names");
  const shortMock = _shortMock.withQuery({
    ...KARMA_QUERY,
    shortNames: "true"
  })
  await shortMock.thenReply(200, shortString);
  // Load ome metadata endpoint
  const metaString = JSON.stringify(metaData);
  const _metaMock = mockServer.forGet("/get_ome_metadata");
  const metaMock = _metaMock.withQuery(KARMA_QUERY)
  await metaMock.thenReply(200, metaString);
  // Load ome database description endpoint
  const databaseString = JSON.stringify(databaseData);
  const _databaseMock = mockServer.forGet("/get_database_description");
  const databaseMock = _databaseMock.withQuery(KARMA_QUERY)
  await databaseMock.thenReply(200, databaseString);
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
  return await new Promise(r => setTimeout(r, sec * 1000));
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
