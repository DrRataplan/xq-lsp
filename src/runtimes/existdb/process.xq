module namespace process = "http://exist-db.org/xquery/process";

(:~
 : Executes an external command and returns a result element with stdout, stderr, and exit code.
 : @param $command The command to execute (first element is the executable; remainder are arguments)
 : @param $options A map of options: "workingDir" (string), "environment" (map of name→value pairs)
 :)
declare function process:execute($command as xs:string+, $options as map(*)?) as element()? external;

(:~
 : Searches the system PATH for the named executable and returns its absolute path.
 : @param $name The executable name to look up
 :)
declare function process:search-path($name as xs:string) as xs:anyURI? external;
