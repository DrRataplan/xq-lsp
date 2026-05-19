# XQuery Language Server

XQuery language support for VS Code via the [xq-lsp](https://github.com/DrRataplan/xq-lsp) language server.

## Features

- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors highlighted as you type

Imports written as `import module namespace prefix="uri" at "./other-file.xq"` are followed automatically; symbols from imported files are included in completions and go-to-definition.

For files with syntax errors (common while editing), the server falls back to regex-based extraction so completions keep working.

## Supported file extensions

`.xq`, `.xql`, `.xqm`, `.xqy`

## Requirements

Node.js must be installed and available on your `PATH`.
