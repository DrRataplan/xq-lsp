module namespace ft = "http://exist-db.org/xquery/lucene";

(: ── Querying ─────────────────────────────────────────────────────────────── :)

(:~
 : Queries indexed nodes using a Lucene query string.
 : @param $nodes The nodes to query (collection reference or sequence of nodes)
 : @param $query The Lucene query string or XML query element
 :)
declare function ft:query($nodes as node()*, $query as item()) as node()* external;

(:~
 : Queries indexed nodes using a Lucene query with options.
 : @param $nodes The nodes to query
 : @param $query The Lucene query string or XML query element
 : @param $options Query options map (e.g. map { "fields": ("title") })
 :)
declare function ft:query($nodes as node()*, $query as item(), $options as map(*)) as node()* external;

(:~
 : Queries a named Lucene index field.
 : @param $field The field name to query
 : @param $query The Lucene query string or XML query element
 :)
declare function ft:query-field($field as xs:string, $query as item()) as node()* external;

(:~
 : Queries a named Lucene index field with options.
 : @param $field The field name to query
 : @param $query The Lucene query string or XML query element
 : @param $options Query options map
 :)
declare function ft:query-field($field as xs:string, $query as item(), $options as map(*)) as node()* external;

(:~
 : Searches across multiple indexed collections or documents using a Lucene query.
 : @param $path The collection or document URI to search
 : @param $query The Lucene query string
 :)
declare function ft:search($path as xs:string, $query as xs:string) as node()* external;

(:~
 : Searches with additional query options.
 : @param $path The collection or document URI to search
 : @param $query The Lucene query string
 : @param $options Query options map
 :)
declare function ft:search($path as xs:string, $query as xs:string, $options as map(*)) as node()* external;

(:~
 : Returns the Lucene relevance score for the given node (result of ft:query/ft:search).
 : @param $node The result node
 :)
declare function ft:score($node as node()) as xs:float external;

(: ── Fields ───────────────────────────────────────────────────────────────── :)

(:~
 : Returns the stored value of the given field for the given node.
 : @param $node The result node
 : @param $field The field name
 :)
declare function ft:field($node as node(), $field as xs:string) as xs:string* external;

(:~
 : Returns the stored value of the given field cast to the specified type.
 : @param $node The result node
 : @param $field The field name
 : @param $type The target type (e.g. "xs:integer")
 :)
declare function ft:field($node as node(), $field as xs:string, $type as xs:string) as xs:anyAtomicType* external;

(:~
 : Returns the highlighted field value for the given node and field name.
 : @param $node The result node
 : @param $field The field name
 :)
declare function ft:highlight-field-matches($node as node(), $field as xs:string) as element()? external;

(:~
 : Returns the stored value of the named query field for the given node.
 : @param $node The result node
 : @param $field The field name
 :)
declare function ft:get-field($node as node(), $field as xs:string) as xs:string* external;

(:~
 : Returns facet counts for the given field in the given result set.
 : @param $nodes The result nodes
 : @param $dimension The facet field name
 :)
declare function ft:facets($nodes as node()*, $dimension as xs:string) as map(*)? external;

(:~
 : Returns facet counts up to the given maximum.
 : @param $nodes The result nodes
 : @param $dimension The facet field name
 : @param $max Maximum number of facet values to return
 :)
declare function ft:facets($nodes as node()*, $dimension as xs:string, $max as xs:integer?) as map(*)? external;

(:~
 : Returns hierarchical facet counts for the given path.
 : @param $nodes The result nodes
 : @param $dimension The top-level facet field name
 : @param $max Maximum number of values
 : @param $paths Additional path components for hierarchical facets
 :)
declare function ft:facets($nodes as node()*, $dimension as xs:string, $max as xs:integer?, $paths as xs:string*) as map(*)? external;

(: ── Index Management ─────────────────────────────────────────────────────── :)

(:~
 : Manually indexes the given document against a collection's Lucene configuration.
 : @param $collection-uri The collection whose Lucene config governs the indexing
 : @param $doc The document to index
 :)
declare function ft:index($collection-uri as xs:string, $doc as node()) as empty-sequence() external;

(:~
 : Reindexes the Lucene index for the given collection.
 : @param $collection-uri The collection URI to reindex
 :)
declare function ft:reindex($collection-uri as xs:string) as empty-sequence() external;

(:~
 : Removes the Lucene index entries for the given document URI.
 : @param $document-uri The document URI whose index to remove
 :)
declare function ft:remove-index($document-uri as xs:string) as empty-sequence() external;

(:~
 : Returns true if the given path has an associated Lucene index.
 : @param $path The collection or document URI
 :)
declare function ft:has-index($path as xs:string) as xs:boolean external;

(:~
 : Optimizes the Lucene index (merges segments for faster querying).
 :)
declare function ft:optimize() as empty-sequence() external;

(:~
 : Returns an element describing the Lucene index configuration for the given collection.
 : @param $collection-uri The collection URI
 :)
declare function ft:inspect-index($collection-uri as xs:string) as element()? external;

(:~
 : Returns index keys from the Lucene index for the given nodes.
 : @param $nodes The indexed nodes
 : @param $function A callback function invoked for each key
 :)
declare function ft:lucene-index-keys($nodes as node()*, $function as function(*)) as item()* external;

(:~
 : Returns index keys from the Lucene index for the given nodes, with a maximum count.
 : @param $nodes The indexed nodes
 : @param $start-value The start key for range iteration
 : @param $function A callback function invoked for each key
 : @param $max The maximum number of keys to return
 :)
declare function ft:lucene-index-keys($nodes as node()*, $start-value as xs:string?, $function as function(*), $max as xs:integer) as item()* external;
