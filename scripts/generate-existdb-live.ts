#!/usr/bin/env node
/**
 * Generates src/runtimes/existdb/*.xq from a *running* eXist-db instance.
 *
 * Asks the server itself via inspect:inspect-module-uri / inspect:inspect-module
 * — the same data eXist's own function documentation is built from — so it sees
 * every signature the engine actually registers, including XQuery-implemented
 * modules such as kwic.xql.
 *
 * The set of modules to refresh is taken from the existing .xq files in
 * src/runtimes/existdb. A module the instance doesn't serve is left alone
 * (hand-written files such as exist.xq, and modules missing from a trimmed
 * build) and reported at the end, together with any module the instance serves
 * that we have no file for yet.
 *
 * Usage:
 *   EXISTDB_SERVER=http://localhost:8080 node scripts/generate-existdb-live.ts [--out DIR] [--write] [--add NAMESPACE_URI]...
 *
 *   --out DIR   write generated files to DIR (default: a temp dir) and print a
 *               function-level diff against the committed files
 *   --write     overwrite src/runtimes/existdb in place (implies diff output)
 *   --add URI   also create a file for a module we don't have yet (repeatable); the
 *               prefix and file name come from the instance. A new file must still be
 *               registered in RUNTIME_FILES (src/runtimes.ts), and its prefix added to
 *               src/predeclared-namespaces.ts if eXist predeclares it.
 *
 * Requires the `xst` CLI on PATH; connection settings follow xst's rules
 * (EXISTDB_SERVER / EXISTDB_USER / EXISTDB_PASS, .env, ...).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/analyzer.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_DIR = path.join(ROOT, "src", "runtimes", "existdb");

/** XQuery-implemented modules that inspect-module-uri can't see: namespace → resource location. */
const XQUERY_MODULE_LOCATIONS: Record<string, string> = {
	"http://exist-db.org/xquery/kwic": "resource:org/exist/xquery/lib/kwic.xql",
};

interface LiveArg {
	name: string;
	type: string;
	cardinality: string;
	text: string;
}
interface LiveFunction {
	name: string;
	description: string;
	deprecated: string;
	args: LiveArg[];
	returns: { type: string; cardinality: string; text: string };
}
interface LiveModule {
	uri: string;
	found: boolean;
	prefix: string;
	functions: LiveFunction[];
}

const CARDINALITY: Record<string, string> = {
	"exactly one": "",
	"zero or one": "?",
	"zero or more": "*",
	"one or more": "+",
};

function xqType(type: string, cardinality: string): string {
	if (cardinality === "empty" || type === "empty-sequence()") return "empty-sequence()";
	return type + (CARDINALITY[cardinality] ?? "*");
}

// ── Query the instance ───────────────────────────────────────────────────────

function buildQuery(uris: string[]): string {
	const list = uris.map((u) => `"${u}"`).join(", ");
	const locations = Object.entries(XQUERY_MODULE_LOCATIONS)
		.map(([ns, loc]) => `"${ns}": "${loc}"`)
		.join(", ");
	return `
let $locations := map { ${locations} }
let $result := array {
  for $uri in (${list})
  let $byUri := try { inspect:inspect-module-uri(xs:anyURI($uri)) } catch * { () }
  let $module :=
    if (exists($byUri/function)) then $byUri
    else if (map:contains($locations, $uri)) then
      try { inspect:inspect-module(xs:anyURI($locations($uri))) } catch * { () }
    else ()
  return map {
    "uri": $uri,
    "found": exists($module/function),
    "prefix": string(($module/@prefix, "")[1]),
    "functions": array {
      for $f in $module/function
      return map {
        "name": string($f/@name),
        "description": string($f/description),
        "deprecated": string($f/deprecated),
        "args": array {
          for $a in $f/argument
          return map {
            "name": string($a/@var), "type": string($a/@type),
            "cardinality": string($a/@cardinality), "text": string($a)
          }
        },
        "returns": map {
          "type": string($f/returns/@type), "cardinality": string($f/returns/@cardinality),
          "text": string($f/returns)
        }
      }
    }
  }
}
return serialize($result, map { "method": "json" })`;
}

function fetchModules(uris: string[]): LiveModule[] {
	const out = execFileSync("xst", ["run", buildQuery(uris)], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
	return JSON.parse(out) as LiveModule[];
}

/** Module namespaces the instance registers that we have no runtime file for (minus the language-level fn/map/array/math). */
function listUnlistedModules(have: Set<string>): string[] {
	const out = execFileSync("xst", ["run", 'string-join(util:registered-modules(), "|")'], { encoding: "utf-8" });
	const core = /^http:\/\/www\.w3\.org\/2005\/xpath-functions(\/(math|map|array))?$/;
	return out
		.trim()
		.split("|")
		.filter((u) => u && !have.has(u) && !core.test(u))
		.sort();
}

// ── Render ───────────────────────────────────────────────────────────────────

function wrapText(text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (current && current.length + 1 + word.length > maxWidth) {
			lines.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) lines.push(current);
	return lines;
}

/** Doc text is embedded in an XQuery comment: neutralise anything that would end it. */
function docText(text: string): string {
	return text.replace(/\s+/g, " ").trim().replace(/:\)/g, ": )").replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function renderFunction(f: LiveFunction): string {
	const lines: string[] = [];
	const doc: string[] = [];
	if (f.description) for (const l of wrapText(docText(f.description), 76)) doc.push(` : ${l}`);
	if (f.deprecated) doc.push(` : @deprecated ${docText(f.deprecated)}`);
	for (const a of f.args) {
		if (a.text) doc.push(` : @param $${a.name} ${docText(a.text.replace(/\s+/g, " ").trim())}`);
	}
	if (f.returns.text) doc.push(` : @return ${docText(f.returns.text.replace(/\s+/g, " ").trim())}`);
	if (doc.length) lines.push("(:~", ...doc, " :)");

	const ret = xqType(f.returns.type || "item()", f.returns.cardinality || "zero or more");
	const params = f.args.map((a) => `$${a.name} as ${xqType(a.type || "item()", a.cardinality)}`);
	if (params.length <= 3) {
		lines.push(`declare function ${f.name}(${params.join(", ")}) as ${ret} external;`);
	} else {
		lines.push(`declare function ${f.name}(`);
		params.forEach((p, i) => lines.push(`\t${p}${i < params.length - 1 ? "," : ""}`));
		lines.push(`) as ${ret} external;`);
	}
	return lines.join("\n");
}

interface Entry {
	name: string;
	arity: number;
	text: string;
}

/**
 * Declarations (with their doc comments) in a committed file, as raw text.
 * Arity = number of `$name as` parameters; every declaration here ends in `external;`.
 */
function committedEntries(source: string): Entry[] {
	const re = /(?:\(:~(?:(?!:\))[\s\S])*:\)\s*)?declare function ([\w.-]+:[\w.-]+)\s*\(((?:(?!external;)[\s\S])*)external;/g;
	const entries: Entry[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(source)) !== null) {
		entries.push({ name: m[1], arity: (m[2].match(/\$[\w.-]+\s+as\s/g) ?? []).length, text: m[0].trim() });
	}
	return entries;
}

/**
 * Merge the live instance into the committed declarations. The live instance
 * wins for every name#arity it serves. Committed declarations it doesn't serve
 * are kept — the instance may simply be older (or a trimmed build) compared to
 * the eXist-db versions we want to support — except 0-arity placeholders that the
 * old Java-source generator emitted when it couldn't resolve a parameter list:
 * those are dropped when the live instance serves the same name with other arities.
 */
function mergeModule(
	prefix: string,
	namespace: string,
	live: LiveFunction[],
	committed: Entry[],
): { text: string; kept: Entry[]; droppedPlaceholders: Entry[] } {
	const seen = new Set<string>();
	const liveEntries: Entry[] = [];
	for (const f of live) {
		const key = `${f.name}#${f.args.length}`;
		if (seen.has(key)) continue;
		seen.add(key);
		liveEntries.push({ name: f.name, arity: f.args.length, text: renderFunction(f) });
	}
	const liveNames = new Set(liveEntries.map((e) => e.name));
	const kept: Entry[] = [];
	const droppedPlaceholders: Entry[] = [];
	for (const e of committed) {
		if (seen.has(`${e.name}#${e.arity}`)) continue;
		if (e.arity === 0 && liveNames.has(e.name)) droppedPlaceholders.push(e);
		else kept.push(e);
	}
	const all = [...liveEntries, ...kept].sort((a, b) => a.name.localeCompare(b.name) || a.arity - b.arity);
	return {
		text: [`module namespace ${prefix} = "${namespace}";`, "", ...all.flatMap((e) => [e.text, ""])].join("\n"),
		kept,
		droppedPlaceholders,
	};
}

// ── Diff against committed files ─────────────────────────────────────────────

function committedSignatures(file: string): Map<string, string> {
	const analysis = analyze(fs.readFileSync(file, "utf-8"), file);
	const sigs = new Map<string, string>();
	for (const fn of analysis.functions) {
		const params = fn.params.map((p) => `$${p.name} as ${p.type ?? "item()*"}`).join(", ");
		sigs.set(`${fn.qname.prefix}:${fn.qname.localName}#${fn.arity}`, `(${params}) as ${fn.returnType ?? "item()*"}`);
	}
	return sigs;
}

function generatedSignatures(f: LiveFunction[]): Map<string, string> {
	const sigs = new Map<string, string>();
	for (const fn of f) {
		const params = fn.args.map((a) => `$${a.name} as ${xqType(a.type || "item()", a.cardinality)}`).join(", ");
		const ret = xqType(fn.returns.type || "item()", fn.returns.cardinality || "zero or more");
		sigs.set(`${fn.name}#${fn.args.length}`, `(${params}) as ${ret}`);
	}
	return sigs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
	const args = process.argv.slice(2);
	const write = args.includes("--write");
	const outIdx = args.indexOf("--out");
	const outDir = write ? RUNTIME_DIR : outIdx >= 0 ? args[outIdx + 1] : fs.mkdtempSync(path.join(os.tmpdir(), "existdb-live-"));
	fs.mkdirSync(outDir, { recursive: true });

	// namespace → existing file
	const existing = new Map<string, { file: string; prefix: string }>();
	for (const name of fs.readdirSync(RUNTIME_DIR).filter((n) => n.endsWith(".xq"))) {
		const m = /module\s+namespace\s+([\w.-]+)\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(RUNTIME_DIR, name), "utf-8"));
		if (m) existing.set(m[2], { file: name, prefix: m[1] });
	}

	const addUris: string[] = [];
	args.forEach((a, i) => {
		if (a === "--add" && args[i + 1]) addUris.push(args[i + 1]);
	});
	for (const uri of addUris) {
		if (existing.has(uri)) console.log(`--add ${uri}: already have ${existing.get(uri)!.file}, refreshing it`);
	}

	console.log(`Querying ${process.env.EXISTDB_SERVER ?? "default xst server"} for ${existing.size + addUris.length} modules...`);
	const modules = fetchModules([...new Set([...existing.keys(), ...addUris])]);

	const missing: string[] = [];
	const newFiles: string[] = [];
	let totalAdded = 0;
	let totalDropped = 0;
	let totalKept = 0;
	let totalChanged = 0;
	for (const mod of modules) {
		let known = existing.get(mod.uri);
		if (!known) {
			// --add: a module we have no file for. Take prefix and file name from the instance.
			if (!mod.found || !mod.prefix) {
				console.log(`\n--add ${mod.uri}: not served by this instance (or no prefix), skipped`);
				continue;
			}
			known = { file: `${mod.prefix}.xq`, prefix: mod.prefix };
			if (fs.existsSync(path.join(RUNTIME_DIR, known.file))) {
				console.log(`\n--add ${mod.uri}: ${known.file} already exists for another namespace, skipped`);
				continue;
			}
			newFiles.push(known.file);
		}
		const { file, prefix } = known;
		if (!mod.found) {
			missing.push(`${file} (${mod.uri})`);
			continue;
		}
		// Keep our prefix: it's what the rest of the repo (predeclared namespaces, docs) refers to.
		const fns = mod.functions.map((f) => ({ ...f, name: `${prefix}:${f.name.split(":").pop()}` }));
		const committedPath = path.join(RUNTIME_DIR, file);
		const isNew = !fs.existsSync(committedPath);
		const merged = mergeModule(prefix, mod.uri, fns, isNew ? [] : committedEntries(fs.readFileSync(committedPath, "utf-8")));

		const ours = isNew ? new Map<string, string>() : committedSignatures(committedPath);
		const live = generatedSignatures(fns);
		// Write only after reading the committed signatures: with --write they are the same file.
		fs.writeFileSync(path.join(outDir, file), merged.text, "utf-8");
		const added = [...live.keys()].filter((k) => !ours.has(k));
		const changed = [...live.keys()].filter((k) => ours.has(k) && ours.get(k) !== live.get(k));
		const dropped = merged.droppedPlaceholders.map((e) => `${e.name}#${e.arity}`);
		const kept = merged.kept.map((e) => `${e.name}#${e.arity}`);
		totalAdded += added.length;
		totalDropped += dropped.length;
		totalChanged += changed.length;
		totalKept += kept.length;
		if (added.length || dropped.length || changed.length || kept.length) {
			console.log(`\n${file}: +${added.length} -${dropped.length} ~${changed.length} (kept ${kept.length} not served)`);
			for (const k of added) console.log(`  + ${k}  ${live.get(k)}`);
			for (const k of dropped) console.log(`  - ${k}  ${ours.get(k)}  [placeholder]`);
			for (const k of changed) console.log(`  ~ ${k}\n      was ${ours.get(k)}\n      now ${live.get(k)}`);
			for (const k of kept) console.log(`  = ${k}  ${ours.get(k)}  [kept: not served by this instance]`);
		}
	}

	console.log(`\nTotal: +${totalAdded} -${totalDropped} ~${totalChanged}, ${totalKept} kept`);
	if (missing.length) console.log(`\nNot served by this instance (left untouched):\n  ${missing.join("\n  ")}`);
	const unlisted = listUnlistedModules(new Set([...existing.keys(), ...addUris]));
	if (unlisted.length) {
		console.log(`\nServed by this instance but not in our runtime (use --add <uri> to generate):\n  ${unlisted.join("\n  ")}`);
	}
	if (newFiles.length) {
		console.log(`\nNew files: ${newFiles.join(", ")}\n  Register them in RUNTIME_FILES (src/runtimes.ts).`);
	}
	console.log(write ? `\nWrote ${modules.length - missing.length} files to ${outDir}` : `\nGenerated files in ${outDir} (use --write to apply)`);
}

main();
