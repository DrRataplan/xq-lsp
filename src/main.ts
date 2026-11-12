#!/usr/bin/env node
/**
 * Entry point for the `xq-lsp` binary.
 *
 * `xq-lsp lint …` runs the standalone linter (cli.ts); `--help` / `--version` print
 * CLI information; anything else (including `--stdio`, as spawned by editors) starts
 * the language server (server.ts). Both are loaded via dynamic import so the server's
 * side effects (connection, listen) never run in lint mode, and the lint machinery is
 * never loaded for editor sessions.
 */
export {};

const arg = process.argv[2];

if (arg === "lint") {
	const { runCli } = await import("./cli.ts");
	process.exitCode = await runCli(process.argv.slice(3));
} else if (arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v") {
	const { runCli } = await import("./cli.ts");
	process.exitCode = await runCli([arg]);
} else {
	await import("./server.ts");
}
