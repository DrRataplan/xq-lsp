import * as esbuild from 'esbuild';
import { cp } from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const common = {
	bundle: true,
	format: 'cjs',
	platform: 'node',
	target: 'node18',
	sourcemap: true,
	tsconfigRaw: '{}',
};

await Promise.all([
	esbuild.build({
		...common,
		entryPoints: ['extension.js'],
		outfile: 'dist/extension.js',
		external: ['vscode'],
	}),
	esbuild.build({
		...common,
		entryPoints: [require.resolve('xq-lsp')],
		outfile: 'dist/server.js',
	}),
	cp('node_modules/xq-lsp/builtins', 'builtins', { recursive: true }),
]);
