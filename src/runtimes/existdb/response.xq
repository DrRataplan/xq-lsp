module namespace response = "http://exist-db.org/xquery/response";

(:~
 : Returns whether a response object exists.
 :)
declare function response:exists() as item()* external;

(:~
 : Sends a HTTP redirect response (302) to the client.
 : @param $uri The URI to redirect the client to
 :)
declare function response:redirect-to($uri as xs:anyURI) as empty-sequence() external;

(:~
 : Sets a HTTP Cookie on the HTTP Response.
 :)
declare function response:set-cookie() as empty-sequence() external;

(:~
 : Sets a HTTP Header on the HTTP Response.
 :)
declare function response:set-date-header() as empty-sequence() external;

(:~
 : Sets a HTTP Header on the HTTP Response.
 :)
declare function response:set-header() as empty-sequence() external;

(:~
 : Sets a HTTP server status code on the HTTP Response.
 : @param $code The status code
 :)
declare function response:set-status-code($code as xs:integer) as empty-sequence() external;

(:~
 : Stream can only be used within a servlet context. It directly streams its
 : input to the servlet's output stream. It should thus be the last statement
 : in the XQuery.
 : @param $content The source sequence
 : @param $serialization-options The serialization options
 :)
declare function response:stream($content as item()*, $serialization-options as xs:string) as empty-sequence() external;

(:~
 : Streams the binary data to the current servlet response output stream. The
 : ContentType HTTP header is set to the value given in $content-type. Note:
 : the servlet output stream will be closed afterwards and mime-type settings
 : in the prolog will not be passed.
 :)
declare function response:stream-binary() as empty-sequence() external;
