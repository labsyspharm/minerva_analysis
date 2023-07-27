const webpack = require('webpack')

module.exports = {
    mode: 'development',
    entry: {
        vendor: './src/js/vendor.js'
    },
    output: {
        filename: '[name]_bundle.js'
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
                test: /\.m?js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-transform-logical-assignment-operators'],
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ],
    }
};