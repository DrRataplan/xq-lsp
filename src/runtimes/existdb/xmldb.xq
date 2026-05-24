module namespace xmldb = "http://exist-db.org/xquery/xmldb";

(:~
 : Check if the user, $user-id, can authenticate against the database
 : collection $collection-uri. The function simply tries to read the collection
 : $collection-uri, using the credentials $user-id and $password. It returns
 : true if the authentication succeeds, false otherwise.
 : @param $collection-uri The collection URI
 : @param $user-id The user-id
 : @param $password The password
 :)
declare function xmldb:authenticate(
	$collection-uri as xs:string,
	$user-id as xs:string?,
	$password as xs:string?
) as xs:boolean external;

(:~
 : Removes the user lock on the resource $resource in the collection
 : $collection-uri. If no lock is in place, the empty sequence is returned.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @return the user id of the previous lock owner, otherwise if not locked the empty sequence
 :)
declare function xmldb:clear-lock($collection-uri as xs:string, $resource as xs:string) as xs:string? external;

(:~
 : Returns true() if the collection $collection-uri exists and is available,
 : otherwise false().
 : @param $collection-uri The collection URI
 :)
declare function xmldb:collection-available($collection-uri as xs:string) as xs:boolean external;

(:~
 : Copy the collection $source-collection-uri to the collection
 : $target-collection-uri.
 : @param $source-collection-uri The source URI
 : @param $target-collection-uri The target URI
 : @return The path to the newly copied collection
 :)
declare function xmldb:copy-collection(
	$source-collection-uri as xs:string,
	$target-collection-uri as xs:string
) as xs:string external;

(:~
 : Copy the collection $source-collection-uri to the collection
 : $target-collection-uri.
 : @param $source-collection-uri The source URI
 : @param $target-collection-uri The target URI
 : @param $preserve Cause the copy process to preserve the following attributes of each source in the copy: modification time, file mode, user ID, and group ID, as allowed by permissions. Access Control Lists (ACLs) will also be preserved
 : @return The path to the newly copied collection
 :)
declare function xmldb:copy-collection(
	$source-collection-uri as xs:string,
	$target-collection-uri as xs:string,
	$preserve as xs:boolean
) as xs:string external;

(:~
 : Copy the resource $source-collection-uri/$source-resource-name to collection
 : $target-collection-uri/$target-resource-name. If the $target-resource-name
 : is omitted, the $source-resource-name will be used.
 : @param $source-collection-uri The source URI
 : @param $source-resource-name The name of the resource to copy
 : @param $target-collection-uri The target URI
 : @param $target-resource-name The name of the resource for the target
 : @return The path to the newly copied resource
 :)
declare function xmldb:copy-resource(
	$source-collection-uri as xs:string,
	$source-resource-name as xs:string,
	$target-collection-uri as xs:string,
	$target-resource-name as xs:string?
) as xs:string external;

(:~
 : Copy the resource $source-collection-uri/$source-resource-name to collection
 : $target-collection-uri/$target-resource-name. If the $target-resource-name
 : is omitted, the $source-resource-name will be used.
 : @param $source-collection-uri The source URI
 : @param $source-resource-name The name of the resource to copy
 : @param $target-collection-uri The target URI
 : @param $target-resource-name The name of the resource for the target
 : @param $preserve Cause the copy process to preserve the following attributes of each source in the copy: modification time, file mode, user ID, and group ID, as allowed by permissions. Access Control Lists (ACLs) will also be preserved
 : @return The path to the newly copied resource
 :)
declare function xmldb:copy-resource(
	$source-collection-uri as xs:string,
	$source-resource-name as xs:string,
	$target-collection-uri as xs:string,
	$target-resource-name as xs:string?,
	$preserve as xs:boolean
) as xs:string external;

(:~
 : Create a new collection with name $new-collection as a child of
 : $target-collection-uri. Returns the path to the new collection if
 : successfully created, otherwise the empty sequence.
 : @param $target-collection-uri The target collection URI
 : @param $new-collection The name of the new collection to create
 : @return the path to the new collection if successfully created, otherwise the empty sequence
 :)
declare function xmldb:create-collection(
	$target-collection-uri as xs:string,
	$new-collection as xs:string
) as xs:string? external;

(:~
 : Returns the creation date of the collection $collection-uri.
 : @param $collection-uri The collection URI
 : @return the creation date
 :)
declare function xmldb:created($collection-uri as xs:string) as xs:dateTime external;

(:~
 : Returns the creation date of the resource $resource in $collection-uri.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @return the creation date
 :)
declare function xmldb:created($collection-uri as xs:string, $resource as xs:string) as xs:dateTime external;

(:~
 : Decodes the string $string such that any percent encoded octets will be
 : translated to their decoded UTF-8 representation.
 : @param $string The input string
 : @return the decoded string
 :)
declare function xmldb:decode($string as xs:string) as xs:string external;

(:~
 : Decodes the URI $uri such that any percent encoded octets will be translated
 : to their decoded UTF-8 representation.
 : @param $uri The URI
 : @return the decoded $uri as xs:string
 :)
declare function xmldb:decode-uri($uri as xs:anyURI) as xs:string external;

(:~
 : Start a defragmentation run on each document which has a node in $nodes.
 : Fragmentation may occur if nodes are inserted into a document using XQuery
 : update extensions. Please note that defragmenting a document changes its
 : internal structure, so any references to this document will become invalid,
 : in particular, variables pointing to some nodes in the document.
 : @param $nodes The sequence of nodes from the documents to defragment
 :)
declare function xmldb:defragment($nodes as node()+) as empty-sequence() external;

(:~
 : Start a defragmentation run on each document which has a node in $nodes.
 : Fragmentation may occur if nodes are inserted into a document using XQuery
 : update extensions. The second argument specifies the minimum number of
 : fragmented pages which should be in a document before it is considered for
 : defragmentation. Please note that defragmenting a document changes its
 : internal structure, so any references to this document will become invalid,
 : in particular, variables pointing to some nodes in the document.
 : @param $nodes The sequence of nodes from the documents to defragment
 : @param $integer The minimum number of fragmented pages required before defragmenting
 :)
declare function xmldb:defragment($nodes as node()+, $integer as xs:integer) as empty-sequence() external;

(:~
 : Returns the user-id of the user that holds a write lock on the resource
 : $resource in the collection $collection-uri. If no lock is in place, the
 : empty sequence is returned.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @return the user id of the lock owner, otherwise if not locked the empty sequence
 :)
declare function xmldb:document-has-lock($collection-uri as xs:string, $resource as xs:string) as xs:string? external;

(:~
 : Encodes the string $string such that it will be a valid collection or
 : resource path. Provides similar functionality to java's URLEncoder.encode()
 : function, with some enhancements.
 : @param $string The input string
 : @return the URL encoded string
 :)
declare function xmldb:encode($string as xs:string) as xs:string external;

(:~
 : Encodes the string $string such that it will be a valid collection or
 : resource path. Provides similar functionality to java's URLEncoder.encode()
 : function, with some enhancements. Returns an xs:anyURI object representing a
 : valid XmldbURI
 : @param $string The input string
 : @return the XmldbURI encoded from $string
 :)
declare function xmldb:encode-uri($string as xs:string) as xs:anyURI external;

(:~
 : Filters the given node set to only include nodes from resources which were
 : modified since the specified date time.
 : @param $node-set A node set
 : @param $since Date
 : @return the filtered node set.
 :)
declare function xmldb:find-last-modified-since($node-set as node()*, $since as xs:dateTime) as node()* external;

(:~
 : Filters the given node set to only include nodes from resources which were
 : modified until the specified date time.
 : @param $node-set A node set
 : @param $until Date
 : @return the filtered node set.
 :)
declare function xmldb:find-last-modified-until($node-set as node()*, $until as xs:dateTime) as node()* external;

(:~
 : Returns the names of the child collections in the collection
 : $collection-uri.
 : @param $collection-uri The collection URI
 : @return the sequence of child collection names
 :)
declare function xmldb:get-child-collections($collection-uri as xs:string) as xs:string* external;

(:~
 : Returns the names of the child resources in collection $collection-uri.
 : @param $collection-uri The collection URI
 : @return the sequence of resource names
 :)
declare function xmldb:get-child-resources($collection-uri as item()) as xs:string* external;

(:~
 : Returns the MIME type if available of the resource $resource-uri, otherwise
 : the empty sequence.
 : @param $resource-uri The resource URI
 : @return the mime-type if available, otherwise the empty sequence
 :)
declare function xmldb:get-mime-type($resource-uri as xs:string) as xs:string? external;

(:~
 : Returns the last-modification date of resource $resource in collection
 : $collection-uri.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @return the last modification date
 :)
declare function xmldb:last-modified($collection-uri as item(), $resource as xs:string) as xs:dateTime? external;

(:~
 : Login the user, $user-id, and set it as the owner of the currently executing
 : XQuery. It returns true if the authentication succeeds, false otherwise. If
 : called from a HTTP context the login is cached for the lifetime of the HTTP
 : session and may be used for any XQuery run in that session. If an HTTP
 : session does not already exist, none will be created.
 : @param $collection-uri The collection URI
 : @param $user-id The user-id
 : @param $password The password
 :)
declare function xmldb:login(
	$collection-uri as xs:string,
	$user-id as xs:string?,
	$password as xs:string?
) as xs:boolean external;

(:~
 : Login the user, $user-id, and set it as the owner of the currently executing
 : XQuery. It returns true() if the authentication succeeds, false() otherwise.
 : If called from a HTTP context the login is cached for the lifetime of the
 : HTTP session and may be used for any XQuery run in that session.
 : $create-session specifies whether to create an HTTP session on successful
 : authentication or not. If $create-session is false() or the empty sequence
 : no session will be created if one does not already exist.
 : @param $collection-uri The collection URI
 : @param $user-id The user-id
 : @param $password The password
 :)
declare function xmldb:login(
	$collection-uri as xs:string,
	$user-id as xs:string?,
	$password as xs:string?,
	$create-session as xs:boolean?
) as xs:boolean external;

(:~
 : Looks for collection names in the collection index that match the provided
 : regexp
 : @param $regexp The expression to use for matching collection names
 : @return The names of the collections that match the expression
 :)
declare function xmldb:match-collection($regexp as xs:string) as xs:string* external;

(:~
 : Moves the collection $source-collection-uri into the collection
 : $target-collection-uri.
 :)
declare function xmldb:move() as empty-sequence() external;

(:~
 : Registers an XMLDB driver class with the XMLDB Database Manager. This is
 : only required if you want to access a database instance different from the
 : one that executes the XQuery.
 : @param $driver The DB driver
 : @param $create-db The flag to create the db if it does not exist
 :)
declare function xmldb:register-database($driver as xs:string, $create-db as xs:boolean) as xs:boolean external;

(:~
 : Reindex collection $collection-uri.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:reindex($collection-uri as xs:string) as xs:boolean external;

(:~
 : Reindex: if $arg2 is "all", "fulltext", or "vector", reindex collection with
 : that scope; otherwise reindex document $arg2 from $collection-uri.
 : @param $collection-uri The collection URI
 : @param $doc-uri-or-mode Document name, or mode: "all", "fulltext", "vector"
 :)
declare function xmldb:reindex($collection-uri as xs:string, $doc-uri-or-mode as xs:string) as xs:boolean external;

(:~
 : Reindex document $doc-uri from $collection-uri with scope $mode.
 : @param $collection-uri The collection URI
 : @param $doc-uri The document URI
 : @param $mode Reindex scope: "all", "fulltext", or "vector"
 :)
declare function xmldb:reindex(
	$collection-uri as xs:string,
	$doc-uri as xs:string,
	$mode as xs:string
) as xs:boolean external;

(:~
 : Removes the collection $collection-uri and its contents from the database.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:remove($collection-uri as xs:string) as empty-sequence() external;

(:~
 : Removes the resource $resource from the collection $collection-uri.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 :)
declare function xmldb:remove($collection-uri as xs:string, $resource as xs:string) as empty-sequence() external;

(:~
 : Renames the collection $source-collection-uri with new name
 : $new-collection-name.
 : @param $source-collection-uri The source collection URI
 : @param $new-collection-name The new collection name
 :)
declare function xmldb:rename(
	$source-collection-uri as xs:string,
	$new-collection-name as xs:string
) as empty-sequence() external;

(:~
 : Renames the resource $resource in collection $collection-uri with new name
 : $new-resource-name.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @param $new-resource-name The new resource name
 :)
declare function xmldb:rename(
	$collection-uri as xs:string,
	$resource as xs:string,
	$new-resource-name as xs:string
) as empty-sequence() external;

(:~
 : Set the MIME type of the resource $resource-uri.
 : @param $resource-uri The resource URI
 : @param $mime-type The new mime-type, use empty sequence to set default value.
 :)
declare function xmldb:set-mime-type($resource-uri as xs:anyURI, $mime-type as xs:string?) as empty-sequence() external;

(:~
 : Returns the estimated size of the resource $resource (in bytes) in the
 : collection $collection-uri. The estimation is based on the number of pages
 : occupied by the resource. If the document is serialized back to a string,
 : its size may be different, since parts of the structural information are
 : stored in compressed form.
 : @param $collection-uri The collection URI
 : @param $resource The resource
 : @return the size of the pages, occupied by the resource, in bytes
 :)
declare function xmldb:size($collection-uri as xs:string, $resource as xs:string) as xs:long external;

(:~
 : Stores a new resource into the database. The resource is stored in the
 : collection $collection-uri with the name $resource-name. The contents
 : $contents, is either a node, an xs:string, a Java file object or an
 : xs:anyURI. A node will be serialized to SAX. It becomes the root node of the
 : new document. If $contents is of type xs:anyURI, the resource is loaded from
 : that URI. Returns the path to the new document if successfully stored,
 : otherwise an XPathException is thrown.
 : @param $collection-uri The collection URI
 : @param $resource-name The resource name
 : @param $contents The contents
 :)
declare function xmldb:store(
	$collection-uri as xs:string,
	$resource-name as xs:string?,
	$contents as item()
) as item()* external;

(:~
 : Stores a new resource into the database. The resource is stored in the
 : collection $collection-uri with the name $resource-name. The contents
 : $contents, is either a node, an xs:string, a Java file object or an
 : xs:anyURI. A node will be serialized to SAX. It becomes the root node of the
 : new document. If $contents is of type xs:anyURI, the resource is loaded from
 : that URI. Returns the path to the new document if successfully stored,
 : otherwise an XPathException is thrown.
 : @param $collection-uri The collection URI
 : @param $resource-name The resource name
 : @param $contents The contents
 : @param $mime-type The mime type
 :)
declare function xmldb:store(
	$collection-uri as xs:string,
	$resource-name as xs:string?,
	$contents as item(),
	$mime-type as xs:string
) as item()* external;

(:~
 : Stores a new resource into the database. The resource is stored in the
 : collection $collection-uri with the name $resource-name. The contents
 : $contents, is either a node, an xs:string, a Java file object or an
 : xs:anyURI. A node will be serialized to SAX. It becomes the root node of the
 : new document. If $contents is of type xs:anyURI, the resource is loaded from
 : that URI. Returns the path to the new document if successfully stored,
 : otherwise an XPathException is thrown.
 : @param $collection-uri The collection URI
 : @param $resource-name The resource name
 : @param $contents The contents
 :)
declare function xmldb:store-as-binary(
	$collection-uri as xs:string,
	$resource-name as xs:string?,
	$contents as item()
) as item()* external;

declare function xmldb:store-files-from-pattern() as item()* external;

(:~
 : Sets the modification time of a resource to the current system time. If not
 : resource does not exist it is not created.
 :)
declare function xmldb:touch() as item()* external;

(:~
 : Sets the modification time of a resource. If not resource does not exist it
 : is not created.
 : @param $modification-time The modification time to set on the resource
 :)
declare function xmldb:touch($modification-time as xs:dateTime) as item()* external;

(:~
 : Processes an XUpdate request, $modifications, against a collection
 : $collection-uri. The modifications are passed in a document conforming to
 : the XUpdate specification.
 : http://rx4rdf.liminalzone.org/xupdate-wd.html#N1a32e0 The function returns
 : the number of modifications caused by the XUpdate.
 : @param $collection-uri The collection URI
 : @param $modifications The XUpdate modifications to be processed
 : @return the number of modifications, as xs:integer, caused by the XUpdate
 :)
declare function xmldb:update($collection-uri as xs:string, $modifications as node()) as xs:integer external;

(:~
 : Returns the documents contained in the Collection specified in the input
 : sequence non-recursively, i.e. does not include document nodes found in
 : sub-collections. This is different to fn:collection() that returns documents
 : recursively.
 : @return The items from the specified collection excluding sub-collections
 :)
declare function xmldb:xcollection() as item()* external;

(:~
 : Returns the documents contained in the Collection specified in the input
 : sequence non-recursively, i.e. does not include document nodes found in
 : sub-collections. This is different to fn:collection() that returns documents
 : recursively.
 : @param $collection-uri The Collection URI
 : @return The items from the specified collection excluding sub-collections
 :)
declare function xmldb:xcollection($collection-uri as xs:string?) as item()* external;
