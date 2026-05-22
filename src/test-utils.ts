import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TextDocument } from "vscode-languageserver-textdocument";

export function makeDoc(content: string, uri = "file:///test.xq"): TextDocument {
	return TextDocument.create(uri, "xquery", 1, content);
}

export function withTmpDir(fn: (dir: string) => void): void {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xq-lsp-test-"));
	try {
		fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
