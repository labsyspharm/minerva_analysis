const webpack = require('webpack')

module.exports = {
    mode: 'development',
    entry: {
        vendor: './src/js/vendor.js'
    },
    output: {
        filename: '[name]_bundle.js'
    },
    node: {
        fs: 'empty'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.(png|svg|jpg|gif|dzi)$/,
                use: [
                    'file-loader',
                ],
            },
            {
                test: /\.ts$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                      "presets": [
                          "@babel/typescript"
                      ],
                      "plugins": [
                          "dynamic-import-node"
                      ],
                    }
                }
            },
            {
                test: /\.m?js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: [
                          ["@babel/plugin-transform-runtime", { "corejs": 2 }],
                          '@babel/plugin-proposal-class-properties'
                        ],
                        presets: ['@babel/preset-env']
                    }
                }
            },
        ],
    }
};
