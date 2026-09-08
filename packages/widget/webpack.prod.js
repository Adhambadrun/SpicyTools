const webpack = require('webpack');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
	mode: 'production',
	optimization: {
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					compress: {
						reduce_funcs: false
					}
				}
			})
		]
	},
	plugins: [
		new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /ru|en|de|ro|kk|uz|uk|it|nl|az|kg/),
	]
});
