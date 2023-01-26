const webpackConfig = require('./webpack.config');
delete webpackConfig.entry;
delete webpackConfig.output;

// Moccked test server of Mockttp
const SERVER = "http://localhost:8765";

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['mocha', 'chai', 'sinon-chai', 'webpack', 'fixture', 'jquery-3.4.0'],
    
    chai: {
      includeStack: true
    },

    // list of files / patterns to load in the browser
    files: [
      {
        pattern: 'src/css/**/*.css',
      },
      {
        pattern: 'test/fixtures/**',
      },
      {
        pattern: 'src/shaders/**/*.glsl',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'src/js/**/*.js',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'external/**/*',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'dist/**/*.js',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'test/data/*',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'test/globals/*.js',
        included: false,
        served: true,
        watch: false
      },
      {
        pattern: 'test/**/*.ts',
        watch: false,
        type: 'js'
      }
    ],

    customContextFile: 'test/fixtures/context.html',

    proxies: {
      "/dist/": "/base/dist/",
      "/js/": "/base/src/js/",
      "/client/src/": "/base/src/",
      "/data/": "/base/test/data/",
      "/globals/": "/base/test/globals/",
      "/fixtures/": "/base/test/fixtures/",
      "/client/external/": "/base/external/",
      "/config": `${SERVER}/config`,
      "/init_database": `${SERVER}/init_database`,
      "/get_all_cells/": `${SERVER}/get_all_cells/`,
      "/generated/data/": `${SERVER}/generated/data/`,
      "/get_gating_gmm": `${SERVER}/get_gating_gmm`,
      "/get_channel_gmm": `${SERVER}/get_channel_gmm`,
      "/get_ome_metadata": `${SERVER}/get_ome_metadata`,
      "/get_channel_names": `${SERVER}/get_channel_names`,
      "/download_gating_csv": `${SERVER}/download_gating_csv`,
      "/download_channels_csv": `${SERVER}/download_channels_csv`,
      "/get_database_description": `${SERVER}/get_database_description`,
    },

    // list of files / patterns to exclude
    exclude: [
    ],

    preprocessors: {
      'test/fixtures/*.html': ['html2js'],
      'test/**/*.ts': ['webpack'],
      'src/*.js': ['webpack']
    },

    html2JsPreprocessor: {
      stripPrefix: 'test/fixtures/',
      prependPrefix: 'html/',
    },

    webpack: webpackConfig,

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-$eporter
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
        timeout: 60000
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
