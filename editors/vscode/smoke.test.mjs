import { describe, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Skip the whole suite when the extension's node_modules aren't installed
// (e.g. in the root CI job that only runs npm ci at the repo root).
// Run manually: cd editors/vscode && npm install && node --test smoke.test.mjs
const skip = !existsSync(path.join(dir, 'node_modules', 'esbuild'))
	? 'run npm install in editors/vscode first'
	: false;

// ── Minimal LSP client over stdio ──────────────────────────────────────────

function lspClient(proc) {
	let buf = Buffer.alloc(0);
	const pending = new Map();
	const notifHandlers = new Map();

	proc.stdout.on('data', (chunk) => {
		buf = Buffer.concat([buf, chunk]);
		while (true) {
			const headerEnd = buf.indexOf('\r\n\r\n');
			if (headerEnd === -1) break;
			const lenMatch = buf.slice(0, headerEnd).toString().match(/Content-Length: (\d+)/);
			if (!lenMatch) break;
			const len = parseInt(lenMatch[1]);
			if (buf.length < headerEnd + 4 + len) break;
			const msg = JSON.parse(buf.slice(headerEnd + 4, headerEnd + 4 + len).toString());
			buf = buf.slice(headerEnd + 4 + len);
			if (msg.id != null && pending.has(msg.id)) {
				pending.get(msg.id)(msg);
				pending.delete(msg.id);
			} else if (msg.id == null && msg.method && notifHandlers.has(msg.method)) {
				notifHandlers.get(msg.method)(msg.params);
			}
		}
	});

	let nextId = 1;
	const send = (msg) => {
		const body = JSON.stringify(msg);
		proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
	};

	const TIMEOUT = 8000;
	return {
		request(method, params) {
			return new Promise((resolve, reject) => {
				const id = nextId++;
				const timer = setTimeout(
					() => reject(new Error(`${method} timed out after ${TIMEOUT}ms`)),
					TIMEOUT,
				);
				pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
				send({ jsonrpc: '2.0', id, method, params });
			});
		},
		notify(method, params) { send({ jsonrpc: '2.0', method, params }); },
		onNotification(method, handler) { notifHandlers.set(method, handler); },
	};
}

async function startServer() {
	const proc = spawn('node', [path.join(dir, 'dist', 'server.mjs'), '--stdio']);
	const stderr = [];
	proc.stderr.on('data', (d) => stderr.push(d.toString()));
	const client = lspClient(proc);
	const initResp = await client.request('initialize', {
		processId: process.pid,
		capabilities: { textDocument: { hover: { contentFormat: ['markdown'] } } },
		rootUri: null,
	});
	assert.ok(!initResp.error, `initialize failed: ${JSON.stringify(initResp.error)}`);
	assert.ok(initResp.result?.capabilities, 'no capabilities in initialize response');
	client.notify('initialized', {});
	return { client, proc, stderr };
}

function hoverText(result) {
	const contents = result?.contents;
	if (!contents) return '';
	return typeof contents === 'string' ? contents : (contents.value ?? '');
}

describe('vscode extension bundle', { skip }, () => {
	before(() => {
		execFileSync('node', ['build.mjs'], { cwd: dir });
	});

	it('build produces expected artifacts', () => {
		assert.ok(existsSync(path.join(dir, 'dist', 'extension.js')), 'dist/extension.js missing');
		assert.ok(existsSync(path.join(dir, 'dist', 'server.mjs')), 'dist/server.mjs missing');
		for (const f of ['builtins-fn.xq', 'builtins-math.xq', 'builtins-array.xq', 'builtins-map.xq', 'builtins-xs.xq']) {
			assert.ok(existsSync(path.join(dir, 'builtins', f)), `builtins/${f} missing`);
		}
	});

	// ── Hover tests — one per builtins file ─────────────────────────────────────

	it('hover loads fn builtins (fn:string)', async () => {
		// fn:string("hello") — char 5 is inside "string"
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-fn.xq', languageId: 'xquery', version: 1, text: 'fn:string("hello")' },
			});
			const resp = await client.request('textDocument/hover', {
				textDocument: { uri: 'file:///smoke-fn.xq' },
				position: { line: 0, character: 5 },
			});
			assert.ok(!resp.error, `hover failed: ${JSON.stringify(resp.error)}`);
			assert.ok(resp.result?.contents, 'hover returned no contents — builtins-fn.xq may not have loaded');
			assert.match(hoverText(resp.result), /fn:string/, 'hover should contain fn:string signature');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	it('hover loads math builtins (math:pi)', async () => {
		// math:pi() — char 5 is "p", the start of "pi"
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-math.xq', languageId: 'xquery', version: 1, text: 'math:pi()' },
			});
			const resp = await client.request('textDocument/hover', {
				textDocument: { uri: 'file:///smoke-math.xq' },
				position: { line: 0, character: 5 },
			});
			assert.ok(!resp.error, `hover failed: ${JSON.stringify(resp.error)}`);
			assert.ok(resp.result?.contents, 'hover returned no contents — builtins-math.xq may not have loaded');
			assert.match(hoverText(resp.result), /math:pi/, 'hover should contain math:pi signature');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	it('hover loads array builtins (array:size)', async () => {
		// array:size([]) — char 6 is "s", the start of "size"
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-array.xq', languageId: 'xquery', version: 1, text: 'array:size([])' },
			});
			const resp = await client.request('textDocument/hover', {
				textDocument: { uri: 'file:///smoke-array.xq' },
				position: { line: 0, character: 6 },
			});
			assert.ok(!resp.error, `hover failed: ${JSON.stringify(resp.error)}`);
			assert.ok(resp.result?.contents, 'hover returned no contents — builtins-array.xq may not have loaded');
			assert.match(hoverText(resp.result), /array:size/, 'hover should contain array:size signature');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	it('hover loads map builtins (map:size)', async () => {
		// map:size(map{}) — char 4 is "s", the start of "size"
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-map.xq', languageId: 'xquery', version: 1, text: 'map:size(map{})' },
			});
			const resp = await client.request('textDocument/hover', {
				textDocument: { uri: 'file:///smoke-map.xq' },
				position: { line: 0, character: 4 },
			});
			assert.ok(!resp.error, `hover failed: ${JSON.stringify(resp.error)}`);
			assert.ok(resp.result?.contents, 'hover returned no contents — builtins-map.xq may not have loaded');
			assert.match(hoverText(resp.result), /map:size/, 'hover should contain map:size signature');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	it('hover loads xs builtins (xs:string)', async () => {
		// xs:string("x") — char 3 is "s", the start of "string"
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-xs.xq', languageId: 'xquery', version: 1, text: 'xs:string("x")' },
			});
			const resp = await client.request('textDocument/hover', {
				textDocument: { uri: 'file:///smoke-xs.xq' },
				position: { line: 0, character: 3 },
			});
			assert.ok(!resp.error, `hover failed: ${JSON.stringify(resp.error)}`);
			assert.ok(resp.result?.contents, 'hover returned no contents — builtins-xs.xq may not have loaded');
			assert.match(hoverText(resp.result), /xs:string/, 'hover should contain xs:string signature');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	// ── Completion ───────────────────────────────────────────────────────────────

	it('completion returns built-in function suggestions for fn: prefix', async () => {
		const { client, proc, stderr } = await startServer();
		try {
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-complete.xq', languageId: 'xquery', version: 1, text: 'fn:' },
			});
			const resp = await client.request('textDocument/completion', {
				textDocument: { uri: 'file:///smoke-complete.xq' },
				position: { line: 0, character: 3 },
			});
			assert.ok(!resp.error, `completion failed: ${JSON.stringify(resp.error)}`);
			const items = Array.isArray(resp.result) ? resp.result : (resp.result?.items ?? []);
			assert.ok(items.length > 0, 'completion returned no items for fn: prefix');
			assert.ok(
				items.some((i) => (i.label ?? '').includes('string')),
				'fn:string not found in completion items',
			);
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});

	// ── Diagnostics notification ─────────────────────────────────────────────────

	it('server sends publishDiagnostics after document open', async () => {
		const { client, proc, stderr } = await startServer();
		try {
			const diagPromise = new Promise((resolve) => {
				client.onNotification('textDocument/publishDiagnostics', resolve);
			});
			client.notify('textDocument/didOpen', {
				textDocument: { uri: 'file:///smoke-diag.xq', languageId: 'xquery', version: 1, text: 'fn:string("hello")' },
			});
			const params = await Promise.race([
				diagPromise,
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('publishDiagnostics timed out after 8000ms')), 8000),
				),
			]);
			assert.ok(params, 'publishDiagnostics notification not received');
			assert.equal(params.uri, 'file:///smoke-diag.xq', 'diagnostics uri should match opened document');
			assert.ok(Array.isArray(params.diagnostics), 'diagnostics should be an array');
		} finally {
			proc.kill();
			if (stderr.length) process.stderr.write(stderr.join(''));
		}
	});
});
