const expect = chai.expect;
var OpenSeadragon;

before(function(){
  console.log({h: window.__html__})
	fixture.setBase('./fixtures')
});

beforeEach(async function(){
  OpenSeadragon = window.OpenSeadragon;
  console.log(fixture.base)
	this.result = fixture.load('main.html');
	await new Promise((resolve) => {
    $.getScript("/osd/openseadragon-scalebar.js", function() {
      $.getScript("/js/main.js", function(){
        console.log("Loaded main.js");
        resolve();
      });
    });
	})
});

afterEach(function(){
	fixture.cleanup()
});

describe('Array', function () {
  describe('.push()', function () {
    it('should append a value', function () {
      var arr = [];
      arr.push('foo');
      arr.push('bar');
      expect(arr[0]).to.equal('foo');
      expect(arr[1]).to.equal('bar');
    })

    it('should return the length', function () {
      var arr = [];
      var n = arr.push('foo');
      expect(n).to.equal(1);
      n = arr.push('bar');
      expect(n).to.equal(2);
    })

    describe('with many arguments', function () {
      it('should add the values', function () {
        var arr = [];
        arr.push('foo', 'bar');
        expect(arr[0]).to.equal('foo');
        expect(arr[1]).to.equal('bar');
      })
    })
  })

  describe('.unshift()', function () {
    it('should prepend a value', function () {
      var arr = [1, 2, 3];
      arr.unshift('foo');
      expect(arr[0]).to.equal('foo');
      expect(arr[1]).to.equal(1);
    })

    it('should return the length', function () {
      var arr = [];
      var n = arr.unshift('foo');
      expect(n).to.equal(1);
      n = arr.unshift('bar');
      expect(n).to.equal(2);
    })

    describe('with many arguments', function () {
      it('should add the values', function () {
        var arr = [];
        arr.unshift('foo', 'bar');
        expect(arr[0]).to.equal('foo');
        expect(arr[1]).to.equal('bar');
      })
    })
  })

  describe('.pop()', function () {
    it('should remove and return the last value', function () {
      var arr = [1, 2, 3];
      expect(arr.pop()).to.equal(3);
      expect(arr.pop()).to.equal(2);
      expect(arr).to.have.length(1);
    })
  })

  describe('.shift()', function () {
    it('should remove and return the first value', function () {
      var arr = [1, 2, 3];
      expect(arr.shift()).to.equal(1);
      expect(arr.shift()).to.equal(2);
      expect(arr).to.have.length(1);
    })
  })
})
