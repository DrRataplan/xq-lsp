# Changelog

## [1.2.0](https://github.com/DrRataplan/xq-lsp/compare/lsp-v1.1.0...lsp-v1.2.0) (2026-05-27)


### Features

* add eXist-db function library with 30 namespaces ([6c58fb6](https://github.com/DrRataplan/xq-lsp/commit/6c58fb6f550f6a7f419d77c0e8b5d8a286840a6e))
* add XPDY0002 context-item diagnostic to playground linter ([b0384ac](https://github.com/DrRataplan/xq-lsp/commit/b0384ac287e99a7b22d59999f947e6bbb84798a2))
* config-defined prefix map and namespace prefix discovery ([#29](https://github.com/DrRataplan/xq-lsp/issues/29)) ([9f985cd](https://github.com/DrRataplan/xq-lsp/commit/9f985cd1065f92ea5956fa487208ded04f4a6328))
* detect XPDY0002 no-context-item errors in function and variable declarations ([f1a26d7](https://github.com/DrRataplan/xq-lsp/commit/f1a26d712506b9c62f5ff3e5e3ac4b680c6f6f07))
* functioncall diagnostics (XPST0017 for undeclared and wrong-arity calls) ([4089454](https://github.com/DrRataplan/xq-lsp/commit/4089454b8264e4e89f578d80c36911a979544cec))
* generate eXist-db function library from Java sources ([01d804f](https://github.com/DrRataplan/xq-lsp/commit/01d804fb4969122a6ba62f9d5ecb6f5228554e27))
* run functioncall diagnostics in the playground ([b38b7af](https://github.com/DrRataplan/xq-lsp/commit/b38b7af85796a2da711ea2ffab9b791b7f098783))
* warn about unused %private functions and variables ([dcd8586](https://github.com/DrRataplan/xq-lsp/commit/dcd8586dbbd229d3d82af979ce18a2dd603cacc3))


### Bug Fixes

* add fn:serialize to builtins to eliminate XPST0017 false positives ([5fd0efd](https://github.com/DrRataplan/xq-lsp/commit/5fd0efd577936449539fc0594a25373aa3afbbb2))
* add missing XQ3.0/3.1 built-in fn declarations to eliminate false-positive XPST0017 diagnostics ([5ca5086](https://github.com/DrRataplan/xq-lsp/commit/5ca5086758f1904fe5a50f5f337679ec58a53a0e))
* allow xs:anyURI to promote to xs:string in function calls ([b39f429](https://github.com/DrRataplan/xq-lsp/commit/b39f42936299369b69aa6e86abbc3ba98f5af6c5))
* check xs: constructors, NamedFunctionRef, and arrow arity for XPST0017 ([d2f070d](https://github.com/DrRataplan/xq-lsp/commit/d2f070d3794dc4039912f3a32e1c3b7eb543eb1a))
* collect inline xmlns: namespace declarations from element constructors ([08514ac](https://github.com/DrRataplan/xq-lsp/commit/08514acfffe0a473e4d0f4f30a791a5aecc9a83b))
* collect inline xmlns: namespace declarations from element constructors ([a662da3](https://github.com/DrRataplan/xq-lsp/commit/a662da32a1c5c4e76a93abd1b34c4ee07986717d))
* don't flag node→atomic as XPTY0004 in function call args (atomization applies) ([ce7af5c](https://github.com/DrRataplan/xq-lsp/commit/ce7af5c453e80deafa4f9e091258dca8c7d2e639))
* eliminate XQST0081 false positives from QT4 environment namespaces ([8e96f92](https://github.com/DrRataplan/xq-lsp/commit/8e96f9219488a15d213ae27a696b41b76e52915c))
* hover now resolves function overload by arity ([#25](https://github.com/DrRataplan/xq-lsp/issues/25)) ([5b82368](https://github.com/DrRataplan/xq-lsp/commit/5b82368503bfaba0b83a649519c9543743d3f0f8))
* infer UNKNOWN for partial function applications in type checker ([8b3f543](https://github.com/DrRataplan/xq-lsp/commit/8b3f543194f1c6ad22aabc56ea444d54a8b05095))
* reduce XPTY0004 false positives in type checker ([f1f7b9e](https://github.com/DrRataplan/xq-lsp/commit/f1f7b9e461e54d64cee9f63c150e31c3c71f150e))
* scope-aware type checking for function params and bindings ([#24](https://github.com/DrRataplan/xq-lsp/issues/24)) ([6bfd4e6](https://github.com/DrRataplan/xq-lsp/commit/6bfd4e6ec6c2e2a6e537a93e658e9ade2086c89a))
* suppress atomic-to-atomic XPTY0004 checks (implicit conversions) ([f7f8ff3](https://github.com/DrRataplan/xq-lsp/commit/f7f8ff32f24057059c463c2a93a30c6028283549))

## [1.1.0](https://github.com/DrRataplan/xq-lsp/compare/lsp-v1.0.1...lsp-v1.1.0) (2026-05-20)


### Features

* add Fonto runtime definitions ([#5](https://github.com/DrRataplan/xq-lsp/issues/5)) ([e0af427](https://github.com/DrRataplan/xq-lsp/commit/e0af427641e4cb64374d7befcaa13c19c33dba6f))
* add hover tooltips and config panel to playground ([#18](https://github.com/DrRataplan/xq-lsp/issues/18)) ([d9210ab](https://github.com/DrRataplan/xq-lsp/commit/d9210ab851578994167b53e17755124c1e5c7bbc))
* diagnose undeclared namespace prefixes and offer auto-import code actions ([#12](https://github.com/DrRataplan/xq-lsp/issues/12)) ([0439bbe](https://github.com/DrRataplan/xq-lsp/commit/0439bbe065eaca6aab63c7d178190602f27ae456))
* type-check call-site arguments and unify symbol identity as QName ([#10](https://github.com/DrRataplan/xq-lsp/issues/10)) ([50d9fa1](https://github.com/DrRataplan/xq-lsp/commit/50d9fa15a929c14de0a3f843b7afed469ce5948b))


### Bug Fixes

* allow numeric type promotion for xs:double and xs:float params ([#17](https://github.com/DrRataplan/xq-lsp/issues/17)) ([33a129c](https://github.com/DrRataplan/xq-lsp/commit/33a129cd7d8d51b559afb05256069be2c8d98c2a))

## [1.0.1](https://github.com/DrRataplan/xq-lsp/compare/lsp-v1.0.0...lsp-v1.0.1) (2026-05-19)

### Bug Fixes

- **publish:** make the extension publishable ([31bd687](https://github.com/DrRataplan/xq-lsp/commit/31bd687f33f454b7151d9136f4623259e9eabb1d))
- **vscode:** add README explaining inner workings ([c278b6c](https://github.com/DrRataplan/xq-lsp/commit/c278b6c7fa16e217c6f19d563dfaa87502f1ed7b))
