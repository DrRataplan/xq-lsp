# XQuery LSP plugin for Claude Code

Gives Claude Code native language intelligence for XQuery files (`.xq`, `.xql`, `.xqm`, `.xqy`, `.xquery`), powered by [xq-lsp](https://github.com/DrRataplan/xq-lsp): diagnostics pushed after every edit, go-to-definition, find-references, and hover — instead of grep-based file exploration.

## Prerequisites

The `xq-lsp` binary must be on `PATH`:

```sh
npm install -g xq-lsp
# or, from a checkout of this repo:
npm install -g .
```

## Install

```
/plugin marketplace add DrRataplan/xq-lsp
/plugin install xquery-lsp@xq-lsp
```

For local development, add the marketplace from a checkout instead:

```
/plugin marketplace add /path/to/xquery-lsp
/plugin install xquery-lsp@xq-lsp
```

## What this configures

This plugin only wires up the LSP connection (`.lsp.json`); it does not bundle the server itself. See the [project README](../../README.md) for xq-lsp configuration (runtimes, `lsp-config.xq`, imports).
