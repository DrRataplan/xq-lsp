# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
node --test                                  # run all tests
node --test --test-name-pattern="hover"      # run a single test by name pattern
npm run build                    # compile to dist/ via tsc
npm start                        # run the LSP server on stdio (for manual testing)
npm install -g .                 # reinstall globally after changes (required for Emacs/editor pickup)
```

Tests use Node's built-in test runner (`node:test`) — no framework needed. TypeScript files run directly with Node v24's native TS support; no compilation step is needed for tests or local development.

### QT4 diagnostic coverage tests

`src/qt4-diagnostic.test.ts` runs the W3C QT4 test suite against the diagnostic pipeline to catch false positives (we flag valid queries) and false negatives (we miss static errors). The testset lives in the `qt4tests/` git submodule — initialize it once after cloning:

```sh
# one-time: initialize the submodule
git submodule update --init

# run (skipped automatically when QT4_TESTS_DIR is unset)
QT4_TESTS_DIR=qt4tests node --test src/qt4-diagnostic.test.ts

# regenerate snapshots after changing diagnostic logic or updating the testset pin
QT4_TESTS_DIR=qt4tests node --test --test-update-snapshots src/qt4-diagnostic.test.ts
```

Snapshots live in `src/qt4-snaps/` — one JSON file per QT4 test-set, listing every failing case with its outcome (`false-positive` or `false-negative`), the expected error code, and what codes we actually emitted. CI checks out the submodule automatically via `submodules: true` on `actions/checkout`.

The pinned commit is the submodule pointer in `.gitmodules`. A weekly CI workflow (`qt4-update.yml`) checks for new upstream commits and opens a PR that advances the submodule and regenerates snapshots.

## Architecture

The server is a standard LSP over stdio. `src/server.ts` is the entry point and wires together all features using `vscode-languageserver`.

**Two-phase parsing** is the central design: `src/analyzer.ts` first tries `XQuery31Full()` from `xq-parser`. If it throws (file is mid-edit and syntactically invalid), it falls back to regex extraction. Both paths produce the same `FileAnalysis` shape (`src/types.ts`).

**`FileAnalysis`** (`src/types.ts`) — the shared data structure passed everywhere:

- `functions` — declared functions with name, prefix, localName, arity, params, returnType, sourceOffset
- `moduleVariables` — `declare variable` declarations
- `localBindings` — `let`/`for` bindings (scope-approximated: visible from their offset onward)
- `imports` — `import module namespace prefix="uri" at "path"` declarations
- `namespaceDecls` — `declare namespace prefix="uri"` statements
- `defaultFunctionNamespace` — from `declare default function namespace`, else `XMLNS_FN`
- `moduleNamespaceUri` / `modulePrefix` — from `module namespace prefix="uri"`

**Predeclared namespaces** (`src/runtimes.ts`, `src/runtimes/*.json`) — namespace prefixes that are in scope without any declaration in the source. Two JSON files drive this:

- `src/runtimes/w3c-predeclared.json` — standard XQuery 3.1 predeclared prefixes (`math`, `map`, `array`). Always active.
- `src/runtimes/existdb/predeclared-namespaces.json` — eXist-db-specific prefixes (`util`, `xmldb`, `sm`, …). Active when `lib: "existdb"` is configured.

`src/analyzer.ts` `BUILTIN_PREFIXES` is intentionally minimal (only `fn`, `local`, `xs`, `xml` — the spec-mandated fundamentals used by the resolver itself). All other predeclared prefixes live in the JSON files.

`getRuntimePredeclaredNamespaces(runtimes)` in `runtimes.ts` returns the combined list; `withPredeclaredNs(analysis, ns)` merges them into `analysis.namespaceDecls` so `resolvePrefix` picks them up.

**`resolveContext`** in `server.ts` — called at the start of every LSP handler. It:
1. Calls `getRuntimePredeclaredNamespaces` for the active runtimes and injects them into the analysis via `withPredeclaredNs` (suppresses false `XQST0081` diagnostics for pre-declared prefixes)
2. Builds the `imported: Map<string, FileAnalysis>` by resolving explicit `import module` statements and also including pre-declared runtime modules directly (so completions/hover/go-to-definition work without a written import)

**Feature handlers** (`src/completion.ts`, `src/features.ts`) take `(currentAnalysis, importedAnalyses)` and are pure functions — no server state. Completion context is determined by scanning text before the cursor for `$`, `ns:`, or plain names. Snippet format is only used when the client advertises `snippetSupport`.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) because release-please reads commit messages to determine version bumps and generate changelogs. PRs are squash-merged, so **the PR title is the commit message** — make it conformant.

Format: `<type>[optional scope]: <description>`

| Type       | Version bump | When to use                            |
| ---------- | ------------ | -------------------------------------- |
| `feat`     | minor        | New user-visible capability            |
| `fix`      | patch        | Bug fix                                |
| `perf`     | patch        | Performance improvement                |
| `docs`     | —            | Documentation only                     |
| `refactor` | —            | Code restructuring, no behavior change |
| `test`     | —            | Adding or fixing tests                 |
| `chore`    | —            | Build, deps, config, tooling           |
| `ci`       | —            | CI workflow changes                    |

Breaking change: append `!` after the type, e.g. `feat!: drop Node 18 support` → major bump.

The CI will reject PR titles that don't match this format.

## Key quirks

- `vscode-languageserver/node.js` (with `.js` extension) is required at runtime — the package has no `exports` map, so the subpath must be explicit. TypeScript resolves it via the `paths` override in `tsconfig.json`.
- The tsconfig uses `rewriteRelativeImportExtensions: true` so source imports use `.ts` extensions (for Node native TS support) and the compiled output gets them rewritten to `.js`.
- The `bin` entry points directly at `src/server.ts`; the shebang `#!/usr/bin/env node` at the top of `server.ts` makes it executable via Node's native TS support.
- The VSCode extension wrapper lives in `editors/vscode/` and resolves `xq-lsp` from its local `node_modules` via `require.resolve`.
