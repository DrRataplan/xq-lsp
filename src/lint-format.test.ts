import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMarkdownSummary } from "./lint-format.ts";
import type { LintResult } from "./lint.ts";

test("markdown summary escapes markdown characters in messages", () => {
	const results = [
		{
			filePath: "a.xq",
			errorCount: 0,
			warningCount: 1,
			hintCount: 0,
			messages: [
				{ severity: "warning", line: 1, column: 1, endLine: 1, endColumn: 2, code: "X", message: "bad *: a|b_c" },
			],
		},
	] as unknown as LintResult[];
	assert.match(formatMarkdownSummary(results), /bad \\\*: a\\\|b\\_c/);
});
