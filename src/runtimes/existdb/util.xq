module namespace util = "http://exist-db.org/xquery/util";

(:~
 : Returns the absolute internal id of a resource as a 65 bit number. The first
 : 32 bits are the collection id, the next 32 bits are the document id, the
 : last bit is the document type. The argument can either be a node or a string
 : path pointing to a resource in the database. If the resource does not exist
 : or the node does not belong to a stored document, the empty sequence is
 : returned.
 : @param $node-or-path The node or a string path pointing to a resource in the database.
 : @return the absolute ID of the resource
 :)
declare function util:absolute-resource-id($node-or-path as item()) as xs:integer? external;

(:~
 : Converts the number $number from base $base to xs:integer.
 :)
declare function util:base-to-integer() as item()* external;

(:~
 : Decode the given Base64 encoded string back to clear text
 : @param $string The Base64 string to be decoded
 : @return the decoded output
 :)
declare function util:base64-decode($string as xs:string?) as xs:string? external;

(:~
 : Encodes the given string as Base64 (see RFC 2045 §6.8)
 : @param $string The string to be Base64 encoded
 : @return the Base64 encoded output, with trailing newlines trimmed
 :)
declare function util:base64-encode($string as xs:string?) as xs:string? external;

(:~
 : Encodes the given string as Base64
 : @deprecated This function is deprecated. The output does not need to be trimmed, please use util:base64-encode#1 instead.
 : @param $string The string to be Base64 encoded
 : @param $trim Trim trailing newlines?
 : @return the Base64 encoded output
 :)
declare function util:base64-encode($string as xs:string?, $trim as xs:boolean) as xs:string? external;

(:~
 : Encodes the given string as Base64, url-safe. No padding and use - and _
 : instead of + and / (see RFC 4648 §5).
 : @return the Base64, url-safe encoded output without padding
 :)
declare function util:base64-encode-url-safe($string as xs:string?) as xs:string? external;

(:~
 : Retrieves the binary resource and returns its contents as a value of type
 : xs:base64Binary. An empty sequence is returned if the resource could not be
 : found or $binary-resource was empty.
 : @param $binary-resource The path to the binary resource
 : @return the binary document
 :)
declare function util:binary-doc($binary-resource as xs:string?) as xs:base64Binary? external;

(:~
 : Checks if the binary resource identified by $binary-resource is available.
 : @param $binary-resource The path to the binary resource
 : @return true if the binary document is available
 :)
declare function util:binary-doc-available($binary-resource as xs:string?) as xs:boolean external;

(:~
 : Gets the digest of the content of the resource identified by
 : $binary-resource.
 : @param $binary-resource The path to the binary resource
 : @param $algorithm The name of the algorithm to use for calculating the digest. Supports:
 : @return the digest of the content of the Binary Resource
 :)
declare function util:binary-doc-content-digest(
	$binary-resource as xs:string?,
	$algorithm as xs:string
) as xs:hexBinary? external;

(:~
 : Returns the contents of a binary resource as an xs:string value. The binary
 : data is transformed into a Java string using the encoding specified in the
 : optional second argument or the default of UTF-8.
 : @param $binary-resource The binary resource
 : @return the string containing the encoded binary resource
 :)
declare function util:binary-to-string($binary-resource as xs:base64Binary?) as xs:string? external;

(:~
 : Returns the contents of a binary resource as an xs:string value. The binary
 : data is transformed into a Java string using the encoding specified in the
 : optional second argument or the default of UTF-8.
 : @param $binary-resource The binary resource
 : @param $encoding The encoding type. i.e. 'UTF-8'
 : @return the string containing the encoded binary resource
 :)
declare function util:binary-to-string(
	$binary-resource as xs:base64Binary?,
	$encoding as xs:string
) as xs:string? external;

(:~
 : Invokes a first-class function reference created by util:function. The
 : function to be called is passed as the first argument. All remaining
 : arguments are forwarded to the called function.
 : @param $function-reference The function to ba called
 : @param $parameters The parameters to be passed into the function
 : @return the results from the function called
 :)
declare function util:call($function-reference as function(*), $parameters as item()*) as item()* external;

(:~
 : Returns a sequence of strings containing all collation locales that might be
 : specified in the '?lang=' parameter of a collation URI.
 : @return the sequence of strings containing all collation locales that might be specified in the '?lang=' parameter of a collation URI.
 :)
declare function util:collations() as xs:string* external;

(:~
 : Returns the name of the collection from a passed node or path string. If the
 : argument is a node, the function returns the name of the collection to which
 : the node's document belongs. If the argument is a string, it is interpreted
 : as path to a resource and the function returns the computed parent
 : collection path for this resource.
 : @param $node-or-path-string The document node or a path string.
 : @return the name of the collection.
 :)
declare function util:collection-name($node-or-path-string as item()?) as xs:string? external;

(:~
 : Compiles the XQuery expression given in parameter $expression. Returns an
 : empty string if no errors were found, a description of the error otherwise.
 : @param $expression The XPath/XQuery expression.
 : @return the results of the expression
 :)
declare function util:compile($expression as xs:string) as xs:string external;

(:~
 : Compiles the XQuery expression given in parameter $expression. Returns an
 : empty string if no errors were found, a description of the error otherwise.
 : @param $expression The XPath/XQuery expression.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db if your modules are stored in db.
 : @return the results of the expression
 :)
declare function util:compile($expression as xs:string, $module-load-path as xs:string) as xs:string external;

(:~
 : Compiles the XQuery expression given in parameter $expression. Returns an
 : XML fragment which describes any errors found. If the query could be
 : compiled successfully, a fragment <info result="pass"/> is returned.
 : Otherwise, an error description is returned as follows: <info
 : result="fail"><error code="errcode" line="line" column="column">error
 : description</error></info>.
 : @param $expression The XPath/XQuery expression.
 : @param $module-load-path The module load path. Imports will be resolved relative to this. Use xmldb:exist:///db if your modules are stored in db.
 : @return the results of the expression
 :)
declare function util:compile-query($expression as xs:string, $module-load-path as xs:string?) as element() external;

(:~
 : Dynamically declares a namespace/prefix mapping for the current context.
 : @param $prefix The prefix to be assigned to the namespace
 : @param $namespace-uri The namespace URI
 :)
declare function util:declare-namespace($prefix as xs:string, $namespace-uri as xs:anyURI) as empty-sequence() external;

(:~
 : Dynamically declares a serialization option as with 'declare option'.
 : @param $name The serialization option name
 : @param $option The serialization option value
 :)
declare function util:declare-option($name as xs:string, $option as xs:string) as empty-sequence() external;

(:~
 : Returns a sequence containing the QNames of all variables declared in the
 : module identified by the specified namespace URI. An error is raised if no
 : module is found for the specified URI.
 : @param $namespace-uri The namespace URI of the function module
 : @return the sequence of function names
 :)
declare function util:declared-variables($namespace-uri as xs:string) as xs:string+ external;

(:~
 : Creates a new, entirely in-memory copy of the passed in item.
 : @param $item The item to be copied
 : @return The copied item
 :)
declare function util:deep-copy($item as item()?) as item()? external;

(:~
 : Describes a built-in function. Returns an element describing the function
 : signature.
 : @deprecated Use inspect:inspect-function#1 instead!
 : @param $function-name The name of the function to get the signature of
 : @return the signature of the function
 :)
declare function util:describe-function($function-name as xs:QName) as node() external;

(:~
 : Disable profiling output within the query.
 :)
declare function util:disable-profiling() as empty-sequence() external;

(:~
 : Returns the document nodes of the documents with the given DOCTYPE(s).
 : @param $doctype The DOCTYPE of the documents to find
 : @return the document nodes
 :)
declare function util:doctype($doctype as xs:string+) as node()* external;

(:~
 : Returns the internal integer id of a document. The argument can either be a
 : node or a string path pointing to a resource in the database. If the
 : resource does not exist or the node does not belong to a stored document,
 : the empty sequence is returned.
 : @param $node-or-path The node or a string path pointing to a resource in the database.
 : @return the ID of the document
 :)
declare function util:document-id($node-or-path as item()) as xs:int? external;

(:~
 : Returns the name of a document (excluding the collection path). The argument
 : can either be a node or a string path pointing to a resource in the
 : database. If the resource does not exist or the node does not belong to a
 : stored document, the empty sequence is returned.
 : @param $node-or-path The node or a string path pointing to a resource in the database.
 : @return the name of the document
 :)
declare function util:document-name($node-or-path as item()) as xs:string? external;

(:~
 : Enable profiling output within the query. The profiling starts with this
 : function call and will end with a call to 'disable-profiling'. Argument
 : $verbosity specifies the verbosity. All other profiling options can be
 : configured via the 'declare option exist:profiling ...' in the query prolog.
 : @param $verbosity The verbosity of the profiling
 :)
declare function util:enable-profiling($verbosity as xs:int) as empty-sequence() external;

declare function util:eval($expression as item()) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 :)
declare function util:eval($expression as item(), $cache-flag as xs:boolean) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 : @param $external-variable External variables to be bound for the query that is being evaluated. Should be alternating variable QName and value.
 :)
declare function util:eval(
	$expression as item(),
	$cache-flag as xs:boolean,
	$external-variable as xs:anyType*
) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 : @param $external-variable External variables to be bound for the query that is being evaluated. Should be alternating variable QName and value.
 : @param $pass Passes on the original error info (line and column number). By default, this option is false
 :)
declare function util:eval(
	$expression as item(),
	$cache-flag as xs:boolean,
	$external-variable as xs:anyType*,
	$pass as xs:boolean
) as item()* external;

(:~
 : Dynamically evaluates an XPath/XQuery expression and serializes the results
 : @param $default-serialization-params The default parameters for serialization, these may be overridden by any settings within the XQuery Prolog of the $expression.
 :)
declare function util:eval-and-serialize(
	$expression as item(),
	$default-serialization-params as item()?
) as item()* external;

(:~
 : Dynamically evaluates an XPath/XQuery expression and serializes the results
 : @param $default-serialization-params The default parameters for serialization, these may be overridden by any settings within the XQuery Prolog of the $expression.
 : @param $starting-loc the starting location within the results to return the values from
 :)
declare function util:eval-and-serialize(
	$expression as item(),
	$default-serialization-params as item()?,
	$starting-loc as xs:double?
) as item()* external;

(:~
 : Dynamically evaluates an XPath/XQuery expression and serializes the results
 : @param $default-serialization-params The default parameters for serialization, these may be overridden by any settings within the XQuery Prolog of the $expression.
 : @param $starting-loc the starting location within the results to return the values from
 : @param $length the number of items from $starting-loc to return the values of
 :)
declare function util:eval-and-serialize(
	$expression as item(),
	$default-serialization-params as item()?,
	$starting-loc as xs:double?,
	$length as xs:double?
) as item()* external;

(:~
 : Dynamically evaluates an XPath/XQuery expression and serializes the results
 : @param $default-serialization-params The default parameters for serialization, these may be overridden by any settings within the XQuery Prolog of the $expression.
 : @param $starting-loc the starting location within the results to return the values from
 : @param $length the number of items from $starting-loc to return the values of
 : @param $pass Passes on the original error info (line and column number). By default, this option is false
 :)
declare function util:eval-and-serialize(
	$expression as item(),
	$default-serialization-params as item()?,
	$starting-loc as xs:double?,
	$length as xs:double?,
	$pass as xs:boolean
) as item()* external;

(:~
 : @param $inline-context The inline context
 :)
declare function util:eval-inline($inline-context as item()?, $expression as item()) as item()* external;

(:~
 : @param $inline-context The inline context
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 :)
declare function util:eval-inline(
	$inline-context as item()?,
	$expression as item(),
	$cache-flag as xs:boolean
) as item()* external;

(:~
 : @param $inline-context The inline context
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 : @param $pass Passes on the original error info (line and column number). By default, this option is false
 :)
declare function util:eval-inline(
	$inline-context as item()?,
	$expression as item(),
	$cache-flag as xs:boolean,
	$pass as xs:boolean
) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 :)
declare function util:eval-with-context(
	$expression as item(),
	$context as node()?,
	$cache-flag as xs:boolean
) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 : @param $eval-context-item the context item against which the expression will be evaluated
 :)
declare function util:eval-with-context(
	$expression as item(),
	$context as node()?,
	$cache-flag as xs:boolean,
	$eval-context-item as item()?
) as item()* external;

(:~
 : @param $cache-flag The flag for whether the compiled query should be cached. The cached query will be globally available within the db instance.
 : @param $eval-context-item the context item against which the expression will be evaluated
 : @param $pass Passes on the original error info (line and column number). By default, this option is false
 :)
declare function util:eval-with-context(
	$expression as item(),
	$context as node()?,
	$cache-flag as xs:boolean,
	$eval-context-item as item()?,
	$pass as xs:boolean
) as item()* external;

(:~
 : Puts an exclusive lock on the owner documents of all nodes in the first
 : argument $nodes. Then evaluates the expressions in the second argument
 : $expression and releases the acquired locks after their completion.
 : @param $nodes The nodes whose owning documents will have exclusive locks set.
 :)
declare function util:exclusive-lock($nodes as node()*, $expression as item()*) as item()* external;

(:~
 : Creates an in-memory copy of the passed node set, using the specified
 : serialization options. By default, full-text match terms will be tagged with
 : &lt;exist:match&gt; and XIncludes will be expanded.
 : @return the results
 :)
declare function util:expand($node as node()*) as node()* external;

(:~
 : Creates an in-memory copy of the passed node set, using the specified
 : serialization options. By default, full-text match terms will be tagged with
 : &lt;exist:match&gt; and XIncludes will be expanded. Serialization parameters
 : can be set in the second argument, which accepts the same parameters as the
 : exist:serialize option.
 : @param $serialization-parameters The serialization parameters
 : @return the results
 :)
declare function util:expand($node as node()*, $serialization-parameters as xs:string) as node()* external;

(:~
 : Creates a reference to an XQuery function which can later be called from
 : util:call. This allows for higher-order functions to be implemented in
 : XQuery. A higher-order function is a function that takes another function as
 : argument. The first argument represents the name of the function, which
 : should be a valid QName. The second argument is the arity (number of
 : parameters) of the function. If no function can be found that matches the
 : name and arity, an error is thrown. Please note: the arguments to this
 : function have to be literals or need to be resolvable at compile time at
 : least.
 :)
declare function util:function() as item()* external;

(:~
 : Serializes an XML fragment or a sequence of nodes between two elements
 : (normally milestone elements). This function works only on documents which
 : are stored in the database itself. The $beginning-node represents the first
 : node/milestone element, $ending-node, the second one. The results will be
 : inclusive of $beginning-node and exclusive of the $ending-node. The third
 : argument, $make-fragment, is a boolean value for the path completion. If it
 : is set to true() the result sequence is wrapped into a parent element node.
 : The fourth argument display-root-namespace (only used when $make-fragment is
 : true()), is a boolean value for displaying the root node namespace. If it is
 : set to true() the attribute "xmlns" in the root node of the result sequence
 : is determined from the $beginning-node. Example call of the function for
 : getting the fragment between two TEI page break element nodes: let $fragment
 : := util:get-fragment-between(//pb[1], //pb[2], true(), true())
 : @param $beginning-node The first node/milestone element
 : @param $ending-node The second node/milestone element
 : @param $make-fragment The flag make a fragment.
 : @param $display-root-namespace Display the namespace of the root node of the fragment.
 : @return the string containing the fragment between the two node/milestone elements.
 :)
declare function util:get-fragment-between(
	$beginning-node as node(),
	$ending-node as node()?,
	$make-fragment as xs:boolean?,
	$display-root-namespace as xs:boolean?
) as xs:string external;

(:~
 : Returns a short description of the module identified by the namespace URI.
 : @deprecated Use inspect:inspect-module-uri#1 instead!
 : @return the description of the active function module identified by the namespace URI
 :)
declare function util:get-module-description() as xs:string+ external;

(:~
 : Returns an XML fragment providing additional information about the module
 : identified by the namespace URI.
 : @return the description of the active function module identified by the namespace URI
 :)
declare function util:get-module-info() as element() external;

(:~
 : Gets the value of a serialization option as set with 'declare option'.
 : @param $name The serialization option name
 :)
declare function util:get-option($name as xs:string) as xs:string? external;

(:~
 : Returns the resource indicated by its absolute internal id. The first 32
 : bits are the collection id, the next 32 bits are the document id, the last
 : bit is the document type. If the resource does not exist, the empty sequence
 : is returned.
 : @param $absolute-id The absolute id of a resource in the database.
 : @return The resource from the database. A document() if its an XML resource, or an xs:base64binary otherwise
 :)
declare function util:get-resource-by-absolute-id($absolute-id as xs:integer) as item()? external;

(:~
 : Returns the string representation of the type of sequence.
 : @param $sequence-type The type of sequence
 : @return the string representation of the type of sequence
 :)
declare function util:get-sequence-type($sequence-type as xs:anyType*) as xs:string external;

(:~
 : Calculates a hashcode from a string based on a specified algorithm.
 :)
declare function util:hash() as item()* external;

(:~
 : Dynamically imports an XQuery module into the current context. The
 : parameters have the same meaning as in an 'import module ...' expression in
 : the query prolog.
 : @deprecated Use fn:load-module#2 instead!
 : @param $module-uri The namespace URI of the module
 : @param $prefix The prefix to be assigned to the namespace
 : @param $location The location of the module
 :)
declare function util:import-module(
	$module-uri as xs:anyURI,
	$prefix as xs:string,
	$location as xs:anyURI*
) as empty-sequence() external;

(:~
 : Return the number of documents for an indexed value.
 :)
declare function util:index-key-documents() as item()* external;

(:~
 : Return the number of occurrences for an indexed value.
 :)
declare function util:index-key-occurrences() as item()* external;

(:~
 : Can be used to query existing range indexes defined on a set of nodes. All
 : index keys defined for the given node set are reported to a callback
 : function. The function will check for indexes defined on path as well as
 : indexes defined by QName.
 : @param $node-set The node set
 : @param $start-value Only index keys of the same type but being greater than $start-value will be reported for non-string types. For string types, only keys starting with the given prefix are reported.
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of returned keys
 : @return the results of the eval of the $function-reference
 :)
declare function util:index-keys(
	$node-set as node()*,
	$start-value as xs:anyAtomicType?,
	$function-reference as function(*),
	$max-number-returned as xs:integer?
) as item()* external;

(:~
 : Can be used to query existing range indexes defined on a set of nodes. All
 : index keys defined for the given node set are reported to a callback
 : function. The function will check for indexes defined on path as well as
 : indexes defined by QName.
 : @param $node-set The node set
 : @param $start-value Only index keys of the same type but being greater than $start-value will be reported for non-string types. For string types, only keys starting with the given prefix are reported.
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of returned keys
 : @param $index The index in which the search is made
 : @return the results of the eval of the $function-reference
 :)
declare function util:index-keys(
	$node-set as node()*,
	$start-value as xs:anyAtomicType?,
	$function-reference as function(*),
	$max-number-returned as xs:integer?,
	$index as xs:string
) as item()* external;

(:~
 : Can be used to query existing range indexes defined on a set of nodes. All
 : index keys defined for the given node set are reported to a callback
 : function. The function will check for indexes defined on path as well as
 : indexes defined by QName.
 : @param $qname The node set
 : @param $start-value Only index keys of the same type but being greater than $start-value will be reported for non-string types. For string types, only keys starting with the given prefix are reported.
 : @param $function-reference The function reference as created by the util:function function. It can be an arbitrary user-defined function, but it should take exactly 2 arguments:
 : @param $max-number-returned The maximum number of returned keys
 : @param $index The index in which the search is made
 : @return the results of the eval of the $function-reference
 :)
declare function util:index-keys-by-qname(
	$qname as xs:QName*,
	$start-value as xs:anyAtomicType?,
	$function-reference as function(*),
	$max-number-returned as xs:integer?,
	$index as xs:string
) as item()* external;

(:~
 : Returns the range index type for a set of nodes or an empty sequence if no
 : index is defined.
 : @param $set-of-nodes The set of nodes
 : @return the range index type
 :)
declare function util:index-type($set-of-nodes as node()*) as xs:string? external;

(:~
 : Returns an XML fragment describing the function referenced by the passed
 : function item.
 : @param $function The function item to inspect
 : @return the signature of the function
 :)
declare function util:inspect-function($function as function(*)) as node() external;

(:~
 : Converts an int e.g. 511 to an octal number e.g. 0777.
 : @param $int The int to convert to an octal string.
 :)
declare function util:int-to-octal($int as xs:int) as xs:string external;

(:~
 : Converts the xs:integer $number (unsigned) into base $base as xs:string.
 : Bases 2, 8, and 16 are supported.
 :)
declare function util:integer-to-base() as item()* external;

(:~
 : Checks if the resource identified by $binary-resource is a binary resource.
 : @param $binary-resource The path to the binary resource
 : @return true if the resource is a binary document
 :)
declare function util:is-binary-doc($binary-resource as xs:string?) as xs:boolean external;

(:~
 : Returns a Boolean value if the module statically mapped to a source location
 : in the configuration file.
 : @return true if the namespace URI is mapped as an active function module
 :)
declare function util:is-module-mapped() as xs:boolean external;

(:~
 : Returns a Boolean value if the module identified by the namespace URI is
 : registered.
 : @return true if the namespace URI is registered as an active function module
 :)
declare function util:is-module-registered() as xs:boolean external;

(:~
 : Retrieves the line number of the expression
 : @return The line number of this expression
 :)
declare function util:line-number() as xs:integer external;

(:~
 : Returns a sequence of function items for each function in the current
 : module.
 : @deprecated Use inspect:module-functions#0 instead.
 : @return sequence of function references
 :)
declare function util:list-functions() as function(*)* external;

(:~
 : Returns a sequence of function items for each function in the specified
 : module.
 : @deprecated Use inspect:module-functions-by-uri#1 instead.
 : @param $namespace-uri The namespace URI of the function module
 : @return sequence of function references
 :)
declare function util:list-functions($namespace-uri as xs:string) as function(*)* external;

(:~
 : Map the module to a source location. This function is only available to the
 : DBA role.
 : @return Returns an empty sequence
 :)
declare function util:map-module() as empty-sequence() external;

(:~
 : Returns a sequence containing the namespace URIs of all XQuery modules which
 : are statically mapped to a source location in the configuration file. This
 : does not include any built in modules.
 : @return the sequence of all of the active function modules namespace URIs
 :)
declare function util:mapped-modules() as xs:string+ external;

(:~
 : Retrieves a node by its internal node-id. The document is specified via the
 : first argument. It may either be a document node or another node from the
 : same document from which the target node will be retrieved by its id. The
 : second argument is the internal node-id, specified as a string. If a node
 : with the matching node-id is found, it is returned. Otherwise returns the
 : empty sequence.
 : @param $document The document whose node is to be retrieved by its id
 : @param $node-id The internal node id
 : @return the node or an empty sequence if a matching node does not exist
 :)
declare function util:node-by-id($document as node(), $node-id as xs:string) as node()? external;

(:~
 : Returns the internal node-id of a node. The internal node-id uniquely
 : identifies a node within its document. It is encoded as a long number.
 : @param $node The node to get the internal node-id from
 : @return the internal node-id
 :)
declare function util:node-id($node as node()) as xs:string external;

(:~
 : Returns the XPath for a Node.
 : @param $node The node to retrieve the XPath to
 : @return the XPath expression of the node
 :)
declare function util:node-xpath($node as node()) as xs:string? external;

(:~
 : Converts an octal string e.g. '0777' to an int e.g. 511.
 : @param $octal The octal string to convert to an int.
 :)
declare function util:octal-to-int($octal as xs:string) as xs:int external;

(:~
 : Parses the passed string value into an XML fragment. The HTML string may not
 : be well-formed XML. It will be passed through the Neko HTML parser to make
 : it well-formed. An empty sequence is returned if the argument is an empty
 : string or sequence.
 :)
declare function util:parse-html() as item()* external;

(:~
 : Can be used to query existing qname indexes defined on a set of nodes.
 : @param $qname The QName
 : @param $comparison-value The comparison value
 : @return The result
 :)
declare function util:qname-index-lookup($qname as xs:QName, $comparison-value as xs:anyAtomicType) as node()* external;

(:~
 : Can be used to query existing qname indexes defined on a set of nodes.
 : @param $qname The QName
 : @param $comparison-value The comparison value
 : @param $element-or-attribute true() to lookup an element, false to lookup an attribute
 : @return The result
 :)
declare function util:qname-index-lookup(
	$qname as xs:QName,
	$comparison-value as xs:anyAtomicType,
	$element-or-attribute as xs:boolean
) as node()* external;

(:~
 : Returns a random number between 0.0 and 1.0
 : @return a random number between 0.0 and 1.0
 :)
declare function util:random() as xs:double external;

(:~
 : Returns a random number between 0 (inclusive) and $max (exclusive), that is,
 : a number greater than or equal to 0 but less than $max
 : @param $max A number to be used as the exclusive maximum value for the random number; the return value will be less than this number.
 : @return a random number between 0 and $max
 :)
declare function util:random($max as xs:integer) as xs:integer external;

(:~
 : Returns a random number between 0 and the maximum xs:unsignedLong
 : @return a random number between 0 and the maximum xs:unsignedLong
 :)
declare function util:random-ulong() as xs:unsignedLong external;

(:~
 : Returns a sequence containing the QNames of all functions currently known to
 : the system, including functions in imported and built-in modules.
 : @return the sequence of function names
 :)
declare function util:registered-functions() as xs:string+ external;

(:~
 : Returns a sequence containing the QNames of all functions declared in the
 : module identified by the specified namespace URI. An error is raised if no
 : module is found for the specified URI.
 : @param $namespace-uri The namespace URI of the function module
 : @return the sequence of function names
 :)
declare function util:registered-functions($namespace-uri as xs:string) as xs:string+ external;

(:~
 : Returns a sequence containing the namespace URIs of all modules currently
 : known to the system, including built in and imported modules.
 : @return the sequence of all of the active function modules namespace URIs
 :)
declare function util:registered-modules() as xs:string+ external;

(:~
 : Puts a shared lock on the owner documents of all nodes in the first argument
 : $nodes. Then evaluates the expressions in the second argument $expression
 : and releases the acquired locks after their completion.
 : @param $nodes The nodes that the shared lock will be placed on their owning documents.
 : @param $expression The expression to be evaluated before the acquired locks are released.
 :)
declare function util:shared-lock($nodes as node()*, $expression as item()*) as item()* external;

(:~
 : Returns the contents of a string as an base64binary value. The string data
 : is transformed into a binary using the encoding specified in the optional
 : second argument or the default of UTF-8.
 : @param $encoded-string The string containing the encoded binary resource
 : @return the binary resource
 :)
declare function util:string-to-binary($encoded-string as xs:string?) as xs:base64Binary? external;

(:~
 : Returns the contents of a string as a base64binary value. The string data is
 : transformed into a binary using the encoding specified in the optional
 : second argument or the default of UTF-8.
 : @param $encoded-string The string containing the encoded binary resource
 : @param $encoding the encoding type. i.e. 'UTF-8'
 : @return the binary resource
 :)
declare function util:string-to-binary(
	$encoded-string as xs:string?,
	$encoding as xs:string
) as xs:base64Binary? external;

(:~
 : Returns the current xs:date (with timezone) as reported by the Java method
 : System.currentTimeMillis(). Contrary to fn:current-date, this function is
 : not stable, i.e. the returned xs:date will change during the evaluation time
 : of a query and can be used to measure time differences.
 :)
declare function util:system-date() as xs:date external;

(:~
 : Returns the current xs:dateTime (with timezone) as reported by the Java
 : method System.currentTimeMillis(). Contrary to fn:current-dateTime, this
 : function is not stable, i.e. the returned xs:dateTime will change during the
 : evaluation time of a query and can be used to measure time differences.
 :)
declare function util:system-dateTime() as xs:dateTime external;

(:~
 : Returns the value of a system property. Similar to the corresponding XSLT
 : function. Predefined properties are: vendor, vendor-url, product-name,
 : product-version, product-build, and all Java system properties.
 : @param $property-name The name of the system property to retrieve the value of.
 : @return the value of the named system property
 :)
declare function util:system-property($property-name as xs:string) as xs:string? external;

(:~
 : Returns the current xs:time (with timezone) as reported by the Java method
 : System.currentTimeMillis(). Contrary to fn:current-time, this function is
 : not stable, i.e. the returned xs:time will change during the evaluation time
 : of a query and can be used to measure time differences.
 :)
declare function util:system-time() as xs:time external;

(:~
 : Returns an un-escaped URL escaped string with the encoding scheme (e.g.
 : "UTF-8"). Decodes encoded sensitive characters from a URL, for example "%2F"
 : becomes "/", i.e. does the oposite to escape-uri()
 : @param $escaped-string The escaped string to be un-escaped
 : @param $encoding The encoding scheme to use in the un-escaping of the string
 :)
declare function util:unescape-uri($escaped-string as xs:string, $encoding as xs:string) as item()* external;

(:~
 : Remove relation between module namespace and source location. This function
 : is only available to the DBA role.
 : @return Returns an empty sequence
 :)
declare function util:unmap-module() as empty-sequence() external;

(:~
 : Generate a version 4 (random) universally unique identifier (UUID) string,
 : e.g. 154ad200-9c79-44f3-8cff-9780d91552a6
 : @return a generated UUID string
 :)
declare function util:uuid() as xs:string external;

(:~
 : Generate a version 3 universally unique identifier (UUID) string, e.g.
 : 2b92ddb6-8e4e-3891-b519-afa1609ced73
 : @param $name The input value for UUID calculation.
 : @return a generated UUID string
 :)
declare function util:uuid($name as item()) as xs:string external;

(:~
 : Wait for the specified number of milliseconds
 : @param $interval Number of milliseconds to wait.
 : @return Returns an empty sequence
 :)
declare function util:wait($interval as xs:integer) as empty-sequence() external;
