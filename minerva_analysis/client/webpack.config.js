const webpack = require('webpack')

module.exports = {
    mode: 'development',
    entry: {
        vendor: './src/js/vendor.js'
    },
    output: {
        filename: '[name]_bundle.js'
    },
    resolve: {
        alias: {
            'process/browser': require.resolve('process/browser.js')
        },
        fallback: {
            assert: require.resolve('assert/'),
            fs: false,
            process: require.resolve('process/browser.js'),
            querystring: require.resolve('querystring-es3'),
            stream: require.resolve('stream-browserify'),
            url: require.resolve('url/'),
            util: require.resolve('util/'),
            zlib: require.resolve('browserify-zlib')
        }
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
                type: 'asset/resource'
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
                          "@babel/plugin-transform-runtime",
                          '@babel/plugin-transform-class-properties'
                        ],
                        presets: ['@babel/preset-env']
                    }
                }
            },
        ],
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: ['process/browser.js']
        })
    ]
};
