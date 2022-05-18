const mockttp = require("mockttp")

const expect = chai.expect;
var mockServer; 

before(function(){
  mockServer = mockttp.getLocal();
  fixture.setBase('html')
});

beforeEach(function(){
  this.result = fixture.load('main.html');
  return mockServer.start(9876);
});

afterEach(function(){
  fixture.cleanup()
  return mockServer.stop();
});

const sleeper = async (sec) => {
  return await new Promise(r => setTimeout(r, sec * 1000));
}

describe('Array', function () {
  describe('.push()', function () {
    it('should append a value', async function () {
      const arr: string[] = [];
      await sleeper(2)
      arr.push('foo');
      arr.push('bar');
      expect(arr[0]).to.equal('foo');
      expect(arr[1]).to.equal('bar');
    })
  })
})
