'use strict';

// Modules
const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const { merge } = require('webpack-merge');

/**
 * Env
 * Get npm lifecycle event to identify the environment
 */
const ENV = process.env.npm_lifecycle_event;
const isProd = ENV === 'build';
const mode = isProd ? 'production' : 'development';

const extractSass = new ExtractTextPlugin({
  filename: "[name].[contenthash].css",
  disable: !isProd
});

module.exports = function makeWebpackConfig() {

  const envCfg = {
    production: {
      // devtool: 'source-map',
      optimization: {
        minimizer: [
          new TerserPlugin({
            cache: true,
            parallel: true,
            sourceMap: false // set to true if you want JS source maps
          }),
          new OptimizeCSSAssetsPlugin({
            cssProcessorPluginOptions: {
              cssProcessor: require('cssnano'),
              cssProcessorPluginOptions: {
                preset: ['default', { discardComments: { removeAll: true } }],
              },
            },
          })
        ]
      },
      plugins: [
        new CopyWebpackPlugin({
          patterns: [
            { from: __dirname + '/src/public' }
          ]
        })
      ]
    },
    development: {
      devServer: {
        historyApiFallback: true,
        contentBase: './src/public',
        stats: 'minimal',
        hot: true,
        host: '0.0.0.0',
        port: 8080,
        disableHostCheck: true,
      },
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackHarddiskPlugin(),
      ]
    }
  };

  const config = {
    mode,
    devtool: isProd ? 'source-map' : 'eval-source-map',
    entry: {
      app: './src/app/app.js'
    },
    output: {
      // Absolute output directory
      path: __dirname + '/dist',

      // Output path from the view of the page
      // Uses webpack-dev-server in development
      publicPath: isProd ? '/' : 'http://localhost:8080/',

      // Filename for entry points
      // Only adds hash in build mode
      filename: isProd ? '[name].[hash].js' : '[name].bundle.js',

      // Filename for non-entry points
      // Only adds hash in build mode
      chunkFilename: isProd ? '[name].[hash].js' : '[name].bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: /node_modules/
        },
        {
          test: /\.(scss|css)$/,
          use: [
            'css-hot-loader',
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                importLoaders: 1,
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                plugins: () => [require('autoprefixer')({})],
              }
            },
            {
              loader: 'sass-loader',
            },
          ]
        }, {
          // ASSET LOADER
          // Reference: https://github.com/webpack/file-loader
          // Copy png, jpg, jpeg, gif, svg, woff, woff2, ttf, eot files to output
          // Rename the file using the asset hash
          // Pass along the updated reference to your code
          // You can add here any file extension you want to get copied to your output
          test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
          loader: 'file-loader',
          exclude: /index\.html$/
        }, {
          // HTML LOADER
          // Reference: https://github.com/webpack/raw-loader
          // Allow loading html through js
          test: /\.html$/,
          loader: 'raw-loader'
        }
      ]

    },
    plugins: [
      // extractSass,
      new webpack.ProvidePlugin({
        jQuery: 'jquery',
        $: 'jquery',
        jquery: 'jquery',
        'window.jQuery': 'jquery',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: __dirname + '/example.xlsx', to: __dirname + '/dist/example.xlsx'},
        ]
      }),
      new HtmlWebpackPlugin({
        alwaysWriteToDisk: true,
        template: `./src/public/index.html`,
        inject: 'body',
        filename: `index.html`
      }),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "[name].[hash].css",
        chunkFilename: "[id].css"
      }),
    ]
  };

  return merge(config, envCfg[mode]);
}();
