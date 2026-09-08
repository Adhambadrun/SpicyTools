const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
	mode: 'development',
	devtool: 'eval-cheap-module-source-map',
	devServer: {
		static: {
			directory: __dirname + '/dist'
		},
		host: '0.0.0.0',
		port: Number(process.env.PORT || 9000),
		allowedHosts: 'all',
		client: {
			overlay: false
		}
	}
});
