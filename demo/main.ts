import { EditorView, basicSetup } from "codemirror";
import { hoverTooltip } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { analyzeWithAst, analyze, XMLNS_FN } from "../src/analyzer.ts";
import builtinsFn from "../builtins/builtins-fn.xq?raw";
import builtinsMath from "../builtins/builtins-math.xq?raw";
import builtinsMap from "../builtins/builtins-map.xq?raw";
import builtinsArray from "../builtins/builtins-array.xq?raw";
import { findUndeclaredPrefixUsages } from "../src/namespace-diagnostics.ts";
import { checkTypes } from "../src/typechecker.ts";
import { type FileAnalysis } from "../src/types.ts";
import { resolveFunctionAtOffset, functionSignature } from "../src/hover-core.ts";
import fontoxpath from "fontoxpath";

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

const xqueryHover = hoverTooltip((view, pos) => {
	const text = view.state.doc.toString();
	const { analysis } = analyzeWithAst(text, "playground.xq");
	const result = resolveFunctionAtOffset(text, pos, analysis, new Map([["builtin:fn", getBuiltins()]]));
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

const xqueryLinter = linter((view): Diagnostic[] => {
	const code = view.state.doc.toString();
	const { analysis, ast, parseError } = analyzeWithAst(code, "playground.xq");
	const diagnostics: Diagnostic[] = [];

	if (parseError) {
		diagnostics.push({ from: 0, to: view.state.doc.length || 1, severity: "error", message: parseError.message });
		return diagnostics;
	}

	for (const d of findUndeclaredPrefixUsages(ast, analysis)) {
		diagnostics.push({ from: d.offset, to: d.offset + d.length, severity: "error", message: d.message });
	}

	if (ast) {
		for (const d of checkTypes(ast, code, analysis, new Map())) {
			diagnostics.push({ from: d.offset, to: d.offset + d.length, severity: "warning", message: d.message });
		}
	}

	return diagnostics;
});

const view = new EditorView({
	doc: getInitialCode(),
	extensions: [
		basicSetup,
		StreamLanguage.define(xQuery),
		lintGutter(),
		xqueryLinter,
		xqueryHover,
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

// ── Config panel ─────────────────────────────────────────────────────────────

const configEl = document.getElementById("config-editor") as HTMLTextAreaElement;
const configErrorEl = document.getElementById("config-error")!;

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
}

applyConfig();
configEl.addEventListener("input", applyConfig);

// Keep TS happy — view is used via side-effects only
void view;
