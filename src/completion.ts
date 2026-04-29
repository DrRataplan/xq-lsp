import { CompletionItem, CompletionItemKind, InsertTextFormat, MarkupKind } from 'vscode-languageserver/node.js';
import type { FileAnalysis, FunctionSymbol, VariableSymbol } from './types.ts';

export interface CompletionContext {
  /** Text from start of document up to (and including) the cursor position */
  textBeforeCursor: string;
  /** Character offset of the cursor in the document */
  cursorOffset: number;
}

interface TokenInfo {
  kind: 'variable' | 'qualified-name' | 'name';
  /** Prefix typed so far — used to filter completions */
  prefix: string;
  /** For qualified names, the namespace prefix before the colon */
  nsPrefix?: string;
}

function parseToken(textBefore: string): TokenInfo {
  // Scan backwards to find what token is being typed.
  // Relevant patterns (from rightmost char):
  //   $foo   → variable, prefix "foo"
  //   $      → variable, prefix ""
  //   ns:bar → qualified-name, nsPrefix "ns", prefix "bar"
  //   ns:    → qualified-name, nsPrefix "ns", prefix ""
  //   foo    → name, prefix "foo"

  const match = textBefore.match(/\$([\w:\-]*)$|(?:([\w\-]+):)([\w\-]*)$|([\w\-]+)$/);
  if (!match) return { kind: 'name', prefix: '' };

  if (match[0].startsWith('$')) {
    return { kind: 'variable', prefix: match[1] ?? '' };
  }
  if (match[2] !== undefined) {
    return { kind: 'qualified-name', nsPrefix: match[2], prefix: match[3] ?? '' };
  }
  return { kind: 'name', prefix: match[4] ?? '' };
}

function functionDoc(fn: FunctionSymbol): string {
  const paramStr = fn.params.map(p => `$${p.name}${p.type ? ' as ' + p.type : ''}`).join(', ');
  const ret = fn.returnType ? ` as ${fn.returnType}` : '';
  return `\`\`\`xquery\ndeclare function ${fn.name}(${paramStr})${ret}\n\`\`\``;
}

function functionSnippet(fn: FunctionSymbol): string {
  const params = fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(', ');
  return `${fn.name}(${params})`;
}

function functionPlain(fn: FunctionSymbol): string {
  return `${fn.name}(${fn.params.map(p => `$${p.name}`).join(', ')})`;
}

function buildFunctionItem(fn: FunctionSymbol, filter: string, snippets: boolean): CompletionItem | null {
  if (filter && !fn.name.toLowerCase().includes(filter.toLowerCase())) return null;
  return {
    label: fn.name,
    kind: CompletionItemKind.Function,
    detail: `${fn.name}#${fn.arity}`,
    documentation: { kind: MarkupKind.Markdown, value: functionDoc(fn) },
    insertText: snippets ? functionSnippet(fn) : functionPlain(fn),
    insertTextFormat: snippets ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
  };
}

function buildVariableItem(v: VariableSymbol, filter: string): CompletionItem | null {
  if (filter && !v.name.toLowerCase().startsWith(filter.toLowerCase())) return null;
  return {
    label: `$${v.name}`,
    kind: CompletionItemKind.Variable,
    insertText: `$${v.name}`,
    insertTextFormat: InsertTextFormat.PlainText,
  };
}

export function getCompletions(
  ctx: CompletionContext,
  currentAnalysis: FileAnalysis,
  importedAnalyses: Map<string, FileAnalysis>,
  snippets = false,
): CompletionItem[] {
  const token = parseToken(ctx.textBeforeCursor);
  const items: CompletionItem[] = [];

  if (token.kind === 'variable') {
    // Offer module-level declared variables
    for (const v of currentAnalysis.moduleVariables) {
      const item = buildVariableItem(v, token.prefix);
      if (item) items.push(item);
    }
    // Offer let/for bindings visible at cursor position (defined before cursor)
    for (const v of currentAnalysis.localBindings) {
      if (v.offset < ctx.cursorOffset) {
        const item = buildVariableItem(v, token.prefix);
        if (item) items.push(item);
      }
    }
    // Offer imported module variables
    for (const analysis of importedAnalyses.values()) {
      for (const v of analysis.moduleVariables) {
        const item = buildVariableItem(v, token.prefix);
        if (item) items.push(item);
      }
    }
    return items;
  }

  if (token.kind === 'qualified-name' && token.nsPrefix) {
    // User typed "ns:" or "ns:partial" → complete functions from that namespace
    const nsPrefix = token.nsPrefix;

    const localInsert = (fn: FunctionSymbol) =>
      fn.params.length === 0
        ? fn.localName + '()'
        : snippets
          ? fn.localName + '(' + fn.params.map((p, i) => `\${${i + 1}:\\$${p.name}}`).join(', ') + ')'
          : fn.localName + '(' + fn.params.map(p => `$${p.name}`).join(', ') + ')';

    // Local functions with this prefix
    for (const fn of currentAnalysis.functions) {
      if (fn.prefix !== nsPrefix) continue;
      const item = buildFunctionItem(fn, token.prefix, snippets);
      if (item) {
        item.label = fn.localName;
        item.insertText = localInsert(fn);
        items.push(item);
      }
    }

    // Functions from matching imported file
    for (const imp of currentAnalysis.imports) {
      if (imp.prefix !== nsPrefix) continue;
      const imported = importedAnalyses.get(imp.atPath);
      if (!imported) continue;
      for (const fn of imported.functions) {
        const item = buildFunctionItem(fn, token.prefix, snippets);
        if (item) {
          item.label = fn.localName;
          item.insertText = localInsert(fn);
          items.push(item);
        }
      }
    }

    return items;
  }

  // Plain name → complete all functions
  for (const fn of currentAnalysis.functions) {
    const item = buildFunctionItem(fn, token.prefix, snippets);
    if (item) items.push(item);
  }
  for (const analysis of importedAnalyses.values()) {
    for (const fn of analysis.functions) {
      const item = buildFunctionItem(fn, token.prefix, snippets);
      if (item) items.push(item);
    }
  }

  return items;
}
