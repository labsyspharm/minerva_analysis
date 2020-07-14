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
                test: require.resolve('jquery'),
                loader: 'expose-loader',
                options: {
                    exposes: ['$', 'jQuery'],
                },
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            }
        ],
    }
};