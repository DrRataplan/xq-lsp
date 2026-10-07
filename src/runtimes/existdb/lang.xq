module namespace lang = "http://exist-db.org/xquery/langservice";

(:~
 : Returns an array of completion item maps available in the context of the
 : given XQuery expression. Each map contains keys: label (xs:string), kind
 : (xs:integer, LSP CompletionItemKind), detail (xs:string, signature),
 : documentation (xs:string), and insertText (xs:string). Built-in functions
 : are always included; user-declared symbols are included if the expression
 : compiles successfully.
 : @param $expression The XQuery expression to analyze for available completions.
 : @return an array of completion item maps
 :)
declare function lang:completions($expression as xs:string) as array(*) external;

(:~
 : Returns an array of completion item maps available in the context of the
 : given XQuery expression. Each map contains keys: label (xs:string), kind
 : (xs:integer, LSP CompletionItemKind), detail (xs:string, signature),
 : documentation (xs:string), and insertText (xs:string). Built-in functions
 : are always included; user-declared symbols are included if the expression
 : compiles successfully.
 : @param $expression The XQuery expression to analyze for available completions.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db or /db for database-stored modules.
 : @return an array of completion item maps
 :)
declare function lang:completions($expression as xs:string, $module-load-path as xs:string?) as array(*) external;

(:~
 : Returns the definition location of the symbol at the given position. Returns
 : a map with keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : name (xs:string), kind (xs:string, "function" or "variable"), and optionally
 : uri (xs:string, source path of the module containing the definition, present
 : only for cross-module definitions). Returns an empty sequence if no
 : user-declared definition is found.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @return a definition location map, or empty sequence
 :)
declare function lang:definition($expression as xs:string, $line as xs:integer, $column as xs:integer) as map(*) external;

(:~
 : Returns the definition location of the symbol at the given position. Returns
 : a map with keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : name (xs:string), kind (xs:string, "function" or "variable"), and optionally
 : uri (xs:string, source path of the module containing the definition, present
 : only for cross-module definitions). Returns an empty sequence if no
 : user-declared definition is found.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @param $module-load-path The module load path.
 : @return a definition location map, or empty sequence
 :)
declare function lang:definition(
	$expression as xs:string,
	$line as xs:integer,
	$column as xs:integer,
	$module-load-path as xs:string?
) as map(*) external;

(:~
 : Compiles the XQuery expression and returns an array of diagnostic maps. Each
 : map contains keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : severity (xs:integer, 1=error), code (xs:string, W3C error code), and
 : message (xs:string). Returns an empty array if compilation succeeds.
 : @param $expression The XQuery expression to compile.
 : @return an array of diagnostic maps
 :)
declare function lang:diagnostics($expression as xs:string) as array(*) external;

(:~
 : Compiles the XQuery expression and returns an array of diagnostic maps. Each
 : map contains keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : severity (xs:integer, 1=error), code (xs:string, W3C error code), and
 : message (xs:string). Returns an empty array if compilation succeeds.
 : @param $expression The XQuery expression to compile.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db for database-stored modules.
 : @return an array of diagnostic maps
 :)
declare function lang:diagnostics($expression as xs:string, $module-load-path as xs:string?) as array(*) external;

(:~
 : Returns hover information for the symbol at the given position in the XQuery
 : expression, shaped like LSP's Hover: a map with one key, contents, whose
 : value is a MarkupContent map { kind: "markdown", value: "&lt;markdown>" }.
 : The Markdown body includes a fenced code block for the signature, the
 : description, a bullet list of parameters, and the return type. Returns an
 : empty sequence if no symbol is found at the position.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @return a hover info map, or empty sequence
 :)
declare function lang:hover($expression as xs:string, $line as xs:integer, $column as xs:integer) as map(*) external;

(:~
 : Returns hover information for the symbol at the given position in the XQuery
 : expression, shaped like LSP's Hover: a map with one key, contents, whose
 : value is a MarkupContent map { kind: "markdown", value: "&lt;markdown>" }.
 : The Markdown body includes a fenced code block for the signature, the
 : description, a bullet list of parameters, and the return type. Returns an
 : empty sequence if no symbol is found at the position.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @param $module-load-path The module load path.
 : @return a hover info map, or empty sequence
 :)
declare function lang:hover(
	$expression as xs:string,
	$line as xs:integer,
	$column as xs:integer,
	$module-load-path as xs:string?
) as map(*) external;

(:~
 : Finds all references to the symbol at the given position. Returns an array
 : of maps with keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : name (xs:string), and kind (xs:string, "function" or "variable"). Returns an
 : empty array if no symbol is found at the position.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @return an array of reference location maps
 :)
declare function lang:references($expression as xs:string, $line as xs:integer, $column as xs:integer) as array(*) external;

(:~
 : Finds all references to the symbol at the given position. Returns an array
 : of maps with keys: line (xs:integer, 0-based), column (xs:integer, 0-based),
 : name (xs:string), and kind (xs:string, "function" or "variable"). Returns an
 : empty array if no symbol is found at the position.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @param $module-load-path The module load path.
 : @return an array of reference location maps
 :)
declare function lang:references(
	$expression as xs:string,
	$line as xs:integer,
	$column as xs:integer,
	$module-load-path as xs:string?
) as array(*) external;

(:~
 : Returns LSP-shaped SignatureHelp for the function call surrounding the
 : cursor. Name-based and lenient: mid-typing states like "util:log(",
 : "util:log(\"info\",", and "util:log(\"info\", \"x\", " all produce help,
 : since resolution is by function name (scanned from the raw text), not by
 : requiring the partial call to parse. Returns a map with keys signatures
 : (array of SignatureInformation { label, documentation, parameters }),
 : activeSignature (xs:integer, index into signatures), and activeParameter
 : (xs:integer, 0-based index of the parameter the cursor is on, computed by
 : counting commas at the call's paren depth). Returns an empty sequence if the
 : cursor is not inside a function call's argument list.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @return a SignatureHelp map, or empty sequence
 :)
declare function lang:signature-help($expression as xs:string, $line as xs:integer, $column as xs:integer) as map(*) external;

(:~
 : Returns LSP-shaped SignatureHelp for the function call surrounding the
 : cursor. Name-based and lenient: mid-typing states like "util:log(",
 : "util:log(\"info\",", and "util:log(\"info\", \"x\", " all produce help,
 : since resolution is by function name (scanned from the raw text), not by
 : requiring the partial call to parse. Returns a map with keys signatures
 : (array of SignatureInformation { label, documentation, parameters }),
 : activeSignature (xs:integer, index into signatures), and activeParameter
 : (xs:integer, 0-based index of the parameter the cursor is on, computed by
 : counting commas at the call's paren depth). Returns an empty sequence if the
 : cursor is not inside a function call's argument list.
 : @param $expression The XQuery expression.
 : @param $line 0-based line number.
 : @param $column 0-based column number.
 : @param $module-load-path The module load path.
 : @return a SignatureHelp map, or empty sequence
 :)
declare function lang:signature-help(
	$expression as xs:string,
	$line as xs:integer,
	$column as xs:integer,
	$module-load-path as xs:string?
) as map(*) external;

(:~
 : Compiles the XQuery expression and returns an array of document symbol maps.
 : Each map contains keys: name (xs:string), kind (xs:integer, LSP SymbolKind),
 : line (xs:integer, 0-based), column (xs:integer, 0-based), and detail
 : (xs:string, type or signature info). Returns an empty array if the
 : expression cannot be compiled.
 : @param $expression The XQuery expression to analyze.
 : @return an array of document symbol maps
 :)
declare function lang:symbols($expression as xs:string) as array(*) external;

(:~
 : Compiles the XQuery expression and returns an array of document symbol maps.
 : Each map contains keys: name (xs:string), kind (xs:integer, LSP SymbolKind),
 : line (xs:integer, 0-based), column (xs:integer, 0-based), and detail
 : (xs:string, type or signature info). Returns an empty array if the
 : expression cannot be compiled.
 : @param $expression The XQuery expression to analyze.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db for database-stored modules.
 : @return an array of document symbol maps
 :)
declare function lang:symbols($expression as xs:string, $module-load-path as xs:string?) as array(*) external;
