<img src="./logo.svg" alt="xq-lsp" width="48" height="48">

# xq-lsp

Language Server Protocol implementation for XQuery, providing autocompletion, hover documentation, signature help, go-to-definition, and diagnostics — plus an eslint-style command-line linter (`xq-lsp lint`).

## Features

- **Syntax highlighting** — keywords, types, variables, operators, comments, and XQuery 4.0 tokens (VS Code extension)
- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors, undeclared namespace prefixes, type mismatches, and unused symbols — pushed on change, and also available on request via LSP 3.17 pull diagnostics (`textDocument/diagnostic`), including for files that are not open
- **Command-line linting** — `xq-lsp lint` runs the same diagnostics over files, directories, and globs from the shell, with eslint-style output and exit codes, for CI

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

The file contains an XPath 3.1 map expression with a `glob` key:

```xquery
map {"glob": "src/**/*.xq"}
```

Multiple patterns are written as an XPath sequence:

```xquery
map {"glob": ("src/**/*.xq", "lib/**/*.xq")}
```

The server expands the globs, analyzes each matched file, and indexes library modules by their declared namespace URI. Imports written without an `at` clause are then resolved by matching the namespace URI:

```xquery
(: no "at" path needed — the server finds the file via the glob index :)
import module namespace util="http://example.com/util";
```

Imports written as `import module namespace prefix="uri" at "./other-file.xq"` are followed
automatically; symbols from imported files are included in completions.

For files with syntax errors (common while editing), the server falls back to regex-based extraction so completions keep working.

### Runtime built-ins

Use the `lib` key to load built-in definitions for a specific runtime:

| Value       | Runtime                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `"fonto"`   | [Fonto XML editor](https://www.fontoxml.com/) — `fonto:*` functions       |
| `"existdb"` | [eXist-db](https://exist-db.org/) — all extension module functions        |

```xquery
map {"glob": "src/**/*.xq", "lib": "existdb"}
```

Multiple libs use an XPath sequence:

```xquery
map {"glob": "src/**/*.xq", "lib": ("fonto", "other")}
```

#### eXist-db runtime

The `"existdb"` runtime bundles stub definitions for every eXist-db extension
module (`util`, `xmldb`, `request`, `sm`, `ft`, `compression`, …).

eXist-db automatically pre-declares a large set of namespace prefixes — you can
call `util:log(…)`, `xmldb:store(…)`, `process:execute(…)`, etc. without any
`import module namespace` statement. When the `existdb` runtime is active the
server knows about these pre-declared prefixes and:

- **suppresses** false `XQST0081` ("namespace prefix not declared") diagnostics
  for all pre-declared namespaces
- **provides completions, hover, and go-to-definition** for those modules
  without requiring an explicit `import module namespace` in your source

If you do choose to write explicit imports (e.g. for editor portability), the
server handles those correctly too:

```xquery
(: explicit import — also fine :)
import module namespace util = "http://exist-db.org/xquery/util";
util:uuid()
```

Modules that require explicit import even in eXist-db (e.g. `console`, `kwic`) still need a `import module
namespace` declaration; the server offers quick-fix code actions to insert it.

```xquery
(: lsp-config.xq in your project root :)
map {
    "glob": "src/**/*.xq",
    "lib": "existdb",
    "import": map {
        "generateLocationHints": false()
    }
}
```

The `generateLocationHints: false()` setting prevents the server from appending
`at "…"` paths to generated imports, which eXist-db does not need (it resolves
modules by namespace URI).

#### Fonto runtime

Then import the namespace in your XQuery files as usual — the server resolves completions, hover, and go-to-definition against the bundled definitions:

```xquery
import module namespace fonto="http://www.fontoxml.com/functions";
```

### Location hints

Some runtimes do not like location hints (`import namespace prefix="uri" at "Location hint";`), turn
them off to prevent them from being generated:

```xquery
map {
	'import': map {
		'generateLocationHints': false()
	}
}
```

### Strict mode

By default the type checker only reports *certain* static type errors. Some
mistakes are only dynamic errors (XPTY0004) that a static analyzer cannot prove —
for example passing a value of type `item()*` to a parameter declared `as item()`:
the sequence may have length 0 or 2 at runtime. Opt in to stricter checking with
the `strict` map to get these reported as **warnings**:

```xquery
map {
	"glob": "src/**/*.xq",
	"strict": map {
		"cardinality": true()
	}
}
```

With `"cardinality": true()`, an argument whose inferred cardinality is not
guaranteed to fit the parameter's occurrence indicator is flagged as a warning
(still with code `XPTY0004`). For example, passing `item()*` where `item()` is
expected, or `item()?` where `item()+` is expected. The check respects narrowing:
inside `if (exists($x)) then …` a variable of type `item()*` is treated as
`item()+`.

## Command-line linting

The same binary ships an eslint-style linter, `xq-lsp lint`, for use in CI or from
the shell — no editor required:

```sh
xq-lsp lint src/                       # lint a directory recursively
xq-lsp lint "src/**/*.xq"              # lint a glob
xq-lsp lint ./somewhere/something.xq   # lint a single file
xq-lsp lint src/ --max-warnings 0      # fail on warnings too (CI)
```

With no arguments, the current directory is linted. Directories are searched
recursively for `.xq`, `.xqm`, `.xql`, and `.xquery` files.

The linter runs the exact same diagnostics as the editor — syntax errors,
undeclared variables and namespace prefixes, type errors, and unresolved imports —
plus hint-level checks like unused symbols. It finds the nearest `lsp-config.xq`
per file, so the same configuration (glob index, `lib` runtimes, `strict` mode,
`prefixes`) applies as in the editor. Use `--config` to pin a specific config file:

```sh
xq-lsp lint src/ --config ./ci/lsp-config.xq
```

Output uses eslint's `stylish` format by default; `-f json` and `-f compact` are
available for machine consumption, and `--no-color` (or the `NO_COLOR` environment
variable) disables colors:

```
src/bad.xq
  1:1  error  Variable '$undeclared' is not declared  XPST0008

✖ 1 problem (1 error)
```

Exit codes, like eslint: `0` when clean, `1` when errors are found (or when
warnings exceed `--max-warnings <n>`), and `2` on fatal errors (bad arguments, no
files matched, unreadable file or config). Hints (unused symbols, redundant
namespace declarations, …) are reported but never affect the exit code;
`--quiet` reports errors only.

Install with `npm install -g xq-lsp`, or run it without installing via
`npx xq-lsp lint`.

## Roadmap

- **Completion of keywords** — like `function`, `declare` and `ancestor-or-self`, which saves you
  some keystrokes
- **Context-depending completion** — which prevent syntactical errors
- **Treesitter parser** — should improve performance and scalability for huge files
- **XQuery 4** — the parser already supports this. Just make it work
- More of the (static) errors in the spec at [The spec at section F Error
  Conditions](https://www.w3.org/TR/xquery-31/#id-errors), whichever are easy to implement

## Emacs

### With eglot (built-in since Emacs 29)

Install `xquery-mode` from MELPA:

```
M-x package-install RET xquery-mode RET
```

Add to your `init.el`:

```elisp
(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               '(xquery-mode . ("npx" "xq-lsp" "--stdio"))))

(add-hook 'xquery-mode-hook #'eglot-ensure)
```

Open any `.xq` file and eglot starts the server automatically. Run `M-x eglot` to start it manually.

**Key bindings:**

| Action           | Key                                   |
| ---------------- | ------------------------------------- |
| Completion       | `C-M-i`                               |
| Hover / docs     | `C-c C-d`                             |
| Signature help   | automatic in minibuffer               |
| Go to definition | `M-.`                                 |
| Go back          | `M-,`                                 |
| Document symbols | `M-x imenu`                           |
| Diagnostics      | `M-x flymake-show-buffer-diagnostics` |

**Inlay hints** (inferred types after untyped `let`/`for`/`declare variable` names, and
parameter names before call arguments) are shown by `eglot-inlay-hints-mode`, which eglot
turns on automatically since Emacs 29.1. If they don't appear, check that `:inlayHintProvider`
isn't listed in `eglot-ignored-server-capabilities`, or toggle them with
`M-x eglot-inlay-hints-mode`.

### With lsp-mode

```elisp
(with-eval-after-load 'lsp-mode
  (add-to-list 'lsp-language-id-configuration '(xquery-mode . "xquery"))

  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection '("npx" "xq-lsp" "--stdio"))
    :major-modes '(xquery-mode)
    :language-id "xquery"
    :server-id 'xquery-lsp)))

(add-hook 'xquery-mode-hook #'lsp)
```

lsp-mode does not show inlay hints unless asked to:

```elisp
(setq lsp-inlay-hint-enable t)
```

The reference counts above each function and module variable are code lenses; lsp-mode shows
them by default (`lsp-lens-enable`). Eglot does not support code lenses.

## VS Code

A minimal VS Code extension lives in [`editors/vscode/`](./editors/vscode/).

### Install from marketplace

Launch VS Code Quick Open (Ctrl+P or Cmd+P), paste the following command, and press enter.

```
ext install elliat.xquery-lsp-vscode
```

### Install by hand

```sh
cd editors/vscode
npm install
```

Open the `editors/vscode` folder in VS Code and press `F5` to launch a development host with the
extension active. To install it permanently, package it with
[`vsce`](https://github.com/microsoft/vscode-vsce):

```sh
npx vsce package
code --install-extension xquery-lsp-vscode-*.vsix
```

The extension registers `.xq`, `.xql`, `.xqm`, `.xqy`, and `.xquery` files as XQuery, provides syntax highlighting via a bundled TextMate grammar, and starts `xq-lsp` automatically when you open one.

## Claude Code

A plugin lives in [`editors/claude-code/`](./editors/claude-code/) that registers `xq-lsp` as a native LSP server for Claude Code, giving diagnostics, go-to-definition, find-references, and hover for XQuery files.

Make sure the `xq-lsp` binary is on `PATH`:

```sh
npm install -g xq-lsp
```

Then, from within Claude Code:

```
/plugin marketplace add DrRataplan/xq-lsp
/plugin install xquery-lsp@xq-lsp
```

See [`editors/claude-code/README.md`](./editors/claude-code/README.md) for local-development setup and details on what the plugin configures.
