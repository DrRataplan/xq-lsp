module namespace xdmp="http://marklogic.com/xdmp";
(:~ Logs a message. :)
declare function xdmp:log($msg as xs:string) as empty-sequence() external;
(:~ Evaluates an XQuery string. :)
declare function xdmp:eval($xquery as xs:string) as item()* external;
(:~ Returns the current request ID. :)
declare function xdmp:request() as xs:unsignedLong external;
(:~ Returns the current user's name. :)
declare function xdmp:get-current-user() as xs:string external;
