# xq-lsp

Language Server Protocol implementation for XQuery, providing autocompletion, hover documentation, signature help, go-to-definition, and diagnostics.

## Features

- **Completion** — functions declared in the current file, imported modules, and variables in scope
- **Hover** — function signatures on hover
- **Signature help** — active parameter hints inside function calls
- **Go to definition** — jump to function or variable declarations, including across imported files
- **Document symbols** — file outline of all declared functions and variables
- **Diagnostics** — syntax errors as you type

Imports written as `import module namespace prefix="uri" at "./other-file.xq"` are followed automatically; symbols from imported files are included in completions.

For files with syntax errors (common while editing), the server falls back to regex-based extraction so completions keep working.

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

```sh
cd editors/vscode
npm install
```

Open the `editors/vscode` folder in VS Code and press `F5` to launch a development host with the extension active. To install it permanently, package it with [`vsce`](https://github.com/microsoft/vscode-vsce):

```sh
npx vsce package
code --install-extension xquery-lsp-vscode-*.vsix
```

The extension registers `.xq`, `.xql`, `.xqm`, and `.xqy` files as XQuery and starts `xq-lsp` automatically when you open one.
