import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { analyze } from './analyzer.ts';
import type { FileAnalysis } from './types.ts';

const builtinsPath = join(dirname(fileURLToPath(import.meta.url)), 'builtins.xq');
const builtinsUri = 'builtin:xquery-fn';

let _builtins: FileAnalysis | null = null;

export function getBuiltins(): FileAnalysis {
  if (!_builtins) {
    const text = readFileSync(builtinsPath, 'utf-8');
    _builtins = analyze(text, builtinsUri);
  }
  return _builtins;
}
