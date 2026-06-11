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
		// prettier/index.mjs uses createRequire(import.meta.url); esbuild renames
		// import.meta to import_meta but doesn't define it when targeting CJS.
		// Supply a shim so the reference resolves to the correct file URL.
		define: { 'import.meta.url': '__importMetaUrl' },
		banner: { js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;' },
	}),
	esbuild.build({
		...common,
		entryPoints: [require.resolve('xq-lsp')],
		outfile: 'dist/server.mjs',
		format: 'esm',
		// CJS packages bundled inside the ESM output use esbuild's __require shim,
		// which needs `require` to be defined. createRequire provides it.
		banner: { js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);' },
	}),
	cp('node_modules/xq-lsp/builtins', 'builtins', { recursive: true }),
]);
