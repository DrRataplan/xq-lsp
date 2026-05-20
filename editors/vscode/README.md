# XQuery Language Server

XQuery language support for VS Code via the [xq-lsp](https://github.com/DrRataplan/xq-lsp) language server.

## Features

- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors highlighted as you type
- **Formatting** — format XQuery files with Prettier via `Shift+Alt+F` (Format Document)

Imports written as `import module namespace prefix="uri" at "./other-file.xq"` are followed automatically; symbols from imported files are included in completions and go-to-definition.

For files with syntax errors (common while editing), the server falls back to regex-based extraction so completions keep working.

## Supported file extensions

`.xq`, `.xql`, `.xqm`, `.xqy`

## Configuration

### Summary: Fonto development

Place an `lsp-config.xq` file in the Fonto root folder (the one that holds the manifest.json) with the following content:

```xquery
map {
	'lib': 'fonto',
	'glob': 'packages/**/*.xqm',
	'import': map {
		'generateLocationHints': false()
	}
}
```
### General configuration

Place an `lsp-config.xq` file in your project root to enable glob-based import resolution. The server walks up from the current file's directory to find it.

```xquery
map {"glob": "src/**/*.xq"}
```

Multiple patterns are written as an XPath sequence:

```xquery
map {"glob": ("src/**/*.xq", "lib/**/*.xq")}
```

The server indexes all matched files by their declared namespace URI, so imports without an `at` clause resolve automatically:

```xquery
(: no "at" path needed :)
import module namespace util="http://example.com/util";
```

### Runtime built-ins

Use the `lib` key to load built-in definitions for a specific runtime:

| Value     | Runtime                                                             |
| --------- | ------------------------------------------------------------------- |
| `"fonto"` | [Fonto XML editor](https://www.fontoxml.com/) — `fonto:*` functions |

```xquery
map {"glob": "src/**/*.xq", "lib": "fonto"}
```

Then import the namespace in your XQuery files as usual — the server resolves completions, hover, and go-to-definition against the bundled definitions:

```xquery
import module namespace fonto="http://www.fontoxml.com/functions";
```

Multiple libs use an XPath sequence:

```xquery
map {"glob": "src/**/*.xq", "lib": ("fonto", "other")}
```

## Formatting

XQuery formatting is provided by [prettier-plugin-xquery](https://github.com/prettier/prettier-plugin-xquery), bundled directly in the extension. No separate install is required.

Trigger formatting with **Format Document** (`Shift+Alt+F` on Windows/Linux, `Shift+Option+F` on macOS), or enable format-on-save in your VS Code settings:

```json
"[xquery]": {
  "editor.defaultFormatter": "elliat.xquery-lsp-vscode",
  "editor.formatOnSave": true
}
```

Prettier options (print width, tab width, etc.) are read from your project's [Prettier config file](https://prettier.io/docs/configuration) if one exists.

## Requirements

Node.js must be installed and available on your `PATH`.
