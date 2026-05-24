module namespace xmldb = "http://exist-db.org/xquery/xmldb";

(: ── Collection Management ───────────────────────────────────────────────── :)

(:~
 : Creates a new collection as a child of the given parent collection.
 : @param $collection-uri The parent collection URI
 : @param $name The name for the new collection
 :)
declare function xmldb:create-collection($collection-uri as xs:string, $name as xs:string) as xs:string? external;

(:~
 : Returns true if a collection with the given URI exists.
 : @param $uri The collection URI to test
 :)
declare function xmldb:collection-available($uri as xs:string) as xs:boolean external;

(:~
 : Returns the names of all child collections of the given collection.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:get-child-collections($collection-uri as xs:string) as xs:string* external;

(:~
 : Returns the names of all resources (documents) in the given collection.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:get-child-resources($collection-uri as xs:string) as xs:string* external;

(:~
 : Returns the number of resources in the given collection.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:get-resource-count($collection-uri as xs:string) as xs:integer external;

(:~
 : Copies a collection to a new location.
 : @param $source-collection The source collection URI
 : @param $destination-collection The target parent collection URI
 :)
declare function xmldb:copy-collection($source-collection as xs:string, $destination-collection as xs:string) as xs:string? external;

(:~
 : Returns all resources in a collection including those in subcollections (xcollection).
 : @param $collection-uri The root collection URI
 :)
declare function xmldb:xcollection($collection-uri as xs:string) as node()* external;

(: ── Document Storage ────────────────────────────────────────────────────── :)

(:~
 : Stores an XML document or string in the given collection under the given name.
 : @param $collection-uri The target collection URI
 : @param $name The document name
 : @param $content The document content (node or string)
 :)
declare function xmldb:store($collection-uri as xs:string, $name as xs:string, $content as item()) as xs:string? external;

(:~
 : Stores a document in the given collection with an explicit MIME type.
 : @param $collection-uri The target collection URI
 : @param $name The document name
 : @param $content The document content
 : @param $mime-type The MIME type
 :)
declare function xmldb:store($collection-uri as xs:string, $name as xs:string, $content as item(), $mime-type as xs:string) as xs:string? external;

(:~
 : Stores a binary resource in the given collection.
 : @param $collection-uri The target collection URI
 : @param $resource-name The resource name
 : @param $content The binary content (xs:base64Binary)
 : @param $mime-type The MIME type
 :)
declare function xmldb:store-as-binary($collection-uri as xs:string, $resource-name as xs:string, $content as xs:base64Binary, $mime-type as xs:string) as xs:string? external;

(:~
 : Returns true if a document with the given URI is available in the database.
 : @param $uri The document URI
 :)
declare function xmldb:document-available($uri as xs:string) as xs:boolean external;

(: ── Document & Resource Operations ─────────────────────────────────────── :)

(:~
 : Copies a resource from one collection to another.
 : @param $source-collection The source collection URI
 : @param $source-resource The source resource name
 : @param $destination-collection The target collection URI
 : @param $destination-resource The target resource name
 :)
declare function xmldb:copy-resource($source-collection as xs:string, $source-resource as xs:string, $destination-collection as xs:string, $destination-resource as xs:string) as xs:string? external;

(:~
 : Moves a resource to a different collection, optionally renaming it.
 : @param $source-collection The source collection URI
 : @param $source-resource The source resource name
 : @param $destination-collection The target collection URI
 :)
declare function xmldb:move($source-collection as xs:string, $source-resource as xs:string, $destination-collection as xs:string) as empty-sequence() external;

(:~
 : Moves a resource to a different collection with a new name.
 : @param $source-collection The source collection URI
 : @param $source-resource The source resource name
 : @param $destination-collection The target collection URI
 : @param $destination-resource The target resource name
 :)
declare function xmldb:move($source-collection as xs:string, $source-resource as xs:string, $destination-collection as xs:string, $destination-resource as xs:string) as empty-sequence() external;

(:~
 : Renames a resource within a collection.
 : @param $collection-uri The collection URI
 : @param $resource The current resource name
 : @param $new-name The new resource name
 :)
declare function xmldb:rename($collection-uri as xs:string, $resource as xs:string, $new-name as xs:string) as empty-sequence() external;

(:~
 : Removes a collection from the database.
 : @param $collection-uri The URI of the collection to remove
 :)
declare function xmldb:remove($collection-uri as xs:string) as empty-sequence() external;

(:~
 : Removes a resource from the given collection.
 : @param $collection-uri The collection URI
 : @param $resource The resource name to remove
 :)
declare function xmldb:remove($collection-uri as xs:string, $resource as xs:string) as empty-sequence() external;

(: ── Metadata ─────────────────────────────────────────────────────────────── :)

(:~
 : Returns the creation date-time of a collection.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:created($collection-uri as xs:string) as xs:dateTime? external;

(:~
 : Returns the creation date-time of a resource in a collection.
 : @param $collection-uri The collection URI
 : @param $resource The resource name
 :)
declare function xmldb:created($collection-uri as xs:string, $resource as xs:string) as xs:dateTime? external;

(:~
 : Returns the last-modified date-time of a collection.
 : @param $collection-uri The collection URI
 :)
declare function xmldb:last-modified($collection-uri as xs:string) as xs:dateTime? external;

(:~
 : Returns the last-modified date-time of a resource.
 : @param $collection-uri The collection URI
 : @param $resource The resource name
 :)
declare function xmldb:last-modified($collection-uri as xs:string, $resource as xs:string) as xs:dateTime? external;

(:~
 : Returns the MIME type of a resource.
 : @param $uri The resource URI
 :)
declare function xmldb:get-mime-type($uri as xs:string) as xs:string? external;

(:~
 : Sets the MIME type of a resource.
 : @param $uri The resource URI
 : @param $mime-type The new MIME type
 :)
declare function xmldb:set-mime-type($uri as xs:string, $mime-type as xs:string) as empty-sequence() external;

(:~
 : Returns the size in bytes of a resource.
 : @param $collection-uri The collection URI
 : @param $resource The resource name
 :)
declare function xmldb:size($collection-uri as xs:string, $resource as xs:string) as xs:long external;

(:~
 : Returns all documents modified since the given date, searching recursively.
 : @param $collection-uri The root collection URI
 : @param $since The date-time threshold
 : @param $include-subcollections If true, searches subcollections recursively
 :)
declare function xmldb:find-last-modified-since($collection-uri as xs:string, $since as xs:dateTime, $include-subcollections as xs:boolean) as xs:string* external;

(:~
 : Returns resources in the collection whose names match the given regex pattern.
 : @param $collection-uri The collection URI
 : @param $pattern The regex pattern
 :)
declare function xmldb:find-in-collection($collection-uri as xs:string, $pattern as xs:string) as xs:string* external;

(: ── URI Encoding ─────────────────────────────────────────────────────────── :)

(:~
 : Encodes a collection URI by percent-encoding special characters.
 : @param $collection-uri The URI to encode
 :)
declare function xmldb:encode($collection-uri as xs:string) as xs:string external;

(:~
 : Encodes a URI by percent-encoding special characters.
 : @param $uri The URI to encode
 :)
declare function xmldb:encode-uri($uri as xs:string) as xs:anyURI external;

(:~
 : Decodes a percent-encoded URI.
 : @param $uri The encoded URI
 :)
declare function xmldb:decode-uri($uri as xs:anyURI) as xs:string external;

(: ── Indexing ─────────────────────────────────────────────────────────────── :)

(:~
 : Rebuilds all indexes for the given collection.
 : @param $collection-uri The collection URI to reindex
 :)
declare function xmldb:reindex($collection-uri as xs:string) as xs:boolean external;

(:~
 : Defragments the given collection to free unused disk space.
 : @param $collection-uri The collection URI to defragment
 :)
declare function xmldb:defragment($collection-uri as xs:string) as xs:boolean external;

(: ── Authentication ───────────────────────────────────────────────────────── :)

(:~
 : Authenticates as the given user against the given collection and returns true on success.
 : @param $collection-uri The collection URI used to determine the database
 : @param $user The username
 : @param $password The password
 :)
declare function xmldb:authenticate($collection-uri as xs:string, $user as xs:string, $password as xs:string) as xs:boolean external;

(:~
 : Logs in as the given user, optionally creating a session.
 : @param $collection-uri The collection URI
 : @param $user The username
 : @param $password The password
 :)
declare function xmldb:login($collection-uri as xs:string, $user as xs:string, $password as xs:string) as xs:boolean external;

(:~
 : Logs in as the given user, optionally creating a session.
 : @param $collection-uri The collection URI
 : @param $user The username
 : @param $password The password
 : @param $create-session If true, creates an HTTP session
 :)
declare function xmldb:login($collection-uri as xs:string, $user as xs:string, $password as xs:string, $create-session as xs:boolean) as xs:boolean external;

(:~
 : Returns the username of the currently authenticated user.
 :)
declare function xmldb:get-current-user() as xs:string external;

(:~
 : Returns true if the given user has DBA (administrator) privileges.
 : @param $user The username
 :)
declare function xmldb:is-admin-user($user as xs:string) as xs:boolean external;

(:~
 : Returns true if the given username is a DBA.
 : @param $user The username
 :)
declare function xmldb:is-dba($user as xs:string) as xs:boolean external;

(:~
 : Returns true if the given user account exists.
 : @param $user-name The username to check
 :)
declare function xmldb:exists-user($user-name as xs:string) as xs:boolean external;

(:~
 : Returns all group names in the database.
 :)
declare function xmldb:get-groups() as xs:string* external;

(:~
 : Returns the groups the given user belongs to.
 : @param $user-name The username
 :)
declare function xmldb:get-user-groups($user-name as xs:string) as xs:string* external;

(: ── XUpdate ─────────────────────────────────────────────────────────────── :)

(:~
 : Applies an XUpdate script to the given collection or document.
 : @param $collection-or-document-uri The target URI
 : @param $xupdate The XUpdate commands as a string
 :)
declare function xmldb:xupdate($collection-or-document-uri as xs:string, $xupdate as xs:string) as xs:integer external;

(:~
 : Touches a resource, updating its last-modified timestamp to the current time.
 : @param $collection-uri The collection URI
 : @param $resource The resource name
 :)
declare function xmldb:touch($collection-uri as xs:string, $resource as xs:string) as empty-sequence() external;
