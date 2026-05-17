module namespace fonto="http://www.fontoxml.com/functions";

(:~
 : Returns the closest common ancestor node of the current editor selection.
 : @see https://documentation.fontoxml.com/latest/fonto-selection-common-ancestor-bc3ca1b4b8ef
 :)
declare function fonto:selection-common-ancestor() as node()? external;

(:~
 : Serializes an XML node as a JsonML string.
 : @param $node The node to serialize.
 : @see https://documentation.fontoxml.com/latest/fonto-serialize-as-jsonml-a1d656f6c5ca
 :)
declare function fonto:serialize-as-jsonml($node as node()) as xs:string external;

(:~
 : Returns the hierarchy node ID of the document currently open in the editor.
 : @see https://documentation.fontoxml.com/latest/fonto-current-hierarchy-node-id-e69ed148e068
 :)
declare function fonto:current-hierarchy-node-id() as xs:string? external;

(:~
 : Returns the column index (1-based) of a table cell, taking column spans into account.
 : @param $cell The table cell node.
 : @see https://documentation.fontoxml.com/latest/xpath-b79c646b1933
 :)
declare function fonto:get-column-index($cell as node()) as xs:integer external;

(:~
 : Returns true when the editor is on a review route or in Document History mode.
 : @see https://documentation.fontoxml.com/latest/xpath-b79c646b1933
 :)
declare function fonto:is-on-review-route() as xs:boolean external;

(:~
 : Returns true when the editor is in suggestion mode.
 : @see https://documentation.fontoxml.com/latest/fonto-8-15-0-december-18-2025-e1384921fbde
 :)
declare function fonto:is-in-suggestion-mode() as xs:boolean external;

(:~
 : Returns true if the given node belongs to the specified DITA class.
 : @param $node The node to test.
 : @param $class The DITA class string, e.g. "topic/p".
 : @see https://documentation.fontoxml.com/latest/fonto-dita-class-9dd8240eb51f
 :)
declare function fonto:dita-class($node as node(), $class as xs:string) as xs:boolean external;

(:~
 : Returns the markup label configured for the given node.
 : @param $node The node whose markup label to retrieve.
 : @see https://documentation.fontoxml.com/latest/fonto-markup-label-94d77791388a
 :)
declare function fonto:markup-label($node as node()) as xs:string? external;

(:~
 : Returns the block layout mode configured for the given node.
 : @param $node The node to inspect.
 : @see https://documentation.fontoxml.com/latest/fonto-block-layout-63c8bd99d28a
 :)
declare function fonto:block-layout($node as node()) as xs:string? external;

(:~
 : Returns true if the given node is expected to be rendered in inline layout.
 : @param $node The node to inspect.
 : @see https://documentation.fontoxml.com/api/latest/fonto-in-inline-layout-33443053.html
 :)
declare function fonto:in-inline-layout($node as node()) as xs:boolean external;

(:~
 : Returns a plain-text representation of a node, respecting configuration such as footnotes.
 : @param $node The node to extract text from.
 : @see https://documentation.fontoxml.com/latest/xpath-b79c646b1933
 :)
declare function fonto:curated-text-in-node($node as node()) as xs:string external;

(:~
 : Returns true if the document for the given hierarchy node ID has finished loading.
 : @param $hierarchyNodeId The hierarchy node ID of the document.
 : @see https://documentation.fontoxml.com/latest/fonto-document-fb5c19e1ad6d
 :)
declare function fonto:is-document-loaded($hierarchyNodeId as xs:string) as xs:boolean external;

(:~
 : Returns true if the document for the given hierarchy node ID errored while loading.
 : @param $hierarchyNodeId The hierarchy node ID of the document.
 : @see https://documentation.fontoxml.com/latest/fonto-document-fb5c19e1ad6d
 :)
declare function fonto:is-document-errored($hierarchyNodeId as xs:string) as xs:boolean external;

(:~
 : Returns the document node for the given hierarchy node ID, or the empty sequence if not loaded.
 : @param $hierarchyNodeId The hierarchy node ID of the document.
 : @see https://documentation.fontoxml.com/latest/fonto-document-fb5c19e1ad6d
 :)
declare function fonto:document($hierarchyNodeId as xs:string) as document-node()? external;

(:~
 : Resolves a permanent ID to the node it identifies, or the empty sequence if unresolvable.
 : @param $permanentId The permanent ID string.
 : @see https://documentation.fontoxml.com/latest/xpath-b79c646b1933
 :)
declare function fonto:resolve-permanent-id($permanentId as xs:string) as node()? external;
