module namespace session = "http://exist-db.org/xquery/session";

(:~
 : Creates a new HTTP session for the current request, or returns the existing one.
 :)
declare function session:create() as xs:boolean external;

(:~
 : Removes all attributes from the current session.
 :)
declare function session:clear() as empty-sequence() external;

(:~
 : Encodes the given URL by appending the session ID if cookies are not supported.
 : @param $url The URL to encode
 :)
declare function session:encode-url($url as xs:anyURI) as xs:anyURI external;

(:~
 : Returns the session ID of the current session.
 :)
declare function session:get-id() as xs:string? external;

(:~
 : Returns the value of the named session attribute.
 : @param $name The attribute name
 :)
declare function session:get-attribute($name as xs:string) as item()* external;

(:~
 : Stores a value under the named attribute in the current session.
 : @param $name The attribute name
 : @param $value The value to store
 :)
declare function session:set-attribute($name as xs:string, $value as item()*) as empty-sequence() external;

(:~
 : Removes the named attribute from the current session.
 : @param $name The attribute name
 :)
declare function session:remove-attribute($name as xs:string) as empty-sequence() external;

(:~
 : Returns all attribute names stored in the current session.
 :)
declare function session:get-attribute-names() as xs:string* external;

(:~
 : Returns the time at which the current session was created, as an xs:long (milliseconds since epoch).
 :)
declare function session:get-creation-time() as xs:long external;

(:~
 : Returns the time the client last sent a request with this session, as an xs:long (milliseconds since epoch).
 :)
declare function session:get-last-accessed-time() as xs:long external;

(:~
 : Returns the maximum inactivity interval in seconds before the session is invalidated.
 :)
declare function session:get-max-inactive-interval() as xs:integer external;

(:~
 : Sets the maximum inactivity interval in seconds before the session is invalidated.
 : @param $interval The interval in seconds
 :)
declare function session:set-max-inactive-interval($interval as xs:integer) as empty-sequence() external;

(:~
 : Invalidates the current session and unbinds any objects associated with it.
 :)
declare function session:invalidate() as empty-sequence() external;

(:~
 : Sets the authenticated user for the current session.
 : @param $user The username
 : @param $password The password
 :)
declare function session:set-current-user($user as xs:string, $password as xs:string) as xs:boolean external;

(:~
 : Returns true if a session object exists in the current context.
 :)
declare function session:get-exists() as xs:boolean external;

(:~
 : Returns true if the current session was created during the current request.
 :)
declare function session:is-new() as xs:boolean external;
