import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { analyze } from '../src/analyzer.ts';
import { getCompletions } from '../src/completion.ts';
import { getBuiltins } from '../src/builtins.ts';

const PORT = 3000;
const dir = dirname(fileURLToPath(import.meta.url));

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (chunk: Buffer) => { buf += chunk; });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(join(dir, 'index.html'), 'utf-8'));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/complete') {
    try {
      const { text, offset } = JSON.parse(await readBody(req)) as { text: string; offset: number };
      const analysis = analyze(text, 'demo://demo.xq');
      const builtins = getBuiltins();
      const items = getCompletions(
        { textBeforeCursor: text.slice(0, offset), cursorOffset: offset },
        analysis,
        new Map([['builtin:', builtins]]),
        false,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  xq-lsp demo  →  http://localhost:${PORT}\n`);
});
