import { EditorView, basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { analyzeWithAst } from "../src/analyzer.ts";

const DEFAULT_CODE = `(: xq-lsp playground — parse errors are annotated inline :)
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

const xqueryLinter = linter((view): Diagnostic[] => {
  const { parseError } = analyzeWithAst(view.state.doc.toString(), "playground.xq");
  if (!parseError) return [];
  return [{ from: 0, to: view.state.doc.length || 1, severity: "error", message: parseError.message }];
});

const view = new EditorView({
  doc: getInitialCode(),
  extensions: [
    basicSetup,
    StreamLanguage.define(xQuery),
    lintGutter(),
    xqueryLinter,
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
