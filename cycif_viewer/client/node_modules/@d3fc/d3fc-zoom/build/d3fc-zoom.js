(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-dispatch'), require('d3-selection'), require('d3-zoom'), require('@d3fc/d3fc-rebind')) :
    typeof define === 'function' && define.amd ? define(['exports', 'd3-dispatch', 'd3-selection', 'd3-zoom', '@d3fc/d3fc-rebind'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.fc = global.fc || {}, global.d3, global.d3, global.d3, global.fc));
}(this, (function (exports, d3Dispatch, d3Selection, d3Zoom, d3fcRebind) { 'use strict';

    var domainsEqual = function domainsEqual(a, b) {
      if (a == null && b == null) {
        return true;
      }

      var aDomain = a.domain();
      var bDomain = b.domain();
      return aDomain.length === bDomain.length && aDomain.every(function (d, i) {
        var _bDomain$i;

        return (d === null || d === void 0 ? void 0 : d.valueOf()) === ((_bDomain$i = bDomain[i]) === null || _bDomain$i === void 0 ? void 0 : _bDomain$i.valueOf());
      });
    };

    var subtract = function subtract(a, b) {
      return d3Zoom.zoomIdentity.scale(a.k / b.k).translate(a.x - b.x, a.y - b.y);
    };

    var symbol = Symbol('d3fc-domain-zoom');
    var zoom = (function () {
      var dispatcher = d3Dispatch.dispatch('zoom');
      var zoomer = d3Zoom.zoom().on('zoom', function (_ref) {
        var transform = _ref.transform;
        var node = this;
        var updatedTransform = transform;
        var _node$symbol = node[symbol],
            originalXScale = _node$symbol.originalXScale,
            previousXScale = _node$symbol.previousXScale,
            xScale = _node$symbol.xScale,
            originalYScale = _node$symbol.originalYScale,
            previousYScale = _node$symbol.previousYScale,
            yScale = _node$symbol.yScale,
            previousTransform = _node$symbol.previousTransform;

        if (!domainsEqual(previousXScale, xScale) || !domainsEqual(previousYScale, yScale)) {
          originalXScale = xScale === null || xScale === void 0 ? void 0 : xScale.copy();
          originalYScale = yScale === null || yScale === void 0 ? void 0 : yScale.copy();
          updatedTransform = subtract(transform, previousTransform);
        }

        if (xScale != null) {
          previousXScale = updatedTransform.rescaleX(originalXScale.range(xScale.range()));
          xScale.domain(previousXScale.domain());
        }

        if (yScale != null) {
          previousYScale = updatedTransform.rescaleY(originalYScale.range(yScale.range()));
          yScale.domain(previousYScale.domain());
        }

        previousTransform = updatedTransform;
        node[symbol] = {
          originalXScale: originalXScale,
          previousXScale: previousXScale,
          xScale: xScale,
          originalYScale: originalYScale,
          previousYScale: previousYScale,
          yScale: yScale,
          previousTransform: previousTransform
        };

        if (updatedTransform !== transform) {
          zoomer.transform(d3Selection.select(node), updatedTransform);
        }

        dispatcher.call('zoom');
      });

      var instance = function instance(selection) {
        var xScale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
        var yScale = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

        if (xScale == null && yScale == null) {
          console.warn("Without an xScale and/or yScale specified, this component won't do anything. Perhaps you forgot to specify them e.g. selection.call(zoom, x, y)?");
        }

        selection.each(function (d, i, nodes) {
          var existingContext = nodes[i][symbol];

          if (existingContext != null && existingContext.xScale === xScale && existingContext.yScale === yScale) {
            console.warn("This component should only be called on a selection once. Perhaps you're missing an .enter()?");
          }

          var xScaleCopy = xScale === null || xScale === void 0 ? void 0 : xScale.copy();
          var yScaleCopy = yScale === null || yScale === void 0 ? void 0 : yScale.copy();
          nodes[i][symbol] = {
            originalXScale: xScaleCopy,
            previousXScale: xScaleCopy,
            xScale: xScale,
            originalYScale: yScaleCopy,
            previousYScale: yScaleCopy,
            yScale: yScale,
            previousTransform: d3Zoom.zoomIdentity
          };
        }).call(zoomer);
      };

      d3fcRebind.rebind(instance, dispatcher, 'on');
      d3fcRebind.rebind(instance, zoomer, 'extent', 'filter', 'wheelDelta', 'touchable', 'clickDistance', 'tapDistance', 'duration', 'interpolate');
      return instance;
    });

    exports.zoom = zoom;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
