module namespace db="http://basex.org/modules/db";
(:~ Opens a database. :)
declare function db:open($name as xs:string) as document-node()* external;
(:~ Opens a database at a specific path. :)
declare function db:open($name as xs:string, $path as xs:string) as document-node()* external;
(:~ Lists all databases. :)
declare function db:list() as xs:string* external;
(:~ Returns documents in a database. :)
declare function db:get($name as xs:string) as document-node()* external;
(:~ Closes a database. :)
declare function db:close($name as xs:string) as empty-sequence() external;
