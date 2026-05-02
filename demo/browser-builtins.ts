// Browser replacement for src/builtins.ts.
// esbuild loads the .xq files as raw text strings via --loader:.xq=text,
// avoiding any Node.js fs/path usage.
import { analyze, XMLNS_FN } from '../src/analyzer.ts';
import type { FileAnalysis } from '../src/types.ts';

// @ts-ignore – loaded as text by esbuild
import fnText    from '../src/builtins-fn.xq';
// @ts-ignore
import mathText  from '../src/builtins-math.xq';
// @ts-ignore
import mapText   from '../src/builtins-map.xq';
// @ts-ignore
import arrayText from '../src/builtins-array.xq';

let _builtins: FileAnalysis | null = null;

export function getBuiltins(): FileAnalysis {
  if (!_builtins) {
    const parts = [
      analyze(fnText    as string, 'builtin:builtins-fn.xq'),
      analyze(mathText  as string, 'builtin:builtins-math.xq'),
      analyze(mapText   as string, 'builtin:builtins-map.xq'),
      analyze(arrayText as string, 'builtin:builtins-array.xq'),
    ];
    _builtins = {
      functions: parts.flatMap(a => a.functions),
      moduleVariables: [],
      localBindings: [],
      imports: [],
      defaultFunctionNamespace: XMLNS_FN,
    };
  }
  return _builtins;
}
