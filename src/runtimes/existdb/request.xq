module namespace request = "http://exist-db.org/xquery/request";

(:~
 : Returns the names of all request attributes in the current request.
 : @return the names of all attributes attached to the current request
 :)
declare function request:attribute-names() as xs:string* external;

(:~
 : Returns whether a request object exists.
 : @return true if the request object exists
 :)
declare function request:exists() as xs:boolean external;

(:~
 : Returns the string value of the request attribute specified in the argument
 : or the empty sequence if no such attribute exists. The attribute value
 : should be a string.
 : @param $attribute-name The name of the attribute
 : @return the string value of the requested attribute
 :)
declare function request:get-attribute($attribute-name as xs:string) as item()* external;

(:~
 : Returns the context path of the current request, i.e. the portion of the
 : request URI that indicates the context of the request.
 : @return the context path of the current request
 :)
declare function request:get-context-path() as xs:string external;

(:~
 : Returns the names of all Cookies in the request
 : @return a sequence of the names of all Cookies in the request
 :)
declare function request:get-cookie-names() as xs:string* external;

(:~
 : Returns the value of a named Cookie.
 : @param $cookie-name The name of the cookie to retrieve the value from.
 : @return the value of the named Cookie
 :)
declare function request:get-cookie-value($cookie-name as xs:string) as xs:string? external;

(:~
 : Returns the content of a POST request. If the HTTP Content-Type header in
 : the request identifies it as a binary document, then xs:base64Binary is
 : returned. If its not a binary document, we attempt to parse it as XML and
 : return a document-node(). If its not a binary or XML document, any other
 : data type is returned as an xs:string representation or an empty sequence if
 : there is no data to be read.
 : @return the content of a POST request
 :)
declare function request:get-data() as item()? external;

(:~
 : Returns the URI of the current request. If the request was forwarded via URL
 : rewriting, the function returns the effective, rewritten URI, not the
 : original URI which was received from the client.
 : @return the URI of the request
 :)
declare function request:get-effective-uri() as xs:anyURI external;

(:~
 : Returns the HTTP request header identified by $header-name. The list of all
 : headers included in the HTTP request are available through the
 : request:get-header-names function.
 : @param $header-name The HTTP request header name
 : @return the HTTP request header value
 :)
declare function request:get-header($header-name as xs:string) as xs:string? external;

(:~
 : Returns a sequence containing the names of all headers passed in the current
 : request
 : @return a sequence containing the names of all headers passed in the current request
 :)
declare function request:get-header-names() as xs:string* external;

(:~
 : Returns the hostname of the current request.
 : @return the hostname of the current request
 :)
declare function request:get-hostname() as xs:string external;

(:~
 : Returns the HTTP method of the current request.
 : @return the HTTP method of the current request
 :)
declare function request:get-method() as xs:string external;

(:~
 : Returns the HTTP request parameter identified by $name. If the parameter
 : could not be found, the default value is returned instead. Note: this
 : function will not try to expand predefined entities like &amp; or &lt;, so a
 : &amp; passed through a parameter will indeed be treated as an &amp;
 : character.
 : @param $name The parameter name
 : @param $default-value The default value if the parameter does not exist
 : @return a sequence of parameter values
 :)
declare function request:get-parameter($name as xs:string, $default-value as item()*) as xs:string* external;

(:~
 : Returns the HTTP request parameter identified by $name. If the parameter
 : could not be found, the default value is returned instead. Note: this
 : function will not try to expand predefined entities like &amp; or &lt;, so a
 : &amp; passed through a parameter will indeed be treated as an &amp;
 : character.
 : @param $name The parameter name
 : @param $default-value The default value if the parameter does not exist
 : @param $failonerror The fail on error flag. If the value is set to false, then the function will not fail if there is no request in scope.
 : @return a sequence of parameter values
 :)
declare function request:get-parameter($name as xs:string, $default-value as item()*, $failonerror as xs:boolean*) as xs:string* external;

(:~
 : Returns a sequence containing the names of all parameters passed in the
 : current request
 : @return the sequence containing the names of all parameters
 :)
declare function request:get-parameter-names() as xs:string* external;

(:~
 : Returns any extra path information associated with the URL the client sent
 : when it made this request. For example an xquery GET or POST to
 : /some/path/myfile.xq/extra/path will return /extra/path when myfile.xq is
 : executed.
 : @return the request path information
 :)
declare function request:get-path-info() as xs:string external;

(:~
 : Returns the full query string passed to the servlet (without the initial
 : question mark).
 : @return the query string
 :)
declare function request:get-query-string() as xs:string? external;

(:~
 : Returns the IP address of the client machine that made the current request,
 : as a string.
 : @return the IP address
 :)
declare function request:get-remote-addr() as xs:string external;

(:~
 : Returns the fully qualified name of the client or the last proxy that sent
 : the current request.
 : @return the host name
 :)
declare function request:get-remote-host() as xs:string external;

(:~
 : Returns the Internet Protocol (IP) source port of the client or last proxy
 : that sent the current request.
 : @return the IP port number
 :)
declare function request:get-remote-port() as xs:integer external;

(:~
 : Returns the name of the scheme used in the current request, for example,
 : http, https, or ftp.
 : @return the scheme of the current request
 :)
declare function request:get-scheme() as xs:string external;

(:~
 : Returns the server nodename of the current request.
 : @return the server host name of the current request
 :)
declare function request:get-server-name() as xs:string external;

(:~
 : Returns the server port of the current request.
 : @return the server port of the current request
 :)
declare function request:get-server-port() as xs:integer external;

(:~
 : @return the servlet path of the current request
 :)
declare function request:get-servlet-path() as xs:string external;

(:~
 : Retrieve the base64 encoded data where the file part of a multi-part request
 : has been stored. Returns the empty sequence if the request is not a
 : multi-part request or the parameter name does not point to a file part.
 : @param $upload-param-name The parameter name
 : @return the base64 encoded data from the uploaded file
 :)
declare function request:get-uploaded-file-data($upload-param-name as xs:string) as xs:base64Binary* external;

(:~
 : Retrieve the file name of an uploaded file from a multi-part request. This
 : returns the file name of the file on the client (without path). Returns the
 : empty sequence if the request is not a multi-part request or the parameter
 : name does not point to a file part.
 : @param $upload-param-name The parameter name
 : @return the file name of the uploaded files
 :)
declare function request:get-uploaded-file-name($upload-param-name as xs:string) as xs:string* external;

(:~
 : Retrieve the size of an uploaded file from a multi-part request. This
 : returns the size of the file in bytes. Returns the empty sequence if the
 : request is not a multi-part request or the parameter name does not point to
 : a file part.
 : @param $upload-param-name The parameter name
 : @return the size of the uploaded files
 :)
declare function request:get-uploaded-file-size($upload-param-name as xs:string) as xs:double* external;

(:~
 : Returns the URI of the current request. This will be the original URI as
 : received from the client. Possible modifications done by the URL rewriter
 : will not be visible.
 : @return the URI of the request
 :)
declare function request:get-uri() as xs:anyURI external;

(:~
 : Returns the URL of the current request.
 : @return the URL of the current request
 :)
declare function request:get-url() as xs:string external;

(:~
 : Determine if the request contains multipart/form-data
 : @return true is the request is a multipart/form-data request else false.
 :)
declare function request:is-multipart-content() as xs:boolean external;

(:~
 : Stores a value in the current request using the supplied attribute name.
 : @param $name The attribute name
 : @param $value The attribute value
 :)
declare function request:set-attribute($name as xs:string, $value as item()*) as empty-sequence() external;
