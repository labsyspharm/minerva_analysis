const webpackConfig = require('./webpack.config');
delete webpackConfig.entry;
delete webpackConfig.output;

// Karma configuration
// Generated on Thu May 12 2022 14:28:02 GMT-0400 (Eastern Daylight Time)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['mocha', 'chai', 'webpack', 'fixture', 'jquery-3.4.0'],
    
    plugins: ['karma-jquery', 'karma-webpack', 'karma-mocha', 'karma-chai', 'karma-fixture', 'karma-html2js-preprocessor', 'karma-chrome-launcher'],

    // list of files / patterns to load in the browser
    files: [
      {
        pattern: 'test/includes/globals.js',
        watch: false,
      },
      {
        pattern: 'fixtures/main.html',
      },
      {
        pattern: 'src/js/*.js',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'external/**/*.js',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'test/js/*.js',
        watch: false,
      }
    ],


    proxies: {
      "/js/": "/base/src/js/",
      "/osd/": "/base/external/openseadragon-bin-2.4.0/"
    },

    // list of files / patterns to exclude
    exclude: [
    ],

    preprocessors: {
      '*.html': ['html2js'],
      '*.js': ['webpack'],
    },

    webpack: webpackConfig,

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: ['Chrome'],

    client: {
      mocha: {
        reporter: 'html',
        timeout: 4000
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity
  })
}
