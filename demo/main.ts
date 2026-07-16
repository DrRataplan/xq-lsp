import { EditorView, basicSetup } from "codemirror";
import { hoverTooltip, showTooltip } from "@codemirror/view";
import { StateField } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import { linter, lintGutter, forceLinting, type Diagnostic } from "@codemirror/lint";
import { autocompletion, type CompletionContext as CMCompletionContext } from "@codemirror/autocomplete";
import { analyzeWithAst, analyze, XMLNS_FN } from "../src/analyzer.ts";
import builtinsFn from "../builtins/builtins-fn.xq?raw";
import builtinsMath from "../builtins/builtins-math.xq?raw";
import builtinsMap from "../builtins/builtins-map.xq?raw";
import builtinsArray from "../builtins/builtins-array.xq?raw";
import { findUndeclaredPrefixUsages } from "../src/namespace-diagnostics.ts";
import { runDiagnostics, runHints } from "../src/diagnostics.ts";
import { type FileAnalysis } from "../src/types.ts";
import { resolveFunctionAtOffset, resolveSignatureAtOffset, functionSignature } from "../src/hover-core.ts";
import { getCompletions } from "../src/completion-core.ts";
import { getRuntimePredeclaredNamespaces, withPredeclaredNs } from "../src/predeclared-namespaces.ts";
import fontoxpath from "fontoxpath";

// Raw XQuery source for every runtime module file (src/runtimes/<lib>/*.xq), grouped
// by lib name below. Loaded eagerly via ?raw so this stays a plain string bundled
// into the browser build — src/runtimes.ts itself uses Node's fs and can't be
// imported here (see the computeRelativePath fix for the same class of issue).
const runtimeSources = import.meta.glob("../src/runtimes/*/*.xq", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

const runtimeFilesByLib = new Map<string, string[]>();
for (const [filePath, source] of Object.entries(runtimeSources)) {
	const match = filePath.match(/\/runtimes\/([^/]+)\//);
	if (!match) continue;
	const list = runtimeFilesByLib.get(match[1]) ?? [];
	list.push(source);
	runtimeFilesByLib.set(match[1], list);
}

const runtimeAnalysisCache = new Map<string, FileAnalysis[]>();
function getRuntimeAnalyses(libs: string[]): FileAnalysis[] {
	const results: FileAnalysis[] = [];
	for (const lib of libs) {
		let cached = runtimeAnalysisCache.get(lib);
		if (!cached) {
			cached = (runtimeFilesByLib.get(lib) ?? []).map((src, i) => analyze(src, `builtin:${lib}:${i}`));
			runtimeAnalysisCache.set(lib, cached);
		}
		results.push(...cached);
	}
	return results;
}

const DEFAULT_CODE = `(: xq-lsp playground — errors are annotated inline :)
for $x in (1, 2, 3)
return $x * 2
`;

function encode(s: string): string {
	const bytes = new TextEncoder().encode(s);
	const b64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decode(s: string): string {
	try {
		let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
		while (b64.length % 4) b64 += "=";
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return DEFAULT_CODE;
	}
}

function getInitialCode(): string {
	const encoded = new URLSearchParams(location.search).get("code");
	return encoded ? decode(encoded) : DEFAULT_CODE;
}

function getInitialConfig(): string {
	const encoded = new URLSearchParams(location.search).get("config");
	return encoded ? decode(encoded) : "";
}

function validateConfig(text: string): string | null {
	const trimmed = text.trim();
	if (!trimmed) return null;
	try {
		fontoxpath.evaluateXPathToStrings(`(${trimmed})?glob`, null, null, {});
		return null;
	} catch (e) {
		return e instanceof Error ? e.message : String(e);
	}
}

let _builtins: ReturnType<typeof analyze> | null = null;
function getBuiltins() {
	if (!_builtins) {
		const analyses = [builtinsFn, builtinsMath, builtinsMap, builtinsArray].map((src, i) =>
			analyze(src, `builtin:${i}`),
		);
		_builtins = {
			functions: analyses.flatMap((a) => a.functions),
			moduleVariables: [],
			localBindings: [],
			imports: [],
			namespaceDecls: [],
			defaultFunctionNamespace: XMLNS_FN,
			usedAstPath: false,
		};
	}
	return _builtins;
}

function getImported(analysis: FileAnalysis, libs: string[]): Map<string, FileAnalysis> {
	const imported = new Map<string, FileAnalysis>([["builtin:fn", getBuiltins()]]);

	const runtimeByNamespace = new Map<string, FileAnalysis>();
	for (const runtimeAnalysis of getRuntimeAnalyses(libs)) {
		if (runtimeAnalysis.moduleNamespaceUri) runtimeByNamespace.set(runtimeAnalysis.moduleNamespaceUri, runtimeAnalysis);
	}

	for (const imp of analysis.imports) {
		const runtimeAnalysis = runtimeByNamespace.get(imp.namespaceUri);
		if (runtimeAnalysis) imported.set(imp.namespaceUri, runtimeAnalysis);
	}

	// Runtime modules that are pre-declared (e.g. existdb's util/xmldb) are available
	// without an explicit import.
	for (const nd of getRuntimePredeclaredNamespaces(libs)) {
		if (!imported.has(nd.namespaceUri)) {
			const runtimeAnalysis = runtimeByNamespace.get(nd.namespaceUri);
			if (runtimeAnalysis) imported.set(nd.namespaceUri, runtimeAnalysis);
		}
	}

	return imported;
}

// ── Hover ────────────────────────────────────────────────────────────────────

const xqueryHover = hoverTooltip((view, pos) => {
	const text = view.state.doc.toString();
	const libs = getConfigLibs();
	const { analysis: rawAnalysis } = analyzeWithAst(text, "playground.xq");
	const analysis = withPredeclaredNs(rawAnalysis, getRuntimePredeclaredNamespaces(libs));
	const result = resolveFunctionAtOffset(text, pos, analysis, getImported(analysis, libs));
	if (!result) return null;

	return {
		pos: result.start,
		end: result.end,
		create() {
			const dom = document.createElement("div");
			dom.className = "xq-hover";
			const sig = document.createElement("code");
			sig.textContent = functionSignature(result.fn);
			dom.appendChild(sig);
			if (result.fn.doc?.description) {
				const desc = document.createElement("p");
				desc.textContent = result.fn.doc.description;
				dom.appendChild(desc);
			}
			return { dom };
		},
	};
});

// ── Completions ───────────────────────────────────────────────────────────────

function xqueryCompletions(ctx: CMCompletionContext) {
	// Only trigger on word characters, $, or :
	const word = ctx.matchBefore(/[$\w:][:\w-]*/);
	if (!word && !ctx.explicit) return null;

	const text = ctx.state.doc.toString();
	const libs = getConfigLibs();
	const { analysis: rawAnalysis } = analyzeWithAst(text, "playground.xq");
	const analysis = withPredeclaredNs(rawAnalysis, getRuntimePredeclaredNamespaces(libs));
	const entries = getCompletions(
		{ textBeforeCursor: text.slice(0, ctx.pos), cursorOffset: ctx.pos },
		analysis,
		getImported(analysis, libs),
	);
	if (!entries.length) return null;

	return {
		from: word?.from ?? ctx.pos,
		options: entries.map((e) => ({
			label: e.label,
			type: e.kind,
			detail: e.detail,
			info: e.documentation,
			apply: e.insertText,
		})),
		validFor: /^[$\w:][:\w-]*$/,
	};
}

// ── Signature help ────────────────────────────────────────────────────────────

const signatureField = StateField.define({
	create: () => null,
	update(_val, tr) {
		if (!tr.docChanged && !tr.selection) return _val;
		return null; // cleared; recomputed in provide
	},
	provide: (f) =>
		showTooltip.computeN([f], (state) => {
			const text = state.doc.toString();
			const pos = state.selection.main.head;
			const libs = getConfigLibs();
			const { analysis: rawAnalysis } = analyzeWithAst(text, "playground.xq");
			const analysis = withPredeclaredNs(rawAnalysis, getRuntimePredeclaredNamespaces(libs));
			const sig = resolveSignatureAtOffset(text, pos, analysis, getImported(analysis, libs));
			if (!sig) return [];
			const name = sig.fn.qname.prefix
				? `${sig.fn.qname.prefix}:${sig.fn.qname.localName}`
				: sig.fn.qname.localName;
			const params = sig.fn.params
				.map((p, i) => {
					const label = `$${p.name}${p.type ? " as " + p.type : ""}`;
					const span = document.createElement("span");
					span.textContent = label;
					if (i === sig.activeParam) span.className = "xq-sig-active";
					return span.outerHTML;
				})
				.join(", ");
			return [
				{
					pos,
					above: true,
					strictSide: false,
					arrow: false,
					create() {
						const dom = document.createElement("div");
						dom.className = "xq-signature";
						dom.innerHTML = `<code>${name}(${params})</code>`;
						return { dom };
					},
				},
			];
		}),
});

// ── Config panel ─────────────────────────────────────────────────────────────

const configEl = document.getElementById("config-editor") as HTMLTextAreaElement;
const configErrorEl = document.getElementById("config-error")!;

// ── Diagnostics ───────────────────────────────────────────────────────────────

function getConfigPrefixes(): Record<string, string> {
	const text = configEl.value.trim();
	if (!text) return {};
	try {
		const map = fontoxpath.evaluateXPathToMap(`(${text})?prefixes`, null, null, {});
		const result: Record<string, string> = {};
		for (const [k, v] of Object.entries(map)) {
			if (typeof v === "string") result[k] = v;
		}
		return result;
	} catch {
		return {};
	}
}

function getConfigLibs(): string[] {
	const text = configEl.value.trim();
	if (!text) return [];
	try {
		return fontoxpath.evaluateXPathToStrings(`(${text})?lib`, null, null, {});
	} catch {
		return [];
	}
}

const xqueryLinter = linter((view): Diagnostic[] => {
	const code = view.state.doc.toString();
	const libs = getConfigLibs();
	const { analysis: rawAnalysis, ast, parseError } = analyzeWithAst(code, "playground.xq");
	const analysis = withPredeclaredNs(rawAnalysis, getRuntimePredeclaredNamespaces(libs));
	const configPrefixes = getConfigPrefixes();
	const diagnostics: Diagnostic[] = [];

	if (parseError) {
		diagnostics.push({ from: 0, to: view.state.doc.length || 1, severity: "error", message: parseError.message });
		return diagnostics;
	}

	for (const d of findUndeclaredPrefixUsages(ast, analysis)) {
		const nsUri = configPrefixes[d.prefix];
		const actions = nsUri
			? [
					{
						name: `Declare namespace ${d.prefix} = "${nsUri}"`,
						apply(v: EditorView) {
							v.dispatch({
								changes: { from: 0, insert: `declare namespace ${d.prefix} = "${nsUri}";\n` },
							});
						},
					},
				]
			: undefined;
		diagnostics.push({ from: d.offset, to: d.offset + d.length, severity: "error", message: d.message, actions });
	}

	if (ast) {
		const imported = getImported(analysis, libs);
		for (const d of runDiagnostics(ast, code, analysis, imported)) {
			diagnostics.push({ from: d.offset, to: d.offset + d.length, severity: "error", message: d.message });
		}
		for (const d of runHints(ast, analysis)) {
			diagnostics.push({ from: d.offset, to: d.offset + d.length, severity: "hint", message: d.message });
		}
	}

	return diagnostics;
});

// ── Editor ────────────────────────────────────────────────────────────────────

const view = new EditorView({
	doc: getInitialCode(),
	extensions: [
		basicSetup,
		StreamLanguage.define(xQuery),
		lintGutter(),
		xqueryLinter,
		xqueryHover,
		autocompletion({ override: [xqueryCompletions] }),
		signatureField,
		EditorView.updateListener.of((update) => {
			if (!update.docChanged) return;
			const url = new URL(location.href);
			url.searchParams.set("code", encode(update.state.doc.toString()));
			history.replaceState(null, "", url);
		}),
	],
	parent: document.getElementById("editor")!,
});

document.getElementById("share-btn")!.addEventListener("click", () => {
	navigator.clipboard.writeText(location.href);
	const btn = document.getElementById("share-btn")!;
	btn.textContent = "Copied!";
	setTimeout(() => (btn.textContent = "Copy link"), 1500);
});

configEl.value = getInitialConfig();

function applyConfig() {
	const err = validateConfig(configEl.value);
	configEl.classList.toggle("invalid", err !== null);
	configErrorEl.textContent = err ?? "";
	const url = new URL(location.href);
	if (configEl.value.trim()) {
		url.searchParams.set("config", encode(configEl.value));
	} else {
		url.searchParams.delete("config");
	}
	history.replaceState(null, "", url);
	forceLinting(view);
}

applyConfig();
configEl.addEventListener("input", applyConfig);

// Keep TS happy — view is used via side-effects only
void view;
