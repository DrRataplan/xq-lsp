module namespace console = "http://exist-db.org/xquery/console";

(:~
 : Logs a message to the eXist-db console/log (at INFO level) and returns the empty sequence.
 : Useful for lightweight tracing without disrupting query output.
 : @param $message The message to log; any items are converted to strings
 :)
declare function console:log($message as item()*) as empty-sequence() external;

(:~
 : Logs a message to the eXist-db console at the given log level.
 : @param $level The log level: "debug", "info", "warn", or "error"
 : @param $message The message to log
 :)
declare function console:log($level as xs:string, $message as item()*) as empty-sequence() external;
