module namespace ft = "http://exist-db.org/xquery/lucene";

(:~
 : Returns the value of a binary field attached to a particular node obtained
 : via a full text search. Accepts an additional parameter to name the target
 : type into which the field value should be cast. This is mainly relevant for
 : fields having a different type than xs:string. As lucene does not record
 : type information, numbers or dates would be returned as strings by default.
 : @param $node the context node to check for attached fields
 : @param $field name of the field
 : @param $type intended target type to cast the field value to. Empty sequence returns raw (untyped) values as the 2-arg form. Casting may fail with a dynamic error.
 : @return Sequence corresponding to the values of the field attached, cast to the desired target type
 :)
declare function ft:binary-field($node as node(), $field as xs:string, $type as xs:string?) as item()* external;

(:~
 : Close the current Lucene document and flush it to disk. Subsequent calls to
 : ft:index will write to a new Lucene document.
 :)
declare function ft:close() as empty-sequence() external;

(:~
 : Return a map of facet labels and counts for the result of a Lucene query.
 : @param $nodes A sequence of nodes for which facet counts should be returned. If the nodes in the sequence resulted from different Lucene queries, their facet counts will be merged. If no node in the the sequence has facets attached or the sequence is empty, an empty map is returned.
 : @param $dimension The facet dimension. This should correspond to a dimension defined in the index configuration
 : @return A map having the facet label as key and the facet count as value
 :)
declare function ft:facets($nodes as node()*, $dimension as xs:string) as map(*) external;

(:~
 : Return a map of facet labels and counts for the result of a Lucene query.
 : @param $nodes A sequence of nodes for which facet counts should be returned. If the nodes in the sequence resulted from different Lucene queries, their facet counts will be merged. If no node in the the sequence has facets attached or the sequence is empty, an empty map is returned.
 : @param $dimension The facet dimension. This should correspond to a dimension defined in the index configuration
 : @param $count The number of facet labels to be returned. Facets with more occurrences in the result will be returned first.
 : @return A map having the facet label as key and the facet count as value
 :)
declare function ft:facets($nodes as node()*, $dimension as xs:string, $count as xs:integer?) as map(*) external;

(:~
 : Return a map of facet labels and counts for the result of a Lucene query.
 : @param $nodes A sequence of nodes for which facet counts should be returned. If the nodes in the sequence resulted from different Lucene queries, their facet counts will be merged. If no node in the the sequence has facets attached or the sequence is empty, an empty map is returned.
 : @param $dimension The facet dimension. This should correspond to a dimension defined in the index configuration
 : @param $count The number of facet labels to be returned. Facets with more occurrences in the result will be returned first.
 : @param $paths For hierarchical facets, specify a sequence of paths leading to the position in the hierarchy you would like to get facet counts for.
 : @return A map having the facet label as key and the facet count as value
 :)
declare function ft:facets(
	$nodes as node()*,
	$dimension as xs:string,
	$count as xs:integer?,
	$paths as xs:string+
) as map(*) external;

(:~
 : Returns the value of a field attached to a particular node obtained via a
 : full text search. The $type parameter allows you to name the target type
 : into which the field value should be cast. This is mainly relevant for
 : fields having a different type than xs:string. As lucene does not record
 : type information, numbers or dates would be returned as strings by default.
 : @param $node the context node to check for attached fields
 : @param $field name of the field
 : @return Sequence corresponding to the values of the field attached, cast to the desired target type
 :)
declare function ft:field($node as node(), $field as xs:string) as item()* external;

(:~
 : Returns the value of a field attached to a particular node obtained via a
 : full text search. The $type parameter allows you to name the target type
 : into which the field value should be cast. This is mainly relevant for
 : fields having a different type than xs:string. As lucene does not record
 : type information, numbers or dates would be returned as strings by default.
 : @param $node the context node to check for attached fields
 : @param $field name of the field
 : @param $type intended target type to cast the field value to. Empty sequence returns raw (untyped) values as the 2-arg form. Casting may fail with a dynamic error.
 : @return Sequence corresponding to the values of the field attached, cast to the desired target type
 :)
declare function ft:field($node as node(), $field as xs:string, $type as xs:string?) as item()* external;

(:~
 : Retrieve the stored content of a field.
 : @deprecated Use an index definition with nested fields and ft:field instead
 : @param $path URI paths of documents or collections in database. Collection URIs should end on a '/'.
 : @param $field query string
 : @return All documents that are match by the query
 :)
declare function ft:get-field($path as xs:string*, $field as xs:string) as xs:string* external;

(:~
 : Check if the given document has a lucene index defined on it. This method
 : will return true for both, indexes created via collection.xconf or manual
 : index fields added to the document with ft:index.
 : @param $path Full path to the resource to check
 :)
declare function ft:has-index($path as xs:string) as xs:boolean* external;

(:~
 : Highlights matches for the last executed lucene query within the value of a
 : field attached to a particular node obtained via a full text search. Only
 : fields listed in the 'fields' option of ft:query will be available to
 : highlighting. Accepts zero or more nodes; empty input returns empty.
 : @param $nodes zero or more context nodes (empty returns empty)
 : @param $field name of the field
 : @return exist:field elements with matches enclosed in exist:match
 :)
declare function ft:highlight-field-matches($nodes as node()*, $field as xs:string) as element()* external;

(:~
 : Index an arbitrary chunk of (non-XML) data with Lucene. Syntax is inspired
 : by Solr.
 : @param $documentPath URI path of document in database.
 : @param $solrExression XML syntax expected by Solr's add expression. Element should be called 'doc', e.g. <doc> <field name="field1">data1</field> <field name="field2" boost="value">data2</field> </doc>
 :)
declare function ft:index($documentPath as xs:string, $solrExression as node()) as empty-sequence() external;

(:~
 : Index an arbitrary chunk of (non-XML) data with Lucene. Syntax is inspired
 : by Solr.
 : @param $documentPath URI path of document in database.
 : @param $solrExression XML syntax expected by Solr's add expression. Element should be called 'doc', e.g. <doc> <field name="field1">data1</field> <field name="field2" boost="value">data2</field> </doc>
 : @param $close If true, close the Lucene document. Subsequent calls to ft:index will thus add to a new Lucene document. If false, the document remains open and is not flushed to disk. Call the ft:close function to explicitely close and flush the current document.
 :)
declare function ft:index($documentPath as xs:string, $solrExression as node(), $close as xs:boolean) as empty-sequence() external;

(:~
 : Similar to the util:index-keys functions, but returns index entries for a
 : field associated with a lucene index.
 : @param $field The name of the field
 : @param $start-value Only keys starting with the given prefix are reported.
 : @param $function-reference A function reference. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of keys to return
 : @return the results of the eval of the $function-reference
 :)
declare function ft:index-keys-for-field(
	$field as xs:string,
	$start-value as xs:string?,
	$function-reference as function(*),
	$max-number-returned as xs:integer?
) as item()* external;

(:~
 : Calls Lucene's optimize method to merge all index segments into a single
 : one. This is a costly operation and should not be used except for data sets
 : which can be expected to remain unchanged for a while. The optimize will
 : block the index for other write operations and may take some time. You need
 : to be a user in group dba to call this function.
 :)
declare function ft:optimize() as empty-sequence() external;

(:~
 : Queries a node set using a Lucene full text index; a lucene index must
 : already be defined on the nodes, because if no index is available on a node,
 : nothing will be found. Indexes on descendant nodes are not used. The context
 : of the Lucene query is determined by the given input node set. The query is
 : specified either as a query string based on Lucene's default query syntax or
 : as an XML fragment. See https://exist-db.org/exist/apps/doc/lucene.xml#query
 : for complete documentation.
 : @param $nodes The node set to search using a Lucene full text index which is defined on those nodes
 : @param $query The query to search for, provided either as a string or text in Lucene's default query syntax or as an XML fragment to bypass Lucene's default query parser
 : @return all nodes from the input node set matching the query. match highlighting information will be available for all returned nodes. Lucene's match score can be retrieved via the ft:score function.
 :)
declare function ft:query($nodes as node()*, $query as item()?) as node()* external;

(:~
 : Queries a node set using a Lucene full text index; a lucene index must
 : already be defined on the nodes, because if no index is available on a node,
 : nothing will be found. Indexes on descendant nodes are not used. The context
 : of the Lucene query is determined by the given input node set. The query is
 : specified either as a query string based on Lucene's default query syntax or
 : as an XML fragment. See https://exist-db.org/exist/apps/doc/lucene.xml#query
 : for complete documentation.
 : @param $nodes The node set to search using a Lucene full text index which is defined on those nodes
 : @param $query The query to search for, provided either as a string or text in Lucene's default query syntax or as an XML fragment to bypass Lucene's default query parser
 : @param $options An XML fragment or XDM Map containing options to be passed to Lucene's query parser. The following options are supported (a description can be found in the docs): <options> <default-operator>and|or</default-operator> <phrase-slop>number</phrase-slop> <leading-wildcard>yes|no</leading-wildcard> <filter-rewrite>yes|no</filter-rewrite> <lowercase-expanded-terms>yes|no</lowercase-expanded-terms> </options>
 : @return all nodes from the input node set matching the query. match highlighting information will be available for all returned nodes. Lucene's match score can be retrieved via the ft:score function.
 :)
declare function ft:query($nodes as node()*, $query as item()?, $options as item()?) as node()* external;

(:~
 : Queries a Lucene field, which has to be explicitely created in the index
 : configuration.
 : @param $field The lucene field name.
 : @param $query The query to search for, provided either as a string or text in Lucene's default query syntax or as an XML fragment to bypass Lucene's default query parser
 : @return all nodes from the input node set matching the query. match highlighting information will be available for all returned nodes. Lucene's match score can be retrieved via the ft:score function.
 :)
declare function ft:query-field($field as xs:string*, $query as item()) as node()* external;

(:~
 : Queries a Lucene field, which has to be explicitely created in the index
 : configuration.
 : @param $field The lucene field name.
 : @param $query The query to search for, provided either as a string or text in Lucene's default query syntax or as an XML fragment to bypass Lucene's default query parser
 : @param $options An XML fragment or XDM Map containing options to be passed to Lucene's query parser. The following options are supported (a description can be found in the docs): <options> <default-operator>and|or</default-operator> <phrase-slop>number</phrase-slop> <leading-wildcard>yes|no</leading-wildcard> <filter-rewrite>yes|no</filter-rewrite> </options>
 : @return all nodes from the input node set matching the query. match highlighting information will be available for all returned nodes. Lucene's match score can be retrieved via the ft:score function.
 :)
declare function ft:query-field($field as xs:string*, $query as item(), $options as item()?) as node()* external;

(:~
 : KNN vector search by field name. Uses context document set.
 : @param $field The vector field name (from vector-field config).
 : @param $vector Query vector as XQuery array of numbers.
 : @return Nodes matching the vector query.
 :)
declare function ft:query-field-vector($field as xs:string, $vector as array(*)) as node()* external;

(:~
 : KNN vector search by field with explicit k.
 : @param $field The vector field name (from vector-field config).
 : @param $vector Query vector as XQuery array of numbers.
 : @param $k Number of nearest neighbours (default 10).
 : @return Nodes matching the vector query.
 :)
declare function ft:query-field-vector($field as xs:string, $vector as array(*), $k as xs:integer?) as node()* external;

(:~
 : KNN vector search by field with k and options.
 : @param $field The vector field name (from vector-field config).
 : @param $vector Query vector as XQuery array of numbers.
 : @param $k Number of nearest neighbours (default 10).
 : @param $options Optional map with filter-query, filter, facets.
 : @return Nodes matching the vector query.
 :)
declare function ft:query-field-vector(
	$field as xs:string,
	$vector as array(*),
	$k as xs:integer?,
	$options as item()?
) as node()* external;

(:~
 : KNN vector search. Returns k nearest nodes. Vector field is resolved from
 : index config.
 : @param $nodes The node set to search (e.g. collection(...)//article). Document set and qnames are derived from this.
 : @param $vector Query vector as XQuery array of numbers, e.g. [1.0, 0.0, 0.0, 0.0].
 : @return Nodes matching the vector query, ordered by similarity.
 :)
declare function ft:query-vector($nodes as node()*, $vector as array(*)) as node()* external;

(:~
 : KNN vector search with explicit k.
 : @param $nodes The node set to search (e.g. collection(...)//article). Document set and qnames are derived from this.
 : @param $vector Query vector as XQuery array of numbers, e.g. [1.0, 0.0, 0.0, 0.0].
 : @param $k Number of nearest neighbours to return (default 10).
 : @return Nodes matching the vector query, ordered by similarity.
 :)
declare function ft:query-vector($nodes as node()*, $vector as array(*), $k as xs:integer?) as node()* external;

(:~
 : KNN vector search with k and options (filter-query, filter, facets).
 : @param $nodes The node set to search (e.g. collection(...)//article). Document set and qnames are derived from this.
 : @param $vector Query vector as XQuery array of numbers, e.g. [1.0, 0.0, 0.0, 0.0].
 : @param $k Number of nearest neighbours to return (default 10).
 : @param $options Optional map with filter-query, filter, facets.
 : @return Nodes matching the vector query, ordered by similarity.
 :)
declare function ft:query-vector(
	$nodes as node()*,
	$vector as array(*),
	$k as xs:integer?,
	$options as item()?
) as node()* external;

(:~
 : Remove any (non-XML) Lucene index associated with the document identified by
 : the path parameter. This function will only remove indexes which were
 : manually created by the user via the ft:index function. Indexes defined in
 : collection.xconf will NOT be removed. They are maintained automatically by
 : the database. Please note that non-XML indexes will also be removed
 : automatically if the associated document is deleted.
 : @param $documentPath URI path of document in database.
 :)
declare function ft:remove-index($documentPath as xs:string) as empty-sequence() external;

(:~
 : Returns a computed relevance score for the given node. The score is the sum
 : of all relevance scores provided by Lucene for the node and its descendants.
 : In general, the score will be a number between 0.0 and 1.0 if the query had
 : $node as context. If the query targeted multiple descendants of $node (e.g.
 : 'title' and 'author' within a 'book'), the score will be the sum of all
 : sub-scores and may thus be greater than 1.
 : @param $node the context node
 : @return sum of all relevance scores provided by Lucene for all matches below the given context node
 :)
declare function ft:score($node as node()) as xs:float* external;

(:~
 : Search for (non-XML) data with lucene
 : @param $query query string
 : @return All documents that are match by the query
 :)
declare function ft:search($query as xs:string) as node() external;

(:~
 : Search for (non-XML) data with lucene
 : @param $path URI paths of documents or collections in database. Collection URIs should end on a '/'.
 : @param $query query string
 : @return All documents that are match by the query
 :)
declare function ft:search($path as xs:string*, $query as xs:string) as node() external;

(:~
 : Search for (non-XML) data with lucene
 : @param $path URI paths of documents or collections in database. Collection URIs should end on a '/'.
 : @param $query query string
 : @param $fields Fields to return in search results
 : @return All documents that are match by the query
 :)
declare function ft:search($path as xs:string*, $query as xs:string, $fields as xs:string*) as node() external;

(:~
 : Search for (non-XML) data with lucene
 : @param $path URI paths of documents or collections in database. Collection URIs should end on a '/'.
 : @param $query query string
 : @param $fields Fields to return in search results
 : @return All documents that are match by the query
 :)
declare function ft:search(
	$path as xs:string*,
	$query as xs:string,
	$fields as xs:string*,
	$options as node()?
) as node() external;
