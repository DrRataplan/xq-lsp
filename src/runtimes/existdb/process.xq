module namespace process = "http://exist-db.org/xquery/process";

(:~
 : @param $args a list of strings which signifies the external program file to be invoked and its arguments, if any
 : @param $options an XML fragment defining optional parameters like working directory or the lines to send to the process via stdin. Format: &lt;options>&lt;workingDir>workingDir&lt;/workingDir>&lt;environment>&lt;env name="name" value="value"/>&lt;/environment>&lt;stdin>&lt;line>line&lt;/line>&lt;/stdin>&lt;/options>
 : @return the sequence of code points
 :)
declare function process:execute($args as xs:string+, $options as element()?) as element() external;
