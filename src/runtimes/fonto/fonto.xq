module namespace fonto = "http://www.fontoxml.com/functions";

(:~
 : Returns the common ancestor node of the current editor selection.
 : @see https://documentation.fontoxml.com/latest/fonto-selection-common-ancestor-bc3ca1b4b8ef
 :)
declare function fonto:selection-common-ancestor() as node()? external;

(:~
 : Returns true if both edges of the global selection are within the given node or its descendants.
 : @param $node The node to test.
 : @see https://documentation.fontoxml.com/latest/fonto-selection-in-node-85e16ee4b6be
 :)
declare function fonto:selection-in-node($node as node()) as xs:boolean external;

(:~
 : Serializes a node as JsonML. Returns xs:string for text nodes, array() for other node types.
 : @param $node The node to serialize.
 : @see https://documentation.fontoxml.com/latest/fonto-serialize-as-jsonml-a1d656f6c5ca
 :)
declare function fonto:serialize-as-jsonml($node as node()) as item() external;

(:~
 : Returns the current hierarchy node ID, as set via the currentHierarchyNodeId option on evaluateXPath.
 : May return the empty sequence in Hooks or mutations where all hierarchy nodes are considered current.
 : @see https://documentation.fontoxml.com/latest/fonto-current-hierarchy-node-id-e69ed148e068
 :)
declare function fonto:current-hierarchy-node-id() as xs:string? external;

(:~
 : Returns the column index of a table cell. Returns the empty sequence if the node is not a cell.
 : @param $node The table cell node.
 : @see https://documentation.fontoxml.com/latest/fonto-get-column-index-ec839ee74c89
 :)
declare function fonto:get-column-index($node as node()) as xs:integer? external;

(:~
 : Returns true when the review route is open, false otherwise.
 : @see https://documentation.fontoxml.com/latest/fonto-is-on-review-route-e29d1a0ba87f
 :)
declare function fonto:is-on-review-route() as xs:boolean external;

(:~
 : Returns true if the application is on the editor route and suggestion mode is active, false otherwise.
 : @see https://documentation.fontoxml.com/latest/fonto-is-in-suggestion-mode-8aac7e957513
 :)
declare function fonto:is-in-suggestion-mode() as xs:boolean external;

(:~
 : Returns true if the given node is configured as removed.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-removed-a1bfbc4d67e7
 :)
declare function fonto:is-removed($node as node()) as xs:boolean external;

(:~
 : Returns true if the given node has the given DITA class, using the schema.
 : @param $node The node to test.
 : @param $ditaclass The DITA class string, e.g. "topic/p".
 : @see https://documentation.fontoxml.com/latest/fonto-dita-class-9dd8240eb51f
 :)
declare function fonto:dita-class($node as node(), $ditaclass as xs:string) as xs:boolean external;

(:~
 : Returns the markup label of the given node, as configured via the markupLabel property in configureProperties.
 : @param $node The node whose markup label to retrieve.
 : @see https://documentation.fontoxml.com/latest/fonto-markup-label-94d77791388a
 :)
declare function fonto:markup-label($node as node()) as xs:string external;

(:~
 : Returns true if the given node is visualized as a block (e.g. configured as frame, structure, or block).
 : Cannot be used in family configuration for the same node. Use fonto:in-inline-layout to check
 : the expected layout context instead.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-block-layout-63c8bd99d28a
 :)
declare function fonto:block-layout($node as node()) as xs:boolean external;

(:~
 : Returns true if the given node should be rendered as inline, as determined by its parent's family.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-in-inline-layout-4073a50b4330
 :)
declare function fonto:in-inline-layout($node as node()) as xs:boolean external;

(:~
 : Returns a plain-text representation of the node's content, ignoring removed and detached descendants.
 : Inserts newlines at block/inline boundaries and for break elements.
 : @param $node The node to extract text from.
 : @see https://documentation.fontoxml.com/latest/fonto-curated-text-in-node-4623872061c2
 :)
declare function fonto:curated-text-in-node($node as node()) as xs:string? external;

(:~
 : Returns a plain-text representation of the node's content with options (e.g. dfcs for bidi text).
 : @param $node The node to extract text from.
 : @param $options Options map (see CuratedTextOptions).
 : @see https://documentation.fontoxml.com/latest/fonto-curated-text-in-node-4623872061c2
 :)
declare function fonto:curated-text-in-node($node as node(), $options as map(*)) as xs:string? external;

(:~
 : Returns a plain-text representation of a document range, ignoring removed and detached descendants.
 : Returns the empty sequence for invalid or empty ranges.
 : @param $startContainer The node containing the start of the range.
 : @param $startOffset The offset within the start container.
 : @param $endContainer The node containing the end of the range.
 : @param $endOffset The offset within the end container.
 : @see https://documentation.fontoxml.com/latest/fonto-curated-text-in-range-33986dbff804
 :)
declare function fonto:curated-text-in-range(
	$startContainer as node(),
	$startOffset as xs:numeric,
	$endContainer as node(),
	$endOffset as xs:numeric
) as xs:string? external;

(:~
 : Returns a plain-text representation of a document range with options (e.g. dfcs for bidi text).
 : Returns the empty sequence for invalid or empty ranges.
 : @param $startContainer The node containing the start of the range.
 : @param $startOffset The offset within the start container.
 : @param $endContainer The node containing the end of the range.
 : @param $endOffset The offset within the end container.
 : @param $options Options map (see CuratedTextOptions).
 : @see https://documentation.fontoxml.com/latest/fonto-curated-text-in-range-33986dbff804
 :)
declare function fonto:curated-text-in-range(
	$startContainer as node(),
	$startOffset as xs:numeric,
	$endContainer as node(),
	$endOffset as xs:numeric,
	$options as map(*)
) as xs:string? external;

(:~
 : Returns true if the document with the given remote document id is loaded.
 : @param $remoteDocumentId The remote document id to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-document-loaded-b22eba5424ed
 :)
declare function fonto:is-document-loaded($remoteDocumentId as xs:string) as xs:boolean external;

(:~
 : Returns true if the document with the given remote document id is in error state.
 : @param $remoteDocumentId The remote document id to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-document-errored-2b43985649f9
 :)
declare function fonto:is-document-errored($remoteDocumentId as xs:string) as xs:boolean external;

(:~
 : Returns the document node for the given remote document id if it is loaded, otherwise the empty sequence.
 : @param $remoteDocumentId The remote document id.
 : @see https://documentation.fontoxml.com/latest/fonto-document-fb5c19e1ad6d
 :)
declare function fonto:document($remoteDocumentId as xs:string?) as node()? external;

(:~
 : Returns a state map for the given remote document id (matching RemoteDocumentStateProperties),
 : or the empty sequence if the document is not loaded.
 : @param $remoteDocumentId The remote document id.
 : @see https://documentation.fontoxml.com/latest/fonto-remote-document-state-03df124b223a
 :)
declare function fonto:remote-document-state($remoteDocumentId as xs:string) as map(*)? external;

(:~
 : Returns the remoteDocumentId of the document that contains the given node.
 : Throws an error when the node is not related to a document that has a remote document id.
 : @param $node The node of which the remote document id should be looked up.
 : @see https://documentation.fontoxml.com/latest/fonto-remote-document-id-c4f2b7d3ca21
 :)
declare function fonto:remote-document-id($node as node()) as xs:string external;

(:~
 : Returns the Fonto NodeId of the given node. Do not use this in operations.
 : @param $node The node.
 : @see https://documentation.fontoxml.com/latest/fonto-node-id-7b60a9382817
 :)
declare function fonto:node-id($node as node()) as xs:string external;

(:~
 : Returns true if the given node is read-only for any reason.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-node-read-only-72ca327d3704
 :)
declare function fonto:is-node-read-only($node as node()) as xs:boolean external;

(:~
 : Returns the hierarchy source node for the given hierarchy node id.
 : @param $hierarchyNodeId The hierarchy node id.
 : @see https://documentation.fontoxml.com/latest/fonto-hierarchy-source-node-346968934801
 :)
declare function fonto:hierarchy-source-node($hierarchyNodeId as xs:string?) as node()? external;

(:~
 : Evaluates the configured hierarchyChildNodesQuery for the given node.
 : Returns the empty sequence if no node is given or no query is configured.
 : @param $node The node for which to retrieve the hierarchy child nodes.
 : @see https://documentation.fontoxml.com/latest/fonto-hierarchy-child-nodes-e46c9fb8f2c0
 :)
declare function fonto:hierarchy-child-nodes($node as node()?) as node()* external;

(:~
 : Returns the contents of the "title" of the given node, as configured with titleQuery.
 : @param $node The node to resolve the contents of the title of.
 : @see https://documentation.fontoxml.com/latest/fonto-title-content-1acac0f6c610
 :)
declare function fonto:title-content($node as node()) as xs:string? external;

(:~
 : Returns the direction of the "title" of the given node, as configured with titleDirectionQuery.
 : @param $node The node to resolve the direction of the title of.
 : @see https://documentation.fontoxml.com/latest/fonto-title-content-direction-975b104b0a82
 :)
declare function fonto:title-content-direction($node as node()) as xs:string external;

(:~
 : Returns the effective text direction ('ltr' or 'rtl') for the given node.
 : Returns 'ltr' when no direction is configured or no node is passed.
 : @param $node The node for which to get the effective direction.
 : @see https://documentation.fontoxml.com/latest/fonto-direction-193c5dccadfc
 :)
declare function fonto:direction($node as node()?) as xs:string external;

(:~
 : Returns true if the given node is a table according to any table definition.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-table-a4faf751893d
 :)
declare function fonto:is-table($node as node()) as xs:boolean external;

(:~
 : Returns true if the given node is a table cell according to any table definition.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-table-cell-7d82e5b1f409
 :)
declare function fonto:is-table-cell($node as node()) as xs:boolean external;

(:~
 : Returns true for any CALS table element (tgroup) or CALS table figure element (table).
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-cals-table-fd98acb9a49f
 :)
declare function fonto:is-cals-table($node as node()?) as xs:boolean external;

(:~
 : Returns true for any XHTML table element.
 : @param $node The node to check.
 : @see https://documentation.fontoxml.com/latest/fonto-is-xhtml-table-5e4d4e55a9df
 :)
declare function fonto:is-xhtml-table($node as node()?) as xs:boolean external;

(:~
 : Returns the column specification.
 : @param $columnSpecifications The column specifications node.
 : @param $columnIdentifier The column identifier.
 : @see https://documentation.fontoxml.com/latest/fonto-column-spec-0d3684963eb6
 :)
declare function fonto:column-spec($columnSpecifications as node(), $columnIdentifier as xs:string) as item()? external;
