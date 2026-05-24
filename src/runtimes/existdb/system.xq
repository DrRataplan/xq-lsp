module namespace system = "http://exist-db.org/xquery/system";

(: ── Version & Build Info ─────────────────────────────────────────────────── :)

(:~
 : Returns the eXist-db product name.
 :)
declare function system:get-product-name() as xs:string external;

(:~
 : Returns the eXist-db version string.
 :)
declare function system:get-version() as xs:string external;

(:~
 : Returns the eXist-db build number.
 :)
declare function system:get-build() as xs:string external;

(:~
 : Returns the eXist-db source revision identifier.
 :)
declare function system:get-revision() as xs:string external;

(:~
 : Returns the path to the eXist-db installation directory.
 :)
declare function system:get-exist-home() as xs:string external;

(:~
 : Returns the path to the eXist-db data directory.
 :)
declare function system:get-data-dir() as xs:string external;

(:~
 : Returns the module load path used to resolve XQuery modules.
 :)
declare function system:get-module-load-path() as xs:string external;

(:~
 : Returns the load path of the main (entry) module.
 :)
declare function system:get-main-module-load-path() as xs:string external;

(:~
 : Returns the number of milliseconds eXist-db has been running.
 :)
declare function system:get-uptime() as xs:long external;

(: ── Memory ────────────────────────────────────────────────────────────────── :)

(:~
 : Returns the maximum amount of memory available to the JVM in bytes.
 :)
declare function system:get-memory-max() as xs:long external;

(:~
 : Returns the total amount of memory available to the JVM in bytes.
 :)
declare function system:get-memory-total() as xs:long external;

(:~
 : Returns the amount of free memory available to the JVM in bytes.
 :)
declare function system:get-memory-free() as xs:long external;

(: ── User Context ─────────────────────────────────────────────────────────── :)

(:~
 : Evaluates an expression as the specified user.
 : @param $user The username
 : @param $password The password
 : @param $expression The expression to evaluate
 :)
declare function system:as-user($user as xs:string, $password as xs:string, $expression as item()*) as item()* external;

(: ── Running Queries ──────────────────────────────────────────────────────── :)

(:~
 : Returns information about currently running XQuery jobs.
 :)
declare function system:get-running-xqueries() as element()* external;

(:~
 : Kills a running XQuery job by its ID.
 : @param $xquery-id The job ID to kill
 :)
declare function system:kill-running-xquery($xquery-id as xs:integer) as empty-sequence() external;

(:~
 : Returns information about all running jobs (queries and scheduled tasks).
 :)
declare function system:get-running-jobs() as element()* external;

(:~
 : Returns information about all scheduled jobs.
 :)
declare function system:get-scheduled-jobs() as element()* external;

(: ── Database Operations ──────────────────────────────────────────────────── :)

(:~
 : Exports the database to a backup in the specified directory.
 : @param $dir The directory to export to
 :)
declare function system:export($dir as xs:string) as element()* external;

(:~
 : Exports the database with incremental backup support.
 : @param $dir The directory to export to
 : @param $incremental If true, creates an incremental backup
 :)
declare function system:export($dir as xs:string, $incremental as xs:boolean) as element()* external;

(:~
 : Exports the database with full options.
 : @param $dir The directory to export to
 : @param $incremental If true, creates an incremental backup
 : @param $collection The root collection to export (empty sequence for all)
 :)
declare function system:export($dir as xs:string, $incremental as xs:boolean, $collection as xs:string?) as element()* external;

(:~
 : Restores the database from a backup zip file.
 : @param $backup The path to the backup file
 :)
declare function system:restore($backup as xs:string) as element()* external;

(:~
 : Restores the database from a backup, targeting a specific collection.
 : @param $target The target collection URI
 : @param $user The DBA username
 : @param $password The DBA password
 : @param $backup The path to the backup file or directory
 : @param $admin-password The admin password
 :)
declare function system:restore($target as xs:string, $user as xs:string, $password as xs:string, $backup as xs:string, $admin-password as xs:string) as element()* external;

(:~
 : Returns index statistics for the database.
 :)
declare function system:get-index-statistics() as element()* external;

(:~
 : Updates usage statistics for all indexes in the database.
 :)
declare function system:update-statistics() as empty-sequence() external;

(:~
 : Clears the XQuery compiled-expression cache.
 :)
declare function system:clear-xquery-cache() as empty-sequence() external;

(: ── Shutdown ──────────────────────────────────────────────────────────────── :)

(:~
 : Shuts down the eXist-db server immediately.
 :)
declare function system:shutdown() as empty-sequence() external;

(:~
 : Shuts down the eXist-db server after the given delay in milliseconds.
 : @param $delay The delay in milliseconds before shutdown
 :)
declare function system:shutdown($delay as xs:long) as empty-sequence() external;

(: ── Tracing ──────────────────────────────────────────────────────────────── :)

(:~
 : Enables or disables function call tracing.
 : @param $enable true to enable tracing, false to disable
 :)
declare function system:enable-tracing($enable as xs:boolean) as empty-sequence() external;

(:~
 : Returns the current function call trace as an element.
 :)
declare function system:trace() as element()? external;

(:~
 : Clears the current function call trace.
 :)
declare function system:clear-trace() as empty-sequence() external;

(:~
 : Returns true if the given function is available in this eXist installation.
 : @param $name The function name (prefix:local)
 : @param $arity The function arity
 :)
declare function system:function-available($name as xs:string, $arity as xs:integer) as xs:boolean external;

(: ── Task Management ──────────────────────────────────────────────────────── :)

(:~
 : Triggers a named system task (Java class implementing SystemTask interface).
 : @param $java-classname The fully-qualified Java class name
 : @param $parameters A map of parameters to pass to the task
 :)
declare function system:trigger-system-task($java-classname as xs:string, $parameters as map(*)?) as empty-sequence() external;

(: ── Instance Pool ─────────────────────────────────────────────────────────── :)

(:~
 : Returns the number of query instances currently in the pool.
 :)
declare function system:count-instances() as xs:integer external;

(:~
 : Returns the number of actively executing query instances.
 :)
declare function system:count-active-instances() as xs:integer external;

(:~
 : Returns the number of idle query instances in the pool.
 :)
declare function system:count-available-instances() as xs:integer external;
