import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));

before(() => {
	execFileSync('node', ['build.mjs'], { cwd: dir });
});

test('build produces expected artifacts', () => {
	assert.ok(existsSync(path.join(dir, 'dist', 'extension.js')), 'dist/extension.js missing');
	assert.ok(existsSync(path.join(dir, 'dist', 'server.mjs')), 'dist/server.mjs missing');
	for (const f of ['builtins-fn.xq', 'builtins-math.xq', 'builtins-array.xq', 'builtins-map.xq']) {
		assert.ok(existsSync(path.join(dir, 'builtins', f)), `builtins/${f} missing`);
	}
});

// ── Minimal LSP client over stdio ────────────────────────────────────────────

function lspClient(proc) {
	let buf = Buffer.alloc(0);
	const pending = new Map();

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
	};
}

// ── Server smoke test ─────────────────────────────────────────────────────────

test('bundled server starts and responds to LSP', async () => {
	const proc = spawn('node', [path.join(dir, 'dist', 'server.mjs'), '--stdio']);
	const stderr = [];
	proc.stderr.on('data', (d) => stderr.push(d.toString()));

	try {
		const client = lspClient(proc);

		// Handshake
		const initResp = await client.request('initialize', {
			processId: process.pid,
			capabilities: { textDocument: { hover: { contentFormat: ['markdown'] } } },
			rootUri: null,
		});
		assert.ok(!initResp.error, `initialize failed: ${JSON.stringify(initResp.error)}`);
		assert.ok(initResp.result?.capabilities, 'no capabilities in initialize response');
		client.notify('initialized', {});

		// Open a document that calls a built-in function
		client.notify('textDocument/didOpen', {
			textDocument: {
				uri: 'file:///smoke.xq',
				languageId: 'xquery',
				version: 1,
				text: 'fn:string("hello")',
			},
		});

		// Hover over fn:string — exercises the bundled builtins-fn.xq data
		const hoverResp = await client.request('textDocument/hover', {
			textDocument: { uri: 'file:///smoke.xq' },
			position: { line: 0, character: 5 }, // inside "string" of fn:string
		});
		assert.ok(!hoverResp.error, `hover failed: ${JSON.stringify(hoverResp.error)}`);

		const contents = hoverResp.result?.contents;
		assert.ok(contents, 'hover returned no contents — builtins may not have loaded');

		const text = typeof contents === 'string' ? contents : (contents.value ?? '');
		// fn:string is declared in builtins-fn.xq; its signature contains this
		assert.match(text, /fn:string/, 'hover should contain the fn:string signature from builtins');
	} finally {
		proc.kill();
		if (stderr.length) process.stderr.write(stderr.join(''));
	}
});
