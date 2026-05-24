module namespace request = "http://exist-db.org/xquery/request";

(:~
 : Returns the value of a named attribute of the current request.
 : @param $name The attribute name
 :)
declare function request:get-attribute($name as xs:string) as item()* external;

(:~
 : Sets a named attribute on the current request.
 : @param $name The attribute name
 : @param $value The value to set
 :)
declare function request:set-attribute($name as xs:string, $value as item()*) as empty-sequence() external;

(:~
 : Returns the names of all cookies in the current request.
 :)
declare function request:get-cookie-names() as xs:string* external;

(:~
 : Returns the value of the named cookie.
 : @param $name The cookie name
 :)
declare function request:get-cookie-value($name as xs:string) as xs:string? external;

(:~
 : Returns the raw data of the current request (e.g. for POST with content-type application/xml).
 :)
declare function request:get-data() as item()? external;

(:~
 : Returns the HTTP method of the current request (GET, POST, PUT, DELETE, etc.).
 :)
declare function request:get-method() as xs:string external;

(:~
 : Returns the query string of the current request URI.
 :)
declare function request:get-query-string() as xs:string? external;

(:~
 : Returns the value of the specified request header.
 : @param $name The header name
 :)
declare function request:get-header($name as xs:string) as xs:string? external;

(:~
 : Returns all header names in the current request.
 :)
declare function request:get-header-names() as xs:string* external;

(:~
 : Returns the value of the named request parameter, or the default value if absent.
 : @param $name The parameter name
 : @param $default-value The default value if the parameter is absent
 :)
declare function request:get-parameter($name as xs:string, $default-value as item()*) as item()* external;

(:~
 : Returns all parameter names in the current request.
 :)
declare function request:get-parameter-names() as xs:string* external;

(:~
 : Returns the data of the uploaded file with the given field name as a binary value.
 : @param $name The form field name
 :)
declare function request:get-uploaded-file-data($name as xs:string) as xs:base64Binary? external;

(:~
 : Returns the original filename of the uploaded file with the given field name.
 : @param $name The form field name
 :)
declare function request:get-uploaded-file-name($name as xs:string) as xs:string? external;

(:~
 : Returns the size in bytes of the uploaded file with the given field name.
 : @param $name The form field name
 :)
declare function request:get-uploaded-file-size($name as xs:string) as xs:double? external;

(:~
 : Returns the MIME type of the uploaded file with the given field name.
 : @param $name The form field name
 :)
declare function request:get-uploaded-file-mime-type($name as xs:string) as xs:string? external;

(:~
 : Returns the URI of the current request (path without the query string).
 :)
declare function request:get-uri() as xs:anyURI external;

(:~
 : Returns the full URL of the current request including the query string.
 :)
declare function request:get-url() as xs:string external;

(:~
 : Returns the effective URI of the current request (after URL rewriting).
 :)
declare function request:get-effective-uri() as xs:anyURI external;

(:~
 : Returns the context path of the web application.
 :)
declare function request:get-context-path() as xs:string external;

(:~
 : Returns the path info portion of the request URI (the path after the servlet path).
 :)
declare function request:get-path-info() as xs:string? external;

(:~
 : Returns the servlet path portion of the request URI.
 :)
declare function request:get-servlet-path() as xs:string external;

(:~
 : Returns the server name (hostname) from the Host header.
 :)
declare function request:get-server-name() as xs:string external;

(:~
 : Returns the server port number.
 :)
declare function request:get-server-port() as xs:integer external;

(:~
 : Returns the scheme of the request (http or https).
 :)
declare function request:get-scheme() as xs:string external;

(:~
 : Returns the hostname of the server.
 :)
declare function request:get-hostname() as xs:string external;

(:~
 : Returns the IP address of the remote client.
 :)
declare function request:get-remote-addr() as xs:string external;

(:~
 : Returns the fully-qualified hostname of the remote client.
 :)
declare function request:get-remote-host() as xs:string external;

(:~
 : Returns the port number of the remote client.
 :)
declare function request:get-remote-port() as xs:integer external;

(:~
 : Returns true if a request object exists in the current context.
 :)
declare function request:get-exists() as xs:boolean external;

(:~
 : Returns true if the request content-type is multipart/form-data.
 :)
declare function request:is-multipart-content() as xs:boolean external;

(:~
 : Returns the content type of the request body.
 :)
declare function request:get-content-type() as xs:string? external;

(:~
 : Returns the length of the request body in bytes, or -1 if unknown.
 :)
declare function request:get-content-length() as xs:integer external;
