<img src="./logo.svg" alt="xq-lsp" width="48" height="48">

# xq-lsp

Language Server Protocol implementation for XQuery, providing autocompletion, hover documentation, signature help, go-to-definition, and diagnostics.

## Features

- **Syntax highlighting** — keywords, types, variables, operators, comments, and XQuery 4.0 tokens (VS Code extension)
- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors, undeclared namespace prefixes, type mismatches, and unused symbols

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

Modules that require explicit import even in eXist-db (e.g. `datetime`,
`httpclient`, `console`, `crypto`, `kwic`) still need a `import module
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

## Configuration: XQuery 4.0

Set `xqueryVersion` to `"4.0"` in your `lsp-config.xq` to enable the XQuery 4.0 parser and the
XQ4 built-in function library (`fn:foot`, `fn:trunk`, `fn:sort-by`, `array:members`, etc.):

```xquery
map { "xqueryVersion": "4.0" }
```

Default is `"3.1"`.

## Roadmap

- **Completion of keywords** — like `function`, `declare` and `ancestor-or-self`, which saves you
  some keystrokes
- **Context-depending completion** — which prevent syntactical errors
- **Treesitter parser** — should improve performance and scalability for huge files
- **Arity checks** — report when one calls `fn:document('too', 'many', 'arguments')`
- **Register or discover known prefix/namespace combinations** — if you have the `tei` namespace
  declared in another file, you might mean that when you type `tei:TEI` in another file
- **Context items** — doing `declare function xx () { bla };` is an error: there is no context
  item. Check if there is a context item available when you use the context item expression (`.`) or
  a step expression.
- **Unused functions and variables** — no one likes those. Except when prefixed with `_`, then they
  make sense
- More of the (static) errors in the spec at [The spec at section F Error
  Conditions](https://www.w3.org/TR/xquery-31/#id-errors), whichever are easy to implement

### XQuery 4.0 roadmap

The XQ4 parser is supported (enable with `xqueryVersion: "4.0"` in config). The following XQ4
features are parsed but not yet checked:

- **Choice item types** ([XQ4 §2.5.6](https://qt4cg.org/specifications/xquery-40/xquery-40.html#dt-choice-item-type))
  — union types written as `(T1 | T2)` in a `SequenceType`. The parser accepts them; the type
  checker treats the result as unknown rather than checking assignability against each branch.
- **Enumeration types** ([XQ4 §2.5.7](https://qt4cg.org/specifications/xquery-40/xquery-40.html#dt-enumeration-type))
  — `enum("a", "b", "c")` constraining a `xs:string`. Parsed but not reflected in type inference.
- **Record types** ([XQ4 §2.5.8](https://qt4cg.org/specifications/xquery-40/xquery-40.html#dt-record-type))
  — `record(field as type, ...)` and `record(field as type, *, ...)` (extensible). Parsed; field
  access is not type-checked.
- **Coercion rules for typed variable declarations** ([XQ4 §2.3.1](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-variables))
  — XQ4 allows `let $x as T := expr` and `for $x as T in expr`; the declared type is parsed but
  coercion/narrowing is not applied to the inferred type of `$x`.
- **Default parameter values** ([XQ4 §4.15](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-function-decl))
  — `declare function f($x as T := expr)`. Arity checking already accounts for optional parameters
  via `minArity`; however, the type of the default expression is not checked against the declared
  parameter type.
- **`while` clause in FLWOR expressions** ([XQ4 §3.12.3](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-while-clause))
  — the `while` clause is parsed; the condition is not type-checked for `xs:boolean` conformance.
- **`otherwise` operator** ([XQ4 §3.9](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-otherwise))
  — `expr otherwise expr` is parsed; the result type is not inferred.
- **Thin arrow `->` (OtherApplyExpr)** ([XQ4 §3.7.3](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-arrow-operator))
  — `$map->key` shorthand for map/array lookup. Parsed; arity and return-type checking not yet
  implemented.
- **Named (keyword) parameters** ([XQ4 §3.1.6](https://qt4cg.org/specifications/xquery-40/xquery-40.html#id-named-function-arguments))
  — `f(param: value)` syntax. Parsed; no check that the parameter name exists or that the arity
  matches after resolving named arguments.
- **JSON / jnode item types** ([XQ4 §2.5.9](https://qt4cg.org/specifications/xquery-40/xquery-40.html#dt-jnode-test))
  — `map(*)`, `array(*)`, and richer jnode tests. Parsed; not reflected in type inference.

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
