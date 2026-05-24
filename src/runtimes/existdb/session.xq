module namespace session = "http://exist-db.org/xquery/session";

(:~
 : Removes all attributes from the current HTTP session. Does NOT invalidate
 : the session.
 :)
declare function session:clear() as empty-sequence() external;

(:~
 : Initialize an HTTP session if not already present (and valid)
 :)
declare function session:create() as empty-sequence() external;

(:~
 : Encodes the specified URL with the current HTTP session-id.
 : @param $url The URL to encode
 : @return the encoded URL
 :)
declare function session:encode-url($url as xs:anyURI) as xs:anyURI external;

(:~
 : Returns whether a session object exists.
 : @return true if the session object exists
 :)
declare function session:exists() as xs:boolean external;

(:~
 : Returns an attribute stored in the current session object or an empty
 : sequence if the attribute cannot be found.
 : @param $name The session attribute name
 : @return the attribute value
 :)
declare function session:get-attribute($name as xs:string) as item()* external;

(:~
 : Returns a sequence containing the names of all session attributes defined
 : within the current HTTP session.
 : @return the list of attribute names
 :)
declare function session:get-attribute-names() as xs:string* external;

(:~
 : Returns the time when this session was created. If a session does not exist,
 : a new one is created. If the session is already invalidated, it returns
 : January 1, 1970 GMT
 : @return the date-time when the session was created
 :)
declare function session:get-creation-time() as xs:dateTime external;

(:~
 : Returns the ID of the current session or an empty sequence if there is no
 : session.
 : @return the session ID
 :)
declare function session:get-id() as xs:string? external;

(:~
 : Returns the last time the client sent a request associated with this
 : session. If a session does not exist, a new one is created. Actions that
 : your application takes, such as getting or setting a value associated with
 : the session, do not affect the access time. If the session is already
 : invalidated, it returns January 1, 1970 GMT
 : @return the date-time when the session was last accessed
 :)
declare function session:get-last-accessed-time() as xs:dateTime external;

(:~
 : Returns the maximum time interval, in seconds, that the servlet container
 : will keep this session open between client accesses. After this interval,
 : the servlet container will invalidate the session. The maximum time interval
 : can be set with the session:set-max-inactive-interval function. A negative
 : time indicates the session should never timeout.
 : @return the maximum time interval, in seconds
 :)
declare function session:get-max-inactive-interval() as xs:int external;

(:~
 : Invalidate (remove) the current HTTP session if present
 :)
declare function session:invalidate() as empty-sequence() external;

(:~
 : Removes the attribute with the supplied name from the current session
 : @param $name The attribute name
 :)
declare function session:remove-attribute($name as xs:string) as empty-sequence() external;

(:~
 : Stores a value in the current session using the supplied attribute name. If
 : no session exists, then one will be created.
 : @param $name The attribute name
 : @param $value The value to be stored in the session by the attribute name
 :)
declare function session:set-attribute($name as xs:string, $value as item()*) as empty-sequence() external;

(:~
 : Change the user identity for the current HTTP session. Subsequent XQueries
 : in the session will run with the new user identity.
 : @param $user-name The user name
 : @param $password The password
 : @return true if the user name and password represent a valid user
 :)
declare function session:set-current-user($user-name as xs:string, $password as xs:string) as xs:boolean external;

(:~
 : Sets the maximum time interval, in seconds, that the servlet container will
 : keep this session open between client accesses. After this interval, the
 : servlet container will invalidate the session. A negative time indicates the
 : session should never timeout.
 :)
declare function session:set-max-inactive-interval($interval as xs:int) as empty-sequence() external;
