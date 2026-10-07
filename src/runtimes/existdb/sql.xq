module namespace sql = "http://exist-db.org/xquery/sql";

(:~
 : Closes a connection to a SQL Database, or if the connection was taken from a
 : connection pool then it is returned to the pool
 : @param $connection-handle an xs:long representing the connection handle
 : @return true if the connection was closed, false if there was no such connection
 :)
declare function sql:close-connection($connection-handle as xs:long) as xs:boolean external;

(:~
 : Executes a prepared SQL statement against a SQL db.
 : @param $connection-handle The connection handle
 : @param $sql-statement The SQL statement
 : @param $make-node-from-column-name The flag that indicates whether the xml nodes should be formed from the column names (in this mode a space in a Column Name will be replaced by an underscore!)
 : @return the results
 :)
declare function sql:execute($connection-handle as xs:long, $sql-statement as xs:string, $make-node-from-column-name as xs:boolean) as element()? external;

(:~
 : Executes a prepared SQL statement against a SQL db.
 : @param $connection-handle The connection handle
 : @param $statement-handle The prepared statement handle
 : @param $parameters Parameters for the prepared statement. e.g. &lt;sql:parameters>&lt;sql:param sql:type="long">1234&lt;/sql:param>&lt;sql:param sql:type="varchar">&lt;sql:null/>&lt;/sql:param>&lt;/sql:parameters>
 : @param $make-node-from-column-name The flag that indicates whether the xml nodes should be formed from the column names (in this mode a space in a Column Name will be replaced by an underscore!)
 : @return the results
 :)
declare function sql:execute(
	$connection-handle as xs:long,
	$statement-handle as xs:long,
	$parameters as element()?,
	$make-node-from-column-name as xs:boolean
) as element()? external;

(:~
 : Executes a prepared SQL statement against a SQL db.
 : @param $connection-handle The connection handle
 : @param $sql-statement The SQL statement
 : @param $make-node-from-column-name The flag that indicates whether the xml nodes should be formed from the column names (in this mode a space in a Column Name will be replaced by an underscore!)
 : @param $ns-uri The uri of the result namespace.
 : @param $ns-prefix The prefix of the result namespace.
 : @return the results
 :)
declare function sql:execute(
	$connection-handle as xs:long,
	$sql-statement as xs:string,
	$make-node-from-column-name as xs:boolean,
	$ns-uri as xs:string,
	$ns-prefix as xs:string
) as element()? external;

(:~
 : Executes a prepared SQL statement against a SQL db.
 : @param $connection-handle The connection handle
 : @param $statement-handle The prepared statement handle
 : @param $parameters Parameters for the prepared statement. e.g. &lt;sql:parameters>&lt;sql:param sql:type="long">1234&lt;/sql:param>&lt;sql:param sql:type="varchar">&lt;sql:null/>&lt;/sql:param>&lt;/sql:parameters>
 : @param $make-node-from-column-name The flag that indicates whether the xml nodes should be formed from the column names (in this mode a space in a Column Name will be replaced by an underscore!)
 : @param $ns-uri The uri of the result namespace.
 : @param $ns-prefix The prefix of the result namespace.
 : @return the results
 :)
declare function sql:execute(
	$connection-handle as xs:long,
	$statement-handle as xs:long,
	$parameters as element()?,
	$make-node-from-column-name as xs:boolean,
	$ns-uri as xs:string,
	$ns-prefix as xs:string
) as element()? external;

(:~
 : Opens a connection to a SQL Database
 : @param $driver-classname The JDBC driver classname
 : @param $url The JDBC connection URL
 : @return an xs:long representing the connection handle. The connection will be closed (or returned to the pool) automatically when the calling XQuery finishes execution, if you need to return it sooner you can call sql:close-connection#1
 :)
declare function sql:get-connection($driver-classname as xs:string, $url as xs:string) as xs:long? external;

(:~
 : Opens a connection to a SQL Database
 : @param $driver-classname The JDBC driver classname
 : @param $url The JDBC connection URL
 : @param $properties The JDBC database connection properties in the form &lt;properties>&lt;property name="" value=""/>&lt;/properties>.
 : @return an xs:long representing the connection handle. The connection will be closed (or returned to the pool) automatically when the calling XQuery finishes execution, if you need to return it sooner you can call sql:close-connection#1
 :)
declare function sql:get-connection($driver-classname as xs:string, $url as xs:string, $properties as element()?) as xs:long? external;

(:~
 : Opens a connection to a SQL Database
 : @param $driver-classname The JDBC driver classname
 : @param $url The JDBC connection URL
 : @param $username The SQL database username
 : @param $password The SQL database password
 : @return an xs:long representing the connection handle. The connection will be closed (or returned to the pool) automatically when the calling XQuery finishes execution, if you need to return it sooner you can call sql:close-connection#1
 :)
declare function sql:get-connection(
	$driver-classname as xs:string,
	$url as xs:string,
	$username as xs:string,
	$password as xs:string
) as xs:long? external;

(:~
 : Retrieves a connection to a SQL Database from a connection pool
 : @param $pool-name The connection pool name (as configured in conf.xml)
 : @return an xs:long representing the connection handle. The connection will be closed (or returned to the pool) automatically when the calling XQuery finishes execution, if you need to return it sooner you can call sql:close-connection#1
 :)
declare function sql:get-connection-from-pool($pool-name as xs:string) as xs:long? external;

(:~
 : Retrieves a connection to a SQL Database from a connection pool
 : @param $pool-name The connection pool name (as configured in conf.xml)
 : @param $username The SQL database username
 : @param $password The SQL database password
 : @return an xs:long representing the connection handle. The connection will be closed (or returned to the pool) automatically when the calling XQuery finishes execution, if you need to return it sooner you can call sql:close-connection#1
 :)
declare function sql:get-connection-from-pool($pool-name as xs:string, $username as xs:string, $password as xs:string) as xs:long? external;

(:~
 : Opens a connection to a SQL Database.
 : @param $jndi-name The JNDI name
 : @return an xs:long representing the connection handle
 :)
declare function sql:get-jndi-connection($jndi-name as xs:string) as xs:long? external;

(:~
 : Opens a connection to a SQL Database.
 : @param $jndi-name The JNDI name
 : @param $username The username
 : @param $password The password
 : @return an xs:long representing the connection handle
 :)
declare function sql:get-jndi-connection($jndi-name as xs:string, $username as xs:string, $password as xs:string) as xs:long? external;

(:~
 : Prepares a SQL statement against a SQL db using the connection indicated by
 : the connection handle.
 : @param $handle The connection handle
 : @param $sql-statement The SQL statement
 : @return an xs:long representing the statement handle
 :)
declare function sql:prepare($handle as xs:long, $sql-statement as xs:string) as xs:long? external;
