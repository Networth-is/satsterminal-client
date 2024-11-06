// webpack.config.js
const path = require('path');

module.exports = {
  entry: './main.js', // Path to your main file
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'main.min.js',               // Minified output filename
  },
  mode: 'production', // Enables minification
};
