#!/usr/bin/env node
/**
 * Dumps the raw xq-parser AST for an XQuery snippet — the same tree shown in
 * the demo's AST panel (demo/main.ts), without needing to run the demo.
 * Useful when working out what shape a construct parses to before writing
 * analyzer/diagnostic logic against it.
 *
 * Usage:
 *   node scripts/dump-ast.ts path/to/query.xq
 *   node scripts/dump-ast.ts -e 'for $x in (1, 2, 3) return $x * 2'
 *   echo 'for $x in (1, 2, 3) return $x * 2' | node scripts/dump-ast.ts
 */
import * as fs from "fs";
import { XQuery31Full } from "xq-parser";

function readInput(): string {
	const [first, ...rest] = process.argv.slice(2);
	if (first === "-e") return rest.join(" ");
	if (first) return fs.readFileSync(first, "utf8");
	return fs.readFileSync(0, "utf8");
}

try {
	const { ast, comments } = XQuery31Full(readInput());
	console.log(JSON.stringify({ ast, comments }, null, 2));
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
