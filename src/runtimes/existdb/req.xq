module namespace req = "http://exquery.org/ns/request";

(:~
 : Gets the IP address of the server that received the HTTP Request
 : @return The IP address of the server.
 :)
declare function req:address() as xs:string external;

(:~
 : Gets the value of the named Cookie in the HTTP Request. If there is no such
 : cookie, then an empty sequence is returned.
 : @param $cookie-name The name of the cookie to retrieve the value of.
 : @return The value of the named cookie, or an empty sequence.
 :)
declare function req:cookie($cookie-name as xs:string) as xs:string? external;

(:~
 : Gets he value of the named Cookie in the HTTP Request. If there is no such
 : cookie in the HTTP Request, then the value specified in $default is returned
 : instead.
 : @param $cookie-name The name of the cookie to retrieve the value of.
 : @param $default The default value to use if the named cookie is not present in the request.
 : @return The value of the named cookie, or the default value.
 :)
declare function req:cookie($cookie-name as xs:string, $default as xs:string) as xs:string external;

(:~
 : Gets the value of the named HTTP Header in the HTTP Request. If there is no
 : such header, then an empty sequence is returned.
 : @param $header-name The name of the HTTP Header to retrieve the value of.
 : @return The value of the named HTTP Header, or an empty sequence.
 :)
declare function req:header($header-name as xs:string) as xs:string? external;

(:~
 : Gets the value of the named HTTP Header in the HTTP Request. If there is no
 : such header in the HTTP Request, then the value specified in $default is
 : returned instead.
 : @param $header-name The name of the HTTP Header to retrieve the value of.
 : @param $default The default value to use if the named HTTP Header is not present in the request.
 : @return The value of the named HTTP Header, or the default value.
 :)
declare function req:header($header-name as xs:string, $default as xs:string) as xs:string external;

(:~
 : Gets the names of HTTP Headers available in the HTTP Request.
 : @return The names of available HTTP Headers in the HTTP Request.
 :)
declare function req:header-names() as xs:string+ external;

(:~
 : Gets the Hostname fragment of the Authority component of the URI of the HTTP
 : Request.
 : @return The Hostname of the HTTP Request.
 :)
declare function req:hostname() as xs:string external;

(:~
 : Gets the HTTP Method of the Request e.g. GET.
 : @return The HTTP Method.
 :)
declare function req:method() as xs:string external;

(:~
 : Gets the values of the named parameter from the HTTP Request. If there is no
 : such parameter in the HTTP Request, then an empty sequence is returned.
 : @param $parameter-name The name of the parameter to retrieve values of.
 : @return The value(s) of the named parameter, or an empty sequence.
 :)
declare function req:parameter($parameter-name as xs:string) as xs:string* external;

(:~
 : Gets the values of the named parameter from the HTTP Request. If there is no
 : such parameter in the HTTP Request, then the value specified in $default is
 : returned instead.
 : @param $parameter-name The name of the parameter to retrieve values of.
 : @param $default The default value(s) to use if the named parameter is not present in the request.
 : @return The value(s) of the named parameter, or the default value(s).
 :)
declare function req:parameter($parameter-name as xs:string, $default as xs:string*) as xs:string* external;

(:~
 : Gets the names of parameters available in the HTTP Request.
 : @return The names of available parameters from the HTTP Request.
 :)
declare function req:parameter-names() as xs:string* external;

(:~
 : Gets the Path component of the URI of the HTTP Request.
 : @return The Path of the URI of the HTTP Request.
 :)
declare function req:path() as xs:string external;

(:~
 : Gets the Port fragment of the Authority component of the URI of the HTTP
 : Request. If the port is not explicitly specified in the URI, then the
 : default port for the HTTP Scheme is returned (i.e. 21 for FTP, 80 for HTTP
 : and 443 for HTTPS).
 : @return The Port of the HTTP Request.
 :)
declare function req:port() as xs:integer external;

(:~
 : Gets the Query Component of the HTTP Request URI, if there is no query
 : component then an empty sequence is returned.
 : @return The Query of the URI of the HTTP Request.
 :)
declare function req:query() as xs:string? external;

(:~
 : Gets the IP address of the client or the last proxy that sent the HTTP
 : Request.
 : @return The IP address of the client.
 :)
declare function req:remote-address() as xs:integer external;

(:~
 : Gets the fully qualified hostname of the client or the last proxy that sent
 : the HTTP Request. If the name of the remote host cannot be established, this
 : method behaves as request:remote-address(), and returns the IP address.
 : @return The Hostname of the client that issues the HTTP Request.
 :)
declare function req:remote-hostname() as xs:string external;

(:~
 : Gets the TCP port number of the client socket or the last proxy that sent
 : the HTTP Request..
 : @return The TCP port number of the client.
 :)
declare function req:remote-port() as xs:integer external;

(:~
 : Gets the Scheme of the HTTP Request e.g. https.
 : @return The Scheme of the HTTP Request.
 :)
declare function req:scheme() as xs:string external;

(:~
 : Gets the URI of the HTTP Request URI.
 : @return The URI of the HTTP Request.
 :)
declare function req:uri() as xs:string? external;
