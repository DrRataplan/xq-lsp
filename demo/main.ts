import { EditorView, basicSetup } from "codemirror";
import { hoverTooltip } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { analyzeWithAst, resolvePrefix } from "../src/analyzer.ts";
import { findUndeclaredPrefixUsages } from "../src/namespace-diagnostics.ts";
import { checkTypes } from "../src/typechecker.ts";
import { formatQName, type FileAnalysis, type FunctionSymbol } from "../src/types.ts";

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

function wordAt(text: string, offset: number): { word: string; start: number; end: number } {
  let start = offset;
  let end = offset;
  while (start > 0 && /[\w:\-]/.test(text[start - 1])) start--;
  while (end < text.length && /[\w:\-]/.test(text[end])) end++;
  return { word: text.slice(start, end), start, end };
}

function functionSignature(fn: FunctionSymbol): string {
  const params = fn.params.map((p) => `$${p.name}${p.type ? " as " + p.type : ""}`).join(", ");
  const ret = fn.returnType ? ` as ${fn.returnType}` : "";
  return `declare function ${formatQName(fn.qname)}(${params})${ret}`;
}

function resolveHoverFn(word: string, analysis: FileAnalysis): FunctionSymbol | undefined {
  const colonIdx = word.indexOf(":");
  const prefix = colonIdx >= 0 ? word.slice(0, colonIdx) : "";
  const localName = colonIdx >= 0 ? word.slice(colonIdx + 1) : word;
  const uri = resolvePrefix(prefix, analysis);
  return analysis.functions.find((f) => f.qname.namespaceUri === uri && f.qname.localName === localName);
}

const xqueryHover = hoverTooltip((view, pos) => {
  const text = view.state.doc.toString();
  const { word, start, end } = wordAt(text, pos);
  if (!word) return null;
  if (start > 0 && text[start - 1] === "$") return null;

  const { analysis, parseError } = analyzeWithAst(text, "playground.xq");
  if (parseError) return null;

  const fn = resolveHoverFn(word, analysis);
  if (!fn) return null;

  return {
    pos: start,
    end,
    create() {
      const dom = document.createElement("div");
      dom.className = "xq-hover";
      const sig = document.createElement("code");
      sig.textContent = functionSignature(fn);
      dom.appendChild(sig);
      if (fn.doc?.description) {
        const desc = document.createElement("p");
        desc.textContent = fn.doc.description;
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

// Keep TS happy — view is used via side-effects only
void view;
