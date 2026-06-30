import * as fs from "fs";
import { fileURLToPath } from "url";
import { Location } from "vscode-languageserver/node.js";
import type { Position } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FileAnalysis } from "./types.ts";
import { resolvePrefix, parseEQName } from "./analyzer.ts";

function wordAt(text: string, offset: number): { word: string; start: number } {
	let start = offset;
	let end = offset;
	while (start > 0 && /[\w:\-]/.test(text[start - 1])) start--;
	while (end < text.length && /[\w:\-]/.test(text[end])) end++;
	return { word: text.slice(start, end), start };
}

function positionInText(text: string, offset: number): Position {
	const before = text.slice(0, offset);
	const lines = before.split("\n");
	return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

export function getDefinition(
	doc: TextDocument,
	offset: number,
	current: FileAnalysis,
	imported: Map<string, FileAnalysis>,
): Location | null {
	const text = doc.getText();
	const { word, start } = wordAt(text, offset);
	if (!word) return null;

	const hasDollar = start > 0 && text[start - 1] === "$";

	if (hasDollar) {
		const { prefix: varPrefix, localName: varLocalName, uri: varDirectUri } = parseEQName(word);
		const varNsUri = varDirectUri ?? (varPrefix ? resolvePrefix(varPrefix, current) : "");

		// Local bindings and module-level variables in current file
		const allVars = [...current.moduleVariables, ...current.localBindings];
		const v = allVars.find((v) => v.qname.namespaceUri === varNsUri && v.qname.localName === varLocalName);
		if (v) {
			const pos = doc.positionAt(v.offset);
			return Location.create(doc.uri, { start: pos, end: pos });
		}

		// Function params in the current file (prefer the nearest enclosing function)
		if (!varNsUri) {
			const enclosingFn = current.functions
				.filter((f) => f.sourceOffset !== undefined && f.sourceOffset <= offset)
				.at(-1);
			const matchingFn = enclosingFn ?? current.functions[0];
			const param = matchingFn?.params.find((p) => p.name === varLocalName);
			if (param?.sourceOffset !== undefined) {
				const pos = doc.positionAt(param.sourceOffset);
				return Location.create(doc.uri, { start: pos, end: pos });
			}
		}

		// Imported module-level variables
		for (const [, analysis] of imported) {
			const iv = analysis.moduleVariables.find(
				(v) => v.qname.namespaceUri === varNsUri && v.qname.localName === varLocalName,
			);
			if (!iv) continue;
			const uri = iv.sourceUri;
			let pos: Position = { line: 0, character: 0 };
			try {
				const filePath = fileURLToPath(uri);
				const srcText = fs.readFileSync(filePath, "utf-8");
				pos = positionInText(srcText, iv.offset);
			} catch {
				/* file not readable, use line 0 */
			}
			return Location.create(uri, { start: pos, end: pos });
		}

		return null;
	}

	// Function definition — resolve by namespace URI, search current file then all imports
	const { prefix: wordPrefix, localName: wordLocalName, uri: wordDirectUri } = parseEQName(word);
	const targetUri = wordDirectUri ?? resolvePrefix(wordPrefix, current);

	const localFn = current.functions.find(
		(f) => f.qname.namespaceUri === targetUri && f.qname.localName === wordLocalName,
	);
	if (localFn) {
		const pos = doc.positionAt(localFn.sourceOffset ?? 0);
		return Location.create(doc.uri, { start: pos, end: pos });
	}

	// Search imported files: find which import contains the function, then navigate there
	for (const imp of current.imports) {
		const key = imp.atPath ?? imp.namespaceUri;
		const analysis = imported.get(key);
		if (!analysis) continue;
		const fn = analysis.functions.find(
			(f) => f.qname.namespaceUri === targetUri && f.qname.localName === wordLocalName,
		);
		if (!fn) continue;
		const uri = fn.sourceUri;
		let pos: Position = { line: 0, character: 0 };
		if (fn.sourceOffset !== undefined) {
			try {
				const filePath = fileURLToPath(uri);
				const srcText = fs.readFileSync(filePath, "utf-8");
				pos = positionInText(srcText, fn.sourceOffset);
			} catch {
				/* file not readable, use line 0 */
			}
		}
		return Location.create(uri, { start: pos, end: pos });
	}

	return null;
}
