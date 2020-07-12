const webpack = require('webpack')

module.exports = {
    mode: 'development',
    entry: './src/js/vendor.js',
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
    },
    output: {
        filename: 'vendor_bundle.js'
    },
    plugins: [new webpack.IgnorePlugin(/^openseadragon$/)]
};