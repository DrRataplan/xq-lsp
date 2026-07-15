import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { DocumentLink } from "vscode-languageserver/node.js";
import type { Range } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { Node, NonTerminal, Terminal } from "xq-parser";
import type { FileAnalysis } from "./types.ts";
import { findAll, directChildrenOf, isTerminal, XMLNS_FN } from "./analyzer.ts";
import { asFunctionCall } from "./ast-nodes.ts";

function uriToPath(uri: string): string {
	try {
		return fileURLToPath(uri);
	} catch {
		return uri.replace(/^file:\/\//, "");
	}
}

function fileExists(p: string): boolean {
	try {
		return fs.statSync(p).isFile();
	} catch {
		return false;
	}
}

// Unwraps a chain of single-child grammar wrapper nodes down to a bare StringLiteral terminal;
// null when the expression is anything more complex than a literal (e.g. concat(...)).
function asStringLiteral(node: Node): Terminal | null {
	let cur: Node = node;
	while (!isTerminal(cur)) {
		const children = (cur as NonTerminal).children;
		if (children.length !== 1) return null;
		cur = children[0];
	}
	return cur.type === "StringLiteral" ? cur : null;
}

function literalContentRange(doc: TextDocument, literal: Terminal): Range {
	const start = literal.start + 1;
	const end = (literal.end ?? literal.start) - 1;
	return { start: doc.positionAt(start), end: doc.positionAt(Math.max(start, end)) };
}

function resolveRelativeLink(currentDir: string, rawPath: string): string | null {
	if (!rawPath) return null;
	const resolvedPath = path.resolve(currentDir, rawPath);
	return fileExists(resolvedPath) ? pathToFileURL(resolvedPath).toString() : null;
}

export function getDocumentLinks(analysis: FileAnalysis, doc: TextDocument): DocumentLink[] {
	const links: DocumentLink[] = [];
	if (!analysis.ast) return links; // regex-fallback path has no reliable literal offsets

	const currentDir = path.dirname(uriToPath(doc.uri));

	for (const moduleImport of findAll(analysis.ast, "ModuleImport")) {
		const uriLiterals = directChildrenOf(moduleImport, "URILiteral");
		const atNode = uriLiterals[1];
		if (!atNode) continue;
		const literal = asStringLiteral(atNode);
		if (!literal) continue;
		const target = resolveRelativeLink(currentDir, literal.value.slice(1, -1));
		if (!target) continue;
		links.push({ range: literalContentRange(doc, literal), target });
	}

	for (const call of findAll(analysis.ast, "FunctionCall")) {
		const fc = asFunctionCall(call, analysis);
		if (!fc || fc.qname.namespaceUri !== XMLNS_FN) continue;
		if (fc.qname.localName !== "doc" && fc.qname.localName !== "collection") continue;
		const literal = fc.args[0] && asStringLiteral(fc.args[0]);
		if (!literal) continue;
		const target = resolveRelativeLink(currentDir, literal.value.slice(1, -1));
		if (!target) continue;
		links.push({ range: literalContentRange(doc, literal), target });
	}

	return links;
}
