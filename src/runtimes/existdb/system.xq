module namespace system = "http://exist-db.org/xquery/system";

(:~
 : A pseudo-function to execute a limited block of code as a different user.
 : The first argument is the name of the user, the second is the password. If
 : the user can be authenticated, the function will execute the code block
 : given in the third argument with the permissions of that user andreturns the
 : result of the execution. Before the function completes, it switches the
 : current user back to the old user.
 : @param $username The username of the user to run the code against
 : @param $password The password of the user to run the code against
 : @param $code-block The code block to run as the identified user
 : @return the results of the code block executed
 :)
declare function system:as-user($username as xs:string, $password as xs:string?, $code-block as item()*) as item()* external;

(:~
 : Clear the global trace log.
 :)
declare function system:clear-trace() as empty-sequence() external;

(:~
 : Clear XQuery cache.
 :)
declare function system:clear-xquery-cache() as empty-sequence() external;

(:~
 : Returns the number of eXist instances that are active.
 : @return the count
 :)
declare function system:count-instances-active() as xs:integer external;

(:~
 : Returns the number of eXist instances that are available.
 : @return the count
 :)
declare function system:count-instances-available() as xs:integer external;

(:~
 : Returns the maximum number of eXist instances.
 : @return the count
 :)
declare function system:count-instances-max() as xs:integer external;

(:~
 : Enable function tracing on the database instance.
 : @param $enable The boolean flag to enable/disable function tracing
 :)
declare function system:enable-tracing($enable as xs:boolean) as empty-sequence() external;

(:~
 : Enable function tracing on the database instance.
 : @param $enable The enable boolean flag to enable/disable function tracing
 : @param $tracelog The tracelog boolean flag: if set to true, entering/exiting a function will be logged to the logger 'xquery.profiling'
 :)
declare function system:enable-tracing($enable as xs:boolean, $tracelog as xs:boolean) as empty-sequence() external;

(:~
 : Export a backup of the database (admin user only).
 : @param $dir This is an absolute path to where the backup will be written. Must be writeable by the eXist process.
 : @param $incremental Flag to do incremental export.
 : @param $zip Flag to do export to zip file.
 : @return the export results
 :)
declare function system:export($dir as xs:string, $incremental as xs:boolean?, $zip as xs:boolean?) as node() external;

(:~
 : Export a backup of the database (admin user only). Messagers from exporter
 : reroute to logs.
 : @param $dir This is an absolute path to where the backup will be written. Must be writeable by the eXist process.
 : @param $incremental Flag to do incremental export.
 : @param $zip Flag to do export to zip file.
 : @return the export results
 :)
declare function system:export-silently($dir as xs:string, $incremental as xs:boolean?, $zip as xs:boolean?) as xs:boolean external;

(:~
 : A pseudo-function to execute a function as a different user. The first
 : argument is the name of the user, the second is the password. If the user
 : can be authenticated, the function will execute the function given in the
 : third argument with the permissions of that user andreturns the result of
 : the execution. Before the function completes, it switches the current user
 : back to the old user.
 : @param $username The username of the user to run the code against
 : @param $password The password of the user to run the code against
 : @param $function The zero arity function to run as the identified user
 : @return the results of the code block executed
 :)
declare function system:function-as-user($username as xs:string, $password as xs:string?, $function as function(*)) as item()* external;

(:~
 : Returns whether a function is available.
 : @param $function-name The fully qualified name of the function
 : @param $arity The arity of the function
 : @return true() if the function exists, false() otherwise.
 :)
declare function system:function-available($function-name as xs:QName, $arity as xs:integer) as xs:boolean external;

(:~
 : Returns the build of eXist running this query.
 : @return the build number
 :)
declare function system:get-build() as xs:string external;

(:~
 : Returns the eXist home location.
 : @return the path to the eXist home
 :)
declare function system:get-exist-home() as xs:string external;

(:~
 : Internal function
 : @return the resource containing the index statistics
 :)
declare function system:get-index-statistics() as node()? external;

(:~
 : Returns the JMXServlet access token, i.e. the secret accepted via the
 : 'token' request parameter of /exist/status (JMXServlet) as an alternative to
 : a request originating from localhost. Resolved via the same DiskUsage
 : MBean-based data directory lookup JMXServlet itself uses, so the two never
 : diverge. Returns the empty sequence if JMX, or the token, could not be
 : resolved. This function is only available to the DBA role.
 : @return the JMXServlet access token, or the empty sequence if it could not be resolved
 :)
declare function system:get-jmx-token() as xs:string? external;

(:~
 : Returns the module load path from the root query context. The module load
 : path corresponds to the location on the file system or the collection in the
 : database of the main module that was compiled.
 : @return the main module load path
 :)
declare function system:get-main-module-load-path() as xs:string external;

(:~
 : Returns the amount of free memory available to eXist.
 : @return the size of memory
 :)
declare function system:get-memory-free() as xs:long external;

(:~
 : Returns the maximum amount of memory eXist may use.
 : @return the size of memory
 :)
declare function system:get-memory-max() as xs:long external;

(:~
 : Returns the total amount of memory in use by eXist.
 : @return the size of memory
 :)
declare function system:get-memory-total() as xs:long external;

(:~
 : Returns the module load path from the current query context. The module load
 : path corresponds to the source location from where this module is loaded.The
 : module load path is also used to resolve relative XInclude paths.
 : @return the module load path
 :)
declare function system:get-module-load-path() as xs:string external;

(:~
 : Returns the product name of the software running this query.
 : @return the product name
 :)
declare function system:get-product-name() as xs:string external;

(:~
 : Returns the Git commit ID of the eXist instance running this query.
 : @return the Git commit ID.
 :)
declare function system:get-revision() as xs:string external;

(:~
 : Get a list of running jobs (dba role only).
 : @return the list of running jobs
 :)
declare function system:get-running-jobs() as item() external;

(:~
 : Get a list of running XQueries (dba role only).
 : @return a node containing the list of running XQueries
 :)
declare function system:get-running-xqueries() as item() external;

(:~
 : Get a list of scheduled jobs (dba role only).
 : @return a node containing the list of scheduled jobs
 :)
declare function system:get-scheduled-jobs() as item() external;

(:~
 : Returns the time since eXist-db was started. The value is stable over the
 : lifetime of a query.
 : @return the duration since eXist-db was started
 :)
declare function system:get-uptime() as xs:dayTimeDuration external;

(:~
 : Returns the version of eXist running this query.
 : @return the version string
 :)
declare function system:get-version() as xs:string external;

(:~
 : Restore the database or a section of the database (admin user only).
 : @param $dir-or-file This is either a backup directory with the backup descriptor (__contents__.xml) or a backup ZIP file.
 : @param $admin-pass The password for the admin user
 : @param $new-admin-pass Set the admin password to this new password.
 : @return the import results
 :)
declare function system:import($dir-or-file as xs:string, $admin-pass as xs:string?, $new-admin-pass as xs:string?) as node() external;

(:~
 : Restore the database or a section of the database (admin user only).
 : Messagers from exporter reroute to logs.
 : @param $dir-or-file This is either a backup directory with the backup descriptor (__contents__.xml) or a backup ZIP file.
 : @param $admin-pass The password for the admin user
 : @param $new-admin-pass Set the admin password to this new password.
 : @return the import results
 :)
declare function system:import-silently($dir-or-file as xs:string, $admin-pass as xs:string?, $new-admin-pass as xs:string?) as node() external;

(:~
 : Kill a running XQuey (dba role only).
 : @param $xquery-id The XQuery ID obtained from get-running-xqueries()
 :)
declare function system:kill-running-xquery($xquery-id as xs:integer) as empty-sequence() external;

(:~
 : Kill a running XQuey (dba role only).
 : @param $xquery-id The XQuery ID obtained from get-running-xqueries()
 : @param $wait-time The wait time in milliseconds before terminating the XQuery
 :)
declare function system:kill-running-xquery($xquery-id as xs:integer, $wait-time as xs:long) as empty-sequence() external;

(:~
 : Restore the database or a section of the database (admin user only).
 : @param $dir-or-file This is either a backup directory with the backup descriptor (__contents__.xml) or a backup ZIP file.
 : @param $admin-pass The password for the admin user
 : @param $new-admin-pass Set the admin password to this new password.
 : @return the restore results
 :)
declare function system:restore($dir-or-file as xs:string, $admin-pass as xs:string?, $new-admin-pass as xs:string?) as node() external;

(:~
 : Restore the database or a section of the database (admin user only).
 : @param $dir-or-file This is either a backup directory with the backup descriptor (__contents__.xml) or a backup ZIP file.
 : @param $admin-pass The password for the admin user
 : @param $new-admin-pass Set the admin password to this new password.
 : @param $overwrite Should newer versions of apps installed in the database be overwritten by those found in the backup? False by default.
 : @return the restore results
 :)
declare function system:restore(
	$dir-or-file as xs:string,
	$admin-pass as xs:string?,
	$new-admin-pass as xs:string?,
	$overwrite as xs:boolean
) as node() external;

(:~
 : Shutdown eXist immediately. This method is only available to the DBA role.
 :)
declare function system:shutdown() as empty-sequence() external;

(:~
 : Shutdown eXist. This method is only available to the DBA role.
 : @param $delay The delay in milliseconds before eXist starts to shutdown.
 :)
declare function system:shutdown($delay as xs:long) as empty-sequence() external;

(:~
 : Returns function call statistics gathered by the trace log.
 : @return the call statistics gathered by the trace
 :)
declare function system:trace() as node() external;

(:~
 : Returns true if function tracing is currently enabled on the database
 : instance.
 : @return true is tracing is enabled.
 :)
declare function system:tracing-enabled() as xs:boolean external;

(:~
 : Trigger a system task.
 : @param $java-classname The full name of the Java class to execute. It must implement org.exist.storage.SystemTask
 : @param $task-parameters The XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 :)
declare function system:trigger-system-task($java-classname as xs:string, $task-parameters as node()?) as empty-sequence() external;

(:~
 : This function is part of the unfinished index statistics module, which is
 : not yet usable in a normal eXist setup. update-statistics rebuilds index
 : statistics for the entire database.
 :)
declare function system:update-statistics() as empty-sequence() external;
