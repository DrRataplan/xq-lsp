module namespace process = "http://exist-db.org/xquery/process";

(:~
 : @param $args a list of strings which signifies the external program file to be invoked and its arguments, if any
 : @param $options an XML fragment defining optional parameters like working directory or the lines to send to the process via stdin. Format: <options><workingDir>workingDir</workingDir> <environment><env name="name" value="value"/></environment><stdin><line>line</line></stdin></options>
 : @return the sequence of code points
 :)
declare function process:execute($args as xs:string+, $options as element()?) as element() external;
