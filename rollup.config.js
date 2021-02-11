import metablock from 'rollup-plugin-userscript-metablock';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
	input: 'src/index.js',
	output: {
		file: 'dist/bundle.user.js',
		format: 'iife',
	},
	plugins: [
		nodeResolve(),
		commonjs({
			include: ['node_modules/**'],
			exclude: ['node_modules/process-es6/**'],
		}),
		metablock({
			file: './meta.json',
		}),
	],
};
