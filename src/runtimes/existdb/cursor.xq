module namespace cursor = "http://exist-db.org/xquery/cursor";

(:~
 : Closes a server-side cursor created by cursor:eval(), releasing the held
 : result sequence. Returns true if the cursor was found and removed, false if
 : it had already expired.
 : @param $cursor The cursor ID to close.
 : @return true if cursor was closed, false if not found
 :)
declare function cursor:close($cursor as xs:string) as xs:boolean external;

(:~
 : Evaluates an XQuery expression and stores the result in a server-side
 : cursor. Returns a map with keys: cursor (xs:string, cursor ID for
 : cursor:fetch/cursor:close), items (xs:integer, total result count), and
 : elapsed (xs:integer, execution time in ms). The cursor holds live node
 : references and expires after 5 minutes of inactivity.
 : @param $expression The XQuery expression to evaluate.
 : @return a map with cursor ID, item count, and elapsed time
 :)
declare function cursor:eval($expression as xs:string) as map(*) external;

(:~
 : Evaluates an XQuery expression and stores the result in a server-side
 : cursor. Returns a map with keys: cursor (xs:string, cursor ID for
 : cursor:fetch/cursor:close), items (xs:integer, total result count), and
 : elapsed (xs:integer, execution time in ms). The cursor holds live node
 : references and expires after 5 minutes of inactivity.
 : @param $expression The XQuery expression to evaluate.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db or /db for database-stored modules.
 : @return a map with cursor ID, item count, and elapsed time
 :)
declare function cursor:eval($expression as xs:string, $module-load-path as xs:string?) as map(*) external;

(:~
 : Evaluates an XQuery expression and stores the result in a server-side
 : cursor. Returns a map with keys: cursor (xs:string, cursor ID for
 : cursor:fetch/cursor:close), items (xs:integer, total result count), and
 : elapsed (xs:integer, execution time in ms). The cursor holds live node
 : references and expires after 5 minutes of inactivity.
 : @param $expression The XQuery expression to evaluate.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db or /db for database-stored modules.
 : @param $context-item The context item against which the expression will be evaluated. Use this when running a context-dependent expression (e.g. `//foo`, `.`, `count(//x)`) against a specific document — typically the document an editor client currently has open. When absent, the expression sees no context item.
 : @return a map with cursor ID, item count, and elapsed time
 :)
declare function cursor:eval($expression as xs:string, $module-load-path as xs:string?, $context-item as item()?) as map(*) external;

(:~
 : Evaluates an XQuery expression and stores the result in a server-side
 : cursor. Returns a map with keys: cursor (xs:string, cursor ID for
 : cursor:fetch/cursor:close), items (xs:integer, total result count), and
 : elapsed (xs:integer, execution time in ms). The cursor holds live node
 : references and expires after 5 minutes of inactivity.
 : @param $expression The XQuery expression to evaluate.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db or /db for database-stored modules.
 : @param $context-item The context item against which the expression will be evaluated. When absent, the expression sees no context item.
 : @param $variables External-variable bindings. Each entry's key is a variable's local name (no namespace); its value is bound to the matching `declare variable $name external;` in the expression, with the declared type enforced strictly. Keys with no matching external declaration are ignored.
 : @return a map with cursor ID, item count, and elapsed time
 :)
declare function cursor:eval(
	$expression as xs:string,
	$module-load-path as xs:string?,
	$context-item as item()?,
	$variables as map(*)?
) as map(*) external;

(:~
 : Retrieves a page of results from a cursor created by cursor:eval(). Only the
 : requested items are serialized; the rest remain as live references. Returns
 : an array of maps with keys: value (xs:string, serialized item), type
 : (xs:string, XDM type), documentURI (xs:string, source document path or ""),
 : and nodeId (xs:string, internal node ID or ""). An optional 4th argument
 : accepts a map of W3C serialization parameters (e.g., map { "method": "xml",
 : "indent": "no" }). Defaults to method=adaptive, indent=yes.
 : @param $cursor The cursor ID returned by cursor:eval().
 : @param $start 1-based start position.
 : @param $count Number of items to retrieve.
 : @return an array of result item maps
 :)
declare function cursor:fetch($cursor as xs:string, $start as xs:integer, $count as xs:integer) as array(*) external;

(:~
 : Retrieves a page of results from a cursor created by cursor:eval(). Only the
 : requested items are serialized; the rest remain as live references. Returns
 : an array of maps with keys: value (xs:string, serialized item), type
 : (xs:string, XDM type), documentURI (xs:string, source document path or ""),
 : and nodeId (xs:string, internal node ID or ""). An optional 4th argument
 : accepts a map of W3C serialization parameters (e.g., map { "method": "xml",
 : "indent": "no" }). Defaults to method=adaptive, indent=yes.
 : @param $cursor The cursor ID returned by cursor:eval().
 : @param $start 1-based start position.
 : @param $count Number of items to retrieve.
 : @param $serialization Serialization parameters map. Supports all W3C serialization parameters: method, indent, omit-xml-declaration, encoding, media-type, item-separator, etc. Also supports eXist-specific: highlight-matches (boolean). Defaults: method=adaptive, indent=yes.
 : @return an array of result item maps
 :)
declare function cursor:fetch(
	$cursor as xs:string,
	$start as xs:integer,
	$count as xs:integer,
	$serialization as map(*)
) as array(*) external;
