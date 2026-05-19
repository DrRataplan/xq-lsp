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

## Architecture

The server is a standard LSP over stdio. `src/server.ts` is the entry point and wires together all features using `vscode-languageserver`.

**Two-phase parsing** is the central design: `src/analyzer.ts` first tries `XQuery31Full()` from `xq-parser`. If it throws (file is mid-edit and syntactically invalid), it falls back to regex extraction. Both paths produce the same `FileAnalysis` shape (`src/types.ts`).

**`FileAnalysis`** (`src/types.ts`) — the shared data structure passed everywhere:
- `functions` — declared functions with name, prefix, localName, arity, params, returnType, sourceOffset
- `moduleVariables` — `declare variable` declarations
- `localBindings` — `let`/`for` bindings (scope-approximated: visible from their offset onward)
- `imports` — `import module namespace prefix="uri" at "path"` declarations

**Import resolution** happens in `server.ts`: when handling any request, it resolves each `ImportInfo.atPath` relative to the current file URI, loads and analyzes the imported file (cached by URI), and passes the resulting `Map<atPath, FileAnalysis>` to feature handlers. Imported file symbols are included in completions/hover/go-to-definition.

**Feature handlers** (`src/completion.ts`, `src/features.ts`) take `(currentAnalysis, importedAnalyses)` and are pure functions — no server state. Completion context is determined by scanning text before the cursor for `$`, `ns:`, or plain names. Snippet format is only used when the client advertises `snippetSupport`.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) because release-please reads commit messages to determine version bumps and generate changelogs. PRs are squash-merged, so **the PR title is the commit message** — make it conformant.

Format: `<type>[optional scope]: <description>`

| Type | Version bump | When to use |
|------|-------------|-------------|
| `feat` | minor | New user-visible capability |
| `fix` | patch | Bug fix |
| `perf` | patch | Performance improvement |
| `docs` | — | Documentation only |
| `refactor` | — | Code restructuring, no behavior change |
| `test` | — | Adding or fixing tests |
| `chore` | — | Build, deps, config, tooling |
| `ci` | — | CI workflow changes |

Breaking change: append `!` after the type, e.g. `feat!: drop Node 18 support` → major bump.

The CI will reject PR titles that don't match this format.

## Key quirks

- `vscode-languageserver/node.js` (with `.js` extension) is required at runtime — the package has no `exports` map, so the subpath must be explicit. TypeScript resolves it via the `paths` override in `tsconfig.json`.
- The tsconfig uses `rewriteRelativeImportExtensions: true` so source imports use `.ts` extensions (for Node native TS support) and the compiled output gets them rewritten to `.js`.
- The `bin` entry points directly at `src/server.ts`; the shebang `#!/usr/bin/env node` at the top of `server.ts` makes it executable via Node's native TS support.
- The VSCode extension wrapper lives in `editors/vscode/` and resolves `xq-lsp` from its local `node_modules` via `require.resolve`.
