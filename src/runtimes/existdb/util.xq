module namespace util = "http://exist-db.org/xquery/util";

(: ── Evaluation ───────────────────────────────────────────────────────────── :)

(:~
 : Evaluates an XQuery expression given as a string and returns the result.
 : @param $expression The XQuery expression to evaluate
 :)
declare function util:eval($expression as xs:string) as item()* external;

(:~
 : Evaluates an XQuery expression given as a string, with cache control.
 : @param $expression The XQuery expression to evaluate
 : @param $cache-flag If true, the compiled expression is cached
 :)
declare function util:eval($expression as xs:string, $cache-flag as xs:boolean) as item()* external;

(:~
 : Evaluates an XQuery expression with cache control and external variable bindings.
 : @param $expression The XQuery expression to evaluate
 : @param $cache-flag If true, the compiled expression is cached
 : @param $external-vars A sequence of alternating xs:QName and value pairs for external variables
 :)
declare function util:eval($expression as xs:string, $cache-flag as xs:boolean, $external-vars as item()*) as item()* external;

(:~
 : Evaluates an XQuery expression in the context of the given node.
 : @param $context The context node
 : @param $expression The XQuery expression to evaluate
 :)
declare function util:eval-inline($context as node(), $expression as xs:string) as item()* external;

(:~
 : Evaluates an XQuery expression given as a URI.
 : @param $uri The URI of the XQuery module to evaluate
 :)
declare function util:eval-with-params($expression as xs:string, $external-vars as map(*)) as item()* external;

(: ── Serialization ────────────────────────────────────────────────────────── :)

(:~
 : Serializes the given content to a string using the specified serialization parameters.
 : @param $content The content to serialize
 : @param $serialization-parameters Serialization options (e.g. "method=xml indent=yes")
 :)
declare function util:serialize($content as item()*, $serialization-parameters as xs:string) as xs:string external;

(:~
 : Serializes the given content using an output:serialization-parameters element.
 : @param $content The content to serialize
 : @param $serialization-parameters The serialization parameters element
 :)
declare function util:serialize($content as item()*, $serialization-parameters as element()) as xs:string external;

(:~
 : Parses a serialized XML string and returns the resulting document node.
 : @param $content The XML string to parse
 :)
declare function util:parse($content as xs:string) as document-node() external;

(:~
 : Parses an HTML string using a lenient HTML parser and returns a document node.
 : @param $content The HTML string to parse
 :)
declare function util:parse-html($content as xs:string) as document-node() external;

(:~
 : Expands namespace prefixes in a node and its descendants.
 : @param $nodes The nodes to expand
 :)
declare function util:expand($nodes as node()*) as node()* external;

(:~
 : Expands namespace prefixes in a node and serializes using the given options.
 : @param $nodes The nodes to expand
 : @param $serialization-parameters Serialization options
 :)
declare function util:expand($nodes as node()*, $serialization-parameters as xs:string) as node()* external;

(: ── Binary / Base64 ─────────────────────────────────────────────────────── :)

(:~
 : Encodes a string value as Base64.
 : @param $string The string to encode
 :)
declare function util:base64-encode($string as xs:string) as xs:string external;

(:~
 : Decodes a Base64-encoded string.
 : @param $string The Base64-encoded string
 :)
declare function util:base64-decode($string as xs:string) as xs:string external;

(:~
 : Converts a binary value (xs:base64Binary) to a string using the platform default encoding.
 : @param $binary The binary value to convert
 :)
declare function util:binary-to-string($binary as xs:base64Binary) as xs:string external;

(:~
 : Converts a binary value to a string using the specified encoding.
 : @param $binary The binary value to convert
 : @param $encoding The character encoding (e.g. "UTF-8")
 :)
declare function util:binary-to-string($binary as xs:base64Binary, $encoding as xs:string) as xs:string external;

(:~
 : Converts a string to a binary value (xs:base64Binary) using the platform default encoding.
 : @param $string The string to convert
 :)
declare function util:string-to-binary($string as xs:string) as xs:base64Binary external;

(:~
 : Converts a string to a binary value using the specified encoding.
 : @param $string The string to convert
 : @param $encoding The character encoding (e.g. "UTF-8")
 :)
declare function util:string-to-binary($string as xs:string, $encoding as xs:string) as xs:base64Binary external;

(:~
 : Retrieves a binary resource from the database.
 : @param $uri The URI of the binary resource
 :)
declare function util:binary-doc($uri as xs:string) as xs:base64Binary? external;

(:~
 : Returns true if a binary resource with the given URI exists.
 : @param $uri The URI to test
 :)
declare function util:binary-doc-available($uri as xs:string) as xs:boolean external;

(: ── Hashing ─────────────────────────────────────────────────────────────── :)

(:~
 : Computes a hash of the given data using the specified algorithm (MD5, SHA-1, SHA-256, etc.).
 : @param $data The data to hash (xs:string or xs:base64Binary)
 : @param $algorithm The hash algorithm name
 :)
declare function util:hash($data as item(), $algorithm as xs:string) as xs:string external;

(:~
 : Computes a hash of the given data and optionally returns it as Base64 instead of hex.
 : @param $data The data to hash
 : @param $algorithm The hash algorithm name
 : @param $base64 If true, returns Base64; otherwise hex
 :)
declare function util:hash($data as item(), $algorithm as xs:string, $base64 as xs:boolean) as xs:string external;

(:~
 : Computes the MD5 hash of the given string.
 : @param $string The string to hash
 :)
declare function util:md5($string as xs:string) as xs:string external;

(:~
 : Computes the SHA-1 hash of the given string.
 : @param $string The string to hash
 :)
declare function util:sha1($string as xs:string) as xs:string external;

(: ── Identifiers ─────────────────────────────────────────────────────────── :)

(:~
 : Returns a new UUID as a string.
 :)
declare function util:uuid() as xs:string external;

(:~
 : Returns a UUID derived deterministically from the given name string.
 : @param $name The name from which to derive the UUID
 :)
declare function util:uuid($name as xs:string) as xs:string external;

(:~
 : Returns a random number between 0 and 1.
 :)
declare function util:random() as xs:double external;

(:~
 : Returns a random integer between 0 (inclusive) and max (exclusive).
 : @param $max The upper bound (exclusive)
 :)
declare function util:random($max as xs:integer) as xs:integer external;

(: ── Document & Node Utilities ───────────────────────────────────────────── :)

(:~
 : Returns the database name (last path component) of the collection containing the given node.
 : @param $node The node whose collection name to return
 :)
declare function util:collection-name($node as node()) as xs:string? external;

(:~
 : Returns the database name of the document containing the given node.
 : @param $node The node whose document name to return
 :)
declare function util:document-name($node as node()) as xs:string? external;

(:~
 : Returns the internal node ID used by the eXist storage layer.
 : @param $node The node
 :)
declare function util:node-id($node as node()) as xs:string external;

(:~
 : Retrieves a node by its internal ID within a document.
 : @param $document The document node
 : @param $node-id The internal node ID
 :)
declare function util:node-by-id($document as document-node(), $node-id as xs:string) as node()? external;

(:~
 : Returns the XPath expression that uniquely identifies the given node.
 : @param $node The node
 :)
declare function util:node-xpath($node as node()) as xs:string? external;

(:~
 : Returns the absolute resource ID of a node (database-wide unique identifier).
 : @param $node The node
 :)
declare function util:absolute-resource-id($node as node()) as xs:integer external;

(:~
 : Returns the resource identified by an absolute resource ID.
 : @param $resource-id The absolute resource ID
 :)
declare function util:get-resource-by-absolute-id($resource-id as xs:integer) as node()? external;

(:~
 : Creates a deep copy of the given node, detaching it from the database.
 : @param $node The node to copy
 :)
declare function util:deep-copy($node as node()) as node() external;

(: ── Index Utilities ─────────────────────────────────────────────────────── :)

(:~
 : Returns all index keys for the given nodes.
 : @param $nodes The nodes to inspect
 : @param $function The callback function to call for each key
 :)
declare function util:index-keys($nodes as node()*, $function as function(*)) as item()* external;

(:~
 : Returns index keys from a named index for the given nodes.
 : @param $nodes The nodes to inspect
 : @param $start-value Start of the key range
 : @param $function The callback function
 : @param $max-number Maximum number of keys to return
 : @param $index The index type ("range", "lucene", etc.)
 :)
declare function util:index-keys($nodes as node()*, $start-value as xs:anyAtomicType?, $function as function(*), $max-number as xs:integer, $index as xs:string) as item()* external;

(:~
 : Returns the QName-based index keys for the given nodes.
 : @param $nodes The nodes
 : @param $qname The QName used as index key
 :)
declare function util:qname-index-lookup($nodes as node()*, $qname as xs:QName) as node()* external;

(:~
 : Returns the number of index entries for the given key in a node set.
 : @param $nodes The indexed nodes
 : @param $key The index key value
 :)
declare function util:index-key-occurrences($nodes as node()*, $key as xs:anyAtomicType) as xs:integer external;

(: ── Logging ─────────────────────────────────────────────────────────────── :)

(:~
 : Logs a message to the eXist log at the given priority (debug, info, warn, error).
 : @param $priority The log priority
 : @param $message The message to log
 :)
declare function util:log($priority as xs:string, $message as item()*) as empty-sequence() external;

(:~
 : Writes a value to stdout (for debugging purposes).
 : @param $item The item to write
 :)
declare function util:log-system-out($item as item()*) as empty-sequence() external;

(:~
 : Writes a value to stderr (for debugging purposes).
 : @param $item The item to write
 :)
declare function util:log-system-err($item as item()*) as empty-sequence() external;

(: ── Function Utilities ──────────────────────────────────────────────────── :)

(:~
 : Returns a function reference for the function with the given name and arity.
 : @param $name The qualified name of the function
 : @param $arity The arity of the function
 :)
declare function util:function($name as xs:string, $arity as xs:integer) as function(*)? external;

(:~
 : Calls a function reference with the given arguments.
 : @param $func The function reference
 : @param $args The arguments to pass
 :)
declare function util:call($func as function(*), $args as item()*) as item()* external;

(:~
 : Returns a description (element) of the given function.
 : @param $function The function reference
 :)
declare function util:describe($function as function(*)) as element() external;

(:~
 : Inspects a function reference and returns its description as an element.
 : @param $function The function reference
 :)
declare function util:inspect-function($function as function(*)) as element() external;

(:~
 : Returns all functions defined in the given module namespace.
 : @param $namespace-uri The namespace URI of the module
 :)
declare function util:list-functions($namespace-uri as xs:string) as function(*)* external;

(:~
 : Returns all built-in functions.
 :)
declare function util:builtin-functions() as function(*)* external;

(: ── Module Information ──────────────────────────────────────────────────── :)

(:~
 : Returns the namespace URI of the current module.
 :)
declare function util:get-module-uri() as xs:anyURI? external;

(:~
 : Returns information about the module loaded at the given namespace URI.
 : @param $namespace-uri The namespace URI
 :)
declare function util:module-info($namespace-uri as xs:string) as element()? external;

(:~
 : Returns true if a module has been mapped to the given namespace URI in the config.
 : @param $namespace-uri The namespace URI to check
 :)
declare function util:is-module-mapped($namespace-uri as xs:string) as xs:boolean external;

(:~
 : Returns true if a module has been registered (loaded) for the given namespace URI.
 : @param $namespace-uri The namespace URI to check
 :)
declare function util:is-module-registered($namespace-uri as xs:string) as xs:boolean external;

(:~
 : Returns the file-system path of the mapped module for the given namespace URI.
 : @param $namespace-uri The namespace URI
 :)
declare function util:mapped-module($namespace-uri as xs:string) as xs:string? external;

(:~
 : Returns the file-system path of the registered module for the given namespace URI.
 : @param $namespace-uri The namespace URI
 :)
declare function util:registered-module($namespace-uri as xs:string) as xs:string? external;

(:~
 : Dynamically imports a module at runtime.
 : @param $namespace-uri The namespace URI of the module
 : @param $prefix The prefix to bind
 : @param $location The location URI of the module
 :)
declare function util:import-module($namespace-uri as xs:anyURI, $prefix as xs:string, $location as xs:anyURI) as empty-sequence() external;

(:~
 : Declares a namespace prefix at runtime.
 : @param $prefix The namespace prefix
 : @param $namespace-uri The namespace URI
 :)
declare function util:declare-namespace($prefix as xs:string, $namespace-uri as xs:anyURI) as empty-sequence() external;

(:~
 : Declares an XQuery option at runtime.
 : @param $option The option name (as xs:QName)
 : @param $value The option value
 :)
declare function util:declare-option($option as xs:string, $value as xs:string) as empty-sequence() external;

(: ── Concurrency ─────────────────────────────────────────────────────────── :)

(:~
 : Acquires an exclusive lock on the given node and evaluates the expression.
 : @param $node The node to lock
 : @param $expression The expression to evaluate while the lock is held
 :)
declare function util:exclusive-lock($node as node()*, $expression as item()*) as item()* external;

(:~
 : Acquires a shared (read) lock on the given node and evaluates the expression.
 : @param $node The node to lock
 : @param $expression The expression to evaluate while the lock is held
 :)
declare function util:shared-lock($node as node()*, $expression as item()*) as item()* external;

(:~
 : Pauses execution for the given number of milliseconds.
 : @param $delay The delay in milliseconds
 :)
declare function util:wait($delay as xs:integer) as empty-sequence() external;

(: ── Miscellaneous ───────────────────────────────────────────────────────── :)

(:~
 : Returns the value of the named system property (Java system property).
 : @param $name The property name
 :)
declare function util:system-property($name as xs:string) as xs:string? external;

(:~
 : Returns the current system time in milliseconds since the epoch.
 :)
declare function util:system-time() as xs:long external;

(:~
 : Returns a string describing the sequence type of the given item.
 : @param $item The item to inspect
 :)
declare function util:get-sequence-type($item as item()*) as xs:string external;

(:~
 : Repeats the string $string $count times.
 : @param $string The string to repeat
 : @param $count The number of repetitions
 :)
declare function util:string-pad($string as xs:string?, $count as xs:integer) as xs:string external;
