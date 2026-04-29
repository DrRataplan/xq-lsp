import { XQuery31Full } from "xq-parser";
import type { Node, NonTerminal, Terminal } from "xq-parser";
import type {
  FileAnalysis,
  FunctionSymbol,
  VariableSymbol,
  ImportInfo,
  ParamInfo,
} from "./types.ts";

// ── AST helpers ─────────────────────────────────────────────────────────────

function isTerminal(node: Node): node is Terminal {
  return node.isTerminal;
}

function asNonTerminal(node: Node): NonTerminal {
  return node as NonTerminal;
}

function firstTerminalValue(node: Node): string | null {
  if (isTerminal(node)) return node.value;
  for (const child of asNonTerminal(node).children) {
    const v = firstTerminalValue(child);
    if (v !== null) return v;
  }
  return null;
}

function findAll(node: Node, type: string, out: Node[] = []): Node[] {
  if (node.type === type) out.push(node);
  if (!isTerminal(node)) {
    for (const child of asNonTerminal(node).children) {
      findAll(child, type, out);
    }
  }
  return out;
}

function directChildOf(node: Node, type: string): Node | undefined {
  if (isTerminal(node)) return undefined;
  return asNonTerminal(node).children.find((c) => c.type === type);
}

function directChildrenOf(node: Node, type: string): Node[] {
  if (isTerminal(node)) return [];
  return asNonTerminal(node).children.filter((c) => c.type === type);
}

// ── Extract from valid AST ───────────────────────────────────────────────────

function extractFunctions(ast: Node, sourceUri: string): FunctionSymbol[] {
  const results: FunctionSymbol[] = [];
  for (const decl of findAll(ast, "FunctionDecl")) {
    const eqname = directChildOf(decl, "EQName");
    const name = eqname ? firstTerminalValue(eqname) : null;
    if (!name) continue;

    const colonIdx = name.indexOf(":");
    const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : "";
    const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;

    const params: ParamInfo[] = [];
    const paramList = directChildOf(decl, "ParamList");
    if (paramList) {
      for (const param of findAll(paramList, "Param")) {
        const paramEqname = directChildOf(param, "EQName");
        const paramName = paramEqname ? firstTerminalValue(paramEqname) : null;
        if (!paramName) continue;
        const typeDecl = directChildOf(param, "TypeDeclaration");
        const paramType = typeDecl
          ? (firstTerminalValue(typeDecl) ?? undefined)
          : undefined;
        params.push({ name: paramName, type: paramType });
      }
    }

    // Return type: 'as' followed by SequenceType
    const seqType = directChildOf(decl, "SequenceType");
    const returnType = seqType
      ? (firstTerminalValue(seqType) ?? undefined)
      : undefined;

    results.push({
      name,
      prefix,
      localName,
      arity: params.length,
      params,
      returnType,
      sourceUri,
      sourceOffset: decl.start,
    });
  }
  return results;
}

function extractModuleVariables(
  ast: Node,
  sourceUri: string,
): VariableSymbol[] {
  const results: VariableSymbol[] = [];
  for (const varDecl of findAll(ast, "VarDecl")) {
    const varName = directChildOf(varDecl, "VarName");
    const name = varName ? firstTerminalValue(varName) : null;
    if (!name) continue;
    results.push({
      name,
      offset: varDecl.start,
      isModuleLevel: true,
      sourceUri,
    });
  }
  return results;
}

function extractLocalBindings(ast: Node, sourceUri: string): VariableSymbol[] {
  const results: VariableSymbol[] = [];
  for (const binding of [
    ...findAll(ast, "LetBinding"),
    ...findAll(ast, "ForBinding"),
  ]) {
    const varName = directChildOf(binding, "VarName");
    const name = varName ? firstTerminalValue(varName) : null;
    if (!name) continue;
    results.push({
      name,
      offset: binding.start,
      isModuleLevel: false,
      sourceUri,
    });
  }
  return results;
}

function extractImports(ast: Node): ImportInfo[] {
  const results: ImportInfo[] = [];
  for (const mi of findAll(ast, "ModuleImport")) {
    const ncname = directChildOf(mi, "NCName");
    const prefix = ncname ? firstTerminalValue(ncname) : null;
    if (!prefix) continue;
    const uris = directChildrenOf(mi, "URILiteral");
    if (uris.length < 2) continue;
    const namespaceUri = stripQuotes(firstTerminalValue(uris[0]) ?? "");
    const atPath = stripQuotes(firstTerminalValue(uris[1]) ?? "");
    results.push({ prefix, namespaceUri, atPath });
  }
  return results;
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

function analyzeAst(ast: Node, sourceUri: string): FileAnalysis {
  return {
    functions: extractFunctions(ast, sourceUri),
    moduleVariables: extractModuleVariables(ast, sourceUri),
    localBindings: extractLocalBindings(ast, sourceUri),
    imports: extractImports(ast),
  };
}

// ── Regex fallback for syntactically invalid / partial XQuery ────────────────

const RE_FUNC =
  /declare\s+(?:%[\w:\-]+(?:\([^)]*\))?\s+)*function\s+([\w:\-]+)\s*\(([^)]*)\)/g;
const RE_VAR_DECL =
  /declare\s+(?:%[\w:\-]+(?:\([^)]*\))?\s+)*variable\s+\$([\w:\-]+)/g;
const RE_LET = /\blet\s+\$([\w:\-]+)\s*:=/g;
const RE_FOR = /\bfor\s+\$([\w:\-]+)\s+in\b/g;
const RE_IMPORT =
  /import\s+module\s+namespace\s+([\w\-]+)\s*=\s*["']([^"']*)["']\s+at\s+["']([^"']*)["']/g;

function analyzeRegex(text: string, sourceUri: string): FileAnalysis {
  const functions: FunctionSymbol[] = [];
  const moduleVariables: VariableSymbol[] = [];
  const localBindings: VariableSymbol[] = [];
  const imports: ImportInfo[] = [];

  let m: RegExpExecArray | null;

  RE_FUNC.lastIndex = 0;
  while ((m = RE_FUNC.exec(text)) !== null) {
    const name = m[1];
    const colonIdx = name.indexOf(":");
    const prefix = colonIdx >= 0 ? name.slice(0, colonIdx) : "";
    const localName = colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
    const rawParams = m[2].trim();
    const params: ParamInfo[] = rawParams
      ? rawParams.split(",").map((p) => {
          const varMatch = p.match(/\$([\w:\-]+)/);
          const typeMatch = p.match(/as\s+([\w:\-]+(?:\(.*?\))?)/);
          return {
            name: varMatch ? varMatch[1] : p.trim(),
            type: typeMatch ? typeMatch[1] : undefined,
          };
        })
      : [];
    functions.push({
      name,
      prefix,
      localName,
      arity: params.length,
      params,
      sourceUri,
      sourceOffset: m.index,
    });
  }

  RE_VAR_DECL.lastIndex = 0;
  while ((m = RE_VAR_DECL.exec(text)) !== null) {
    moduleVariables.push({
      name: m[1],
      offset: m.index,
      isModuleLevel: true,
      sourceUri,
    });
  }

  RE_LET.lastIndex = 0;
  while ((m = RE_LET.exec(text)) !== null) {
    localBindings.push({
      name: m[1],
      offset: m.index,
      isModuleLevel: false,
      sourceUri,
    });
  }

  RE_FOR.lastIndex = 0;
  while ((m = RE_FOR.exec(text)) !== null) {
    localBindings.push({
      name: m[1],
      offset: m.index,
      isModuleLevel: false,
      sourceUri,
    });
  }

  RE_IMPORT.lastIndex = 0;
  while ((m = RE_IMPORT.exec(text)) !== null) {
    imports.push({ prefix: m[1], namespaceUri: m[2], atPath: m[3] });
  }

  return { functions, moduleVariables, localBindings, imports };
}

// Testing

export function analyze(text: string, sourceUri: string): FileAnalysis {
  try {
    const { ast } = XQuery31Full(text);
    return analyzeAst(ast, sourceUri);
  } catch {
    return analyzeRegex(text, sourceUri);
  }
}
