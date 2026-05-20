# xq-lsp

Language Server Protocol implementation for XQuery, providing autocompletion, hover documentation, signature help, go-to-definition, and diagnostics.

## Features

- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors as you type

## Configuration

Place an `lsp-config.xq` file in your project root to enable glob-based import resolution. The server walks up from the current file's directory to find it.

The file contains an XPath 3.1 map expression with a `glob` key:

```xquery
map { "glob": "src/**/*.xq" }
```

Multiple patterns are written as an XPath sequence:

```xquery
map { "glob": ("src/**/*.xq", "lib/**/*.xq") }
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

| Value | Runtime |
|-------|---------|
| `"fonto"` | [Fonto XML editor](https://www.fontoxml.com/) — `fonto:*` functions |

```xquery
map { "glob": "src/**/*.xq", "lib": "fonto" }
```

Then import the namespace in your XQuery files as usual — the server resolves completions, hover, and go-to-definition against the bundled definitions:

```xquery
import module namespace fonto="http://www.fontoxml.com/functions";
```

Multiple libs use an XPath sequence:

```xquery
map { "glob": "src/**/*.xq", "lib": ("fonto", "other") }
```

## Roadmap

- **Completion of keywords** — like `function`, `declare` and `ancestor-or-self`, which saves you
  some keystrokes
- **Context-depending completion** — which prevent syntactical errors
- **Treesitter parser** — should improve performance and scalability for huge files
- **XQuery 4** — the parser already supports this. Just make it work
- **Arity checks** — report when one calls `fn:document('too', 'many', 'arguments')`
- **Register or discover known prefix/namespace combinations** — if you have the `tei` namespace
  declared in another file, you might mean that when you type `tei:TEI` in another file
- **Context items** — doing `declare function xx () { bla };` is an error: there is no context
  item. Check if there is a context item available when you use the context item expression (`.`) or
  a step expression.
- More of the (static) errors in the spec at [The spec at section F Error Conditions](https://www.w3.org/TR/xquery-31/#id-errors), whichever are easy to implement


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

| Action | Key |
|---|---|
| Completion | `C-M-i` |
| Hover / docs | `C-c C-d` |
| Signature help | automatic in minibuffer |
| Go to definition | `M-.` |
| Go back | `M-,` |
| Document symbols | `M-x imenu` |
| Diagnostics | `M-x flymake-show-buffer-diagnostics` |

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

The extension registers `.xq`, `.xql`, `.xqm`, and `.xqy` files as XQuery and starts `xq-lsp` automatically when you open one.
