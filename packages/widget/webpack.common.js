const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const packageJSON = require('./package.json');

const isDevMode = process.env.NODE_ENV === 'development';
const moduleName = 'spicytools';

module.exports = {
	context: __dirname,
	entry: {
		[moduleName]: ['whatwg-fetch', './src/main.tsx'],
		demo: './src/demo.tsx'
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/',
		filename: '[name].min.js',
		library: 'SpicyTools',
		libraryTarget: 'umd'
	},
	performance: {
		hints: false
	},
	resolve: {
		modules: [
			'node_modules',
			path.resolve(__dirname, 'src'),
			path.resolve(__dirname, 'dist')
		],
		extensions: ['.ts', '.js', '.json', '.tsx', '.css', '.scss'],
		alias: {
			// The datepicker and select are consumed through SpicyTools-owned
			// specifiers so the underlying library can be swapped in one place.
			// They point at the upstream originals — the Nemo-branded forks of
			// these libraries were dropped along with every other Nemo dependency.
			'@spicytools/react-datepicker': 'react-datepicker',
			'@spicytools/react-select': 'react-select'
		}
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: 'ts-loader',
				include: [
					path.resolve(__dirname, 'src')
				],
				exclude: [
					path.resolve(__dirname, 'node_modules')
				]
			},
			{
				test: /\.scss$/,
				include: [
					path.resolve(__dirname, 'src/css')
				],
				use: [
					MiniCssExtractPlugin.loader,
					{
						loader: 'css-loader',
						options: {
							url: true,
							importLoaders: 2
						}
					},
					{
						loader: 'postcss-loader'
					},
					{
						loader: 'sass-loader',
						options: {
							implementation: require('sass'),
							sassOptions: {
								quietDeps: true,
								charset: false
							}
						}
					}
				]
			},
			{
				test: /\.woff$/,
				type: 'asset',
				parser: {
					dataUrlCondition: {
						maxSize: 50000
					}
				},
				generator: {
					dataUrl: {
						mimetype: 'application/font-woff'
					}
				},
				include: [
					path.resolve(__dirname, 'src/css/fonts')
				]
			},
			{
				test: /\.svg$/,
				type: 'asset/resource',
				generator: {
					filename: '[name][ext]'
				},
				include: [
					path.resolve(__dirname, 'src/css/images')
				]
			}
		]
	},
	plugins: [
		new MiniCssExtractPlugin({
			filename: `${moduleName}.min.css`
		}),
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: JSON.stringify(isDevMode ? 'development' : 'production'),
				VERSION: JSON.stringify(packageJSON.version)
			}
		})
	]
};
