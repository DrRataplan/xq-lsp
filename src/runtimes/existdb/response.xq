module namespace response = "http://exist-db.org/xquery/response";

(:~
 : Sends an HTTP redirect to the given URI.
 : @param $uri The URI to redirect to
 :)
declare function response:redirect-to($uri as xs:anyURI) as empty-sequence() external;

(:~
 : Sets a response cookie with the given name and value.
 : @param $name The cookie name
 : @param $value The cookie value
 :)
declare function response:set-cookie($name as xs:string, $value as xs:string) as empty-sequence() external;

(:~
 : Sets a response cookie with name, value, and max age.
 : @param $name The cookie name
 : @param $value The cookie value
 : @param $max-age Max age in seconds; negative means session cookie
 : @param $secure Whether to set the Secure flag
 :)
declare function response:set-cookie($name as xs:string, $value as xs:string, $max-age as xs:duration, $secure as xs:boolean) as empty-sequence() external;

(:~
 : Sets a response cookie with name, value, max age, secure flag, path, and domain.
 : @param $name The cookie name
 : @param $value The cookie value
 : @param $max-age Max age in seconds; negative means session cookie
 : @param $secure Whether to set the Secure flag
 : @param $domain The cookie domain
 : @param $path The cookie path
 :)
declare function response:set-cookie($name as xs:string, $value as xs:string, $max-age as xs:duration, $secure as xs:boolean, $domain as xs:string, $path as xs:string) as empty-sequence() external;

(:~
 : Sets a date-typed response header.
 : @param $name The header name
 : @param $value The date value
 :)
declare function response:set-date-header($name as xs:string, $value as xs:long) as empty-sequence() external;

(:~
 : Sets a response header with the given name and value.
 : @param $name The header name
 : @param $value The header value
 :)
declare function response:set-header($name as xs:string, $value as xs:string) as empty-sequence() external;

(:~
 : Sets the HTTP status code of the response.
 : @param $code The HTTP status code
 :)
declare function response:set-status-code($code as xs:integer) as empty-sequence() external;

(:~
 : Streams the given content to the response using the specified serialization options.
 : @param $content The content to stream
 : @param $serialization-options Serialization parameters as a string (e.g. "method=xml media-type=text/xml")
 :)
declare function response:stream($content as item()*, $serialization-options as xs:string) as empty-sequence() external;

(:~
 : Streams binary content to the response.
 : @param $content The binary content
 : @param $mime-type The MIME type
 : @param $filename Optional filename for Content-Disposition; empty sequence for no header
 :)
declare function response:stream-binary($content as xs:base64Binary, $mime-type as xs:string, $filename as xs:string?) as empty-sequence() external;

(:~
 : Returns true if a response object exists in the current context.
 :)
declare function response:get-exists() as xs:boolean external;
