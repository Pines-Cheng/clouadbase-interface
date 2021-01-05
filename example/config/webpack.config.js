const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const sass = require('dart-sass')

module.exports = {
  mode: 'development',
  entry: './example/client',
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          cacheDirectory: true
        }
      },
      {
        test: /\.s?[ca]ss$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              importLoaders: 1
            }
          },
          {
            loader: 'resolve-url-loader',
            options: {
              sourceMap: true
            }
          },
          {
            loader: 'sass-loader',
            options: {
              implementation: sass,
              sourceMap: true
              // sourceMapContents: false
            }
          }
        ]
      }
    ]
  },
  devServer: {
    port: 3000,
    contentBase: path.join(__dirname, '/dist'),
    compress: true,
    historyApiFallback: true,
    hot: true,
    https: false,
    noInfo: true,
    open: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: `
    <html>
      <body>
        <h1>Client Example</h1>
        <div id="terminal"></div>
        <br>
        <div id="terminal2"></div>
      </body>
    </html>
  `
    })
  ]
}
