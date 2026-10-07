module namespace jndi = "http://exist-db.org/xquery/jndi";

(:~
 : Closes a JNDI Context
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 :)
declare function jndi:close-context($directory-context as xs:integer) as empty-sequence() external;

(:~
 : Create a JNDI Directory entry.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $dn The Distinguished Name
 : @param $attributes The entry attributes to be set in the form &lt;attributes>&lt;attribute name="" value=""/>&lt;/attributes>. You can also optionally specify ordered="true" for an attribute.
 :)
declare function jndi:create($directory-context as xs:integer, $dn as xs:string, $attributes as element()) as empty-sequence() external;

(:~
 : Delete a JNDI Directory entry.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $dn The Distinguished Name
 :)
declare function jndi:delete($directory-context as xs:integer, $dn as xs:string) as empty-sequence() external;

(:~
 : Opens a JNDI Directory Context.
 : @param $properties The JNDI Directory Context environment properties to be set in the form &lt;properties>&lt;property name="" value=""/>&lt;/properties>.
 : @return the directory context handle
 :)
declare function jndi:get-dir-context($properties as element()?) as xs:long? external;

(:~
 : Modify a JNDI Directory entry.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $dn The Distinguished Name
 : @param $attributes The entry attributes to be set in the form &lt;attributes>&lt;attribute name="" value="" operation="add | replace | remove"/>&lt;/attributes>. You can also optionally specify ordered="true" for an attribute.
 :)
declare function jndi:modify($directory-context as xs:integer, $dn as xs:string, $attributes as element()) as empty-sequence() external;

(:~
 : Rename a JNDI Directory entry.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $old-dn The Distinguished Name to rename
 : @param $new-dn The new Distinguished Name
 :)
declare function jndi:rename($directory-context as xs:integer, $old-dn as xs:string, $new-dn as xs:string) as empty-sequence() external;

(:~
 : Searches a JNDI Directory by attributes.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $dn The Distinguished Name
 : @param $search-attributes The search attributes in the form &lt;attributes>&lt;attribute name="" value=""/>&lt;/attributes>.
 : @return the search results in DSML format
 :)
declare function jndi:search($directory-context as xs:integer, $dn as xs:string, $search-attributes as element()) as node()? external;

(:~
 : Searches a JNDI Directory by filter.
 : @param $directory-context The directory context handle from a jndi:get-dir-context() call
 : @param $dn The Distinguished Name
 : @param $filter The filter. The format and interpretation of filter follows RFC 2254 with the following interpretations for 'attr' and 'value' mentioned in the RFC. 'attr' is the attribute's identifier. 'value' is the string represention the attribute's value. The translation of this string representation into the attribute's value is directory-specific.
 : @param $scope The scope, which has a value of 'object', 'onelevel' or 'subtree'
 : @return the search results in DSML format
 :)
declare function jndi:search(
	$directory-context as xs:integer,
	$dn as xs:string,
	$filter as xs:string,
	$scope as xs:string
) as node()? external;
