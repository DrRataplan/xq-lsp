module namespace http = "http://expath.org/ns/http-client";

(:~
 : Sends an HTTP request to a server and returns the response. The response is
 : a sequence where the first item is an http:response element with status,
 : message, and header information, followed by the response body content.
 : @param $request The http:request element describing the request.
 : @return the response sequence: http:response element followed by body content
 :)
declare function http:send-request($request as element()?) as item()+ external;

(:~
 : Sends an HTTP request to a server and returns the response. The response is
 : a sequence where the first item is an http:response element with status,
 : message, and header information, followed by the response body content.
 : @param $request The http:request element describing the request.
 : @param $href The target URI (overrides @href on request element).
 : @return the response sequence: http:response element followed by body content
 :)
declare function http:send-request($request as element()?, $href as xs:string?) as item()+ external;

(:~
 : Sends an HTTP request to a server and returns the response. The response is
 : a sequence where the first item is an http:response element with status,
 : message, and header information, followed by the response body content.
 : @param $request The http:request element describing the request.
 : @param $href The target URI (overrides @href on request element).
 : @param $bodies The request body content for methods like POST/PUT.
 : @return the response sequence: http:response element followed by body content
 :)
declare function http:send-request($request as element()?, $href as xs:string?, $bodies as item()*) as item()+ external;
