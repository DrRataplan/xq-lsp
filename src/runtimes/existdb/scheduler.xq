module namespace scheduler = "http://exist-db.org/xquery/scheduler";

(:~
 : Delete the named job named from the Scheduler. Will only delete User
 : Scheduled Jobs! Returns true if the Job was deleted.
 : @param $job-name The name of the job to be deleted
 : @return a boolean value indicating success or failure on deleting the named job.
 :)
declare function scheduler:delete-scheduled-job($job-name as xs:string) as xs:boolean external;

(:~
 : Gets the details of all scheduled jobs in the form: &lt;scheduler:jobs
 : xmlns:scheduler="http://exist-db.org/xquery/scheduler" count="iJobs">
 : &lt;scheduler:group name="group"> &lt;scheduler:job name="">
 : &lt;scheduler:trigger name=""> &lt;expression>&lt;/expression>
 : &lt;state>&lt;/state> &lt;start>&lt;/start> &lt;end>&lt;/end>
 : &lt;previous>&lt;/previous> &lt;next>&lt;/next> &lt;final>&lt;/final>
 : &lt;/scheduler:trigger> &lt;/scheduler:job>
 : &lt;/scheduler:group>&lt;/scheduler:jobs>
 : @return the XML containing the list of jobs
 :)
declare function scheduler:get-scheduled-jobs() as node() external;

(:~
 : Pause the named job in the scheduler. Will only pause user scheduled jobs!
 : @param $job-name The name of the job in the scheduler
 : @return the success of the pausing of the named job
 :)
declare function scheduler:pause-scheduled-job($job-name as xs:string) as xs:boolean external;

(:~
 : Resumes the named job in the scheduler. Will only resume user scheduled
 : jobs!
 : @param $job-name The name of the job to resume.
 : @return the indicator of successful resumption
 :)
declare function scheduler:resume-scheduled-job($job-name as xs:string) as xs:boolean external;

(:~
 : Schedules the Java Class named (the class must extend
 : org.exist.scheduler.UserJavaJob) according to the Cron expression. The job
 : will be registered using the job name.
 : @param $java-classname The full name of the class to be executed. It must extend the org.exist.scheduler.UserJavaJob class.
 : @param $cron-expression The cron expression. Please see the scheduler documentation.
 : @param $job-name The name of the job.
 : @return a flag indicating successful execution
 :)
declare function scheduler:schedule-java-cron-job($java-classname as xs:string, $cron-expression as xs:string, $job-name as xs:string) as xs:boolean external;

(:~
 : Schedules the Java Class named (the class must extend
 : org.exist.scheduler.UserJavaJob) according to the Cron expression. The job
 : will be registered using the name passed in $job-name. The final argument
 : can be used to specify parameters for the job, which will be passed to the
 : query as external variables. Parameters are specified in an XML fragment
 : with the following structure: &lt;parameters>&lt;param name="param-name1"
 : value="param-value1"/>&lt;/parameters>.
 : @param $java-classname The full name of the class to be executed. It must extend the org.exist.scheduler.UserJavaJob class.
 : @param $cron-expression The cron expression. Please see the scheduler documentation.
 : @param $job-name The name of the job.
 : @param $job-parameters The XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @return a flag indicating successful execution
 :)
declare function scheduler:schedule-java-cron-job(
	$java-classname as xs:string,
	$cron-expression as xs:string,
	$job-name as xs:string,
	$job-parameters as element()?
) as xs:boolean external;

(:~
 : Schedules the Java Class named (the class must extend
 : org.exist.scheduler.UserJavaJob) according to the periodic value. The job
 : will be registered using the job name. The $job-parameters argument can be
 : used to specify parameters for the job, which will be passed to the query as
 : external variables. Parameters are specified in an XML fragment with the
 : following structure: &lt;parameters>&lt;param name="param-name1"
 : value="param-value1"/>&lt;/parameters>, Given the delay and the repeat.
 : @param $java-classname The full name of the class to be executed. It must extend the org.exist.scheduler.UserJavaJob class.
 : @param $period Time in milliseconds between execution of the job
 : @param $job-name The name of the job.
 : @param $job-parameters The XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @param $delay The period in milliseconds to delay the start of a job.
 : @param $repeat The number of times to repeat the job after the initial execution. A value of -1 means repeat forever.
 : @return a flag indicating successful execution
 :)
declare function scheduler:schedule-java-periodic-job(
	$java-classname as xs:string,
	$period as xs:integer,
	$job-name as xs:string,
	$job-parameters as element()?,
	$delay as xs:integer,
	$repeat as xs:integer
) as xs:boolean external;

(:~
 : Schedules the named XQuery resource (e.g. /db/foo.xql) according to the Cron
 : expression. XQuery job's will be launched under the guest account initially,
 : although the running XQuery may switch permissions through calls to
 : xmldb:login(). The job will be registered using the job name. Jobs submitted
 : via this function are transitory and will be lost on a server restart. To
 : ensure the persistence of scheduled tasks add them to the conf.xml file.
 : @param $xquery-resource The path to the XQuery resource
 : @param $cron-expression The cron expression. Please see the scheduler documentation.
 : @param $job-name The name of the job.
 : @return a flag indicating successful execution
 :)
declare function scheduler:schedule-xquery-cron-job($xquery-resource as xs:string, $cron-expression as xs:string, $job-name as xs:string) as xs:boolean external;

(:~
 : Schedules the named XQuery resource (e.g. /db/foo.xql) according to the Cron
 : expression. XQuery job's will be launched under the guest account initially,
 : although the running XQuery may switch permissions through calls to
 : xmldb:login(). The job will be registered using the job name. The final
 : argument can be used to specify parameters for the job, which will be passed
 : to the query as external variables. Parameters are specified in an XML
 : fragment with the following structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters> Jobs submitted via
 : this function are transitory and will be lost on a server restart. To ensure
 : the persistence of scheduled tasks add them to the conf.xml file.
 : @param $xquery-resource The path to the XQuery resource
 : @param $cron-expression A cron expression. Please see the scheduler documentation.
 : @param $job-name The name of the job.
 : @param $job-parameters XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @return Flag indicating successful execution
 :)
declare function scheduler:schedule-xquery-cron-job(
	$xquery-resource as xs:string,
	$cron-expression as xs:string,
	$job-name as xs:string,
	$job-parameters as element()?
) as xs:boolean external;

(:~
 : Schedules the named XQuery resource (e.g. /db/foo.xql) according to the Cron
 : expression. XQuery job's will be launched under the guest account initially,
 : although the running XQuery may switch permissions through calls to
 : xmldb:login(). The job will be registered using the job name. The job
 : parameters argument can be used to specify parameters for the job, which
 : will be passed to the query as external variables. Parameters are specified
 : in an XML fragment with the following structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters> Jobs submitted via
 : this function are transitory and will be lost on a server restart. To ensure
 : the persistence of scheduled tasks add them to the conf.xml file.
 : @param $xquery-resource The path to the XQuery resource
 : @param $cron-expression A cron expression. Please see the scheduler documentation.
 : @param $job-name The name of the job.
 : @param $job-parameters XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @param $unschedule Specifies whether to unschedule this job if an XPathException is raised, default is true.
 : @return Flag indicating successful execution
 :)
declare function scheduler:schedule-xquery-cron-job(
	$xquery-resource as xs:string,
	$cron-expression as xs:string,
	$job-name as xs:string,
	$job-parameters as element()?,
	$unschedule as xs:boolean
) as xs:boolean external;

(:~
 : Schedules the named XQuery resource (e.g. /db/foo.xql) according to the
 : period. XQuery job's will be launched under the guest account initially,
 : although the running XQuery may switch permissions through calls to
 : xmldb:login(). The job will be registered using the job name. The job
 : parameters argument can be used to specify parameters for the job, which
 : will be passed to the query as external variables. Parameters are specified
 : in an XML fragment with the following structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters>, Given the delay
 : passed and the repeat value. Jobs submitted via this function are transitory
 : and will be lost on a server restart. To ensure the persistence of scheduled
 : tasks add them to the conf.xml file.
 : @param $xquery-resource The path to the XQuery resource
 : @param $period Time in milliseconds between execution of the job
 : @param $job-name The name of the job.
 : @param $job-parameters XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @param $delay Can be used with a period in milliseconds to delay the start of a job.
 : @param $repeat Number of times to repeat the job after the initial execution. A value of -1 means repeat forever.
 : @return Flag indicating successful execution
 :)
declare function scheduler:schedule-xquery-periodic-job(
	$xquery-resource as xs:string,
	$period as xs:integer,
	$job-name as xs:string,
	$job-parameters as element()?,
	$delay as xs:integer,
	$repeat as xs:integer
) as xs:boolean external;

(:~
 : Schedules the named XQuery resource (e.g. /db/foo.xql) according to the
 : period. XQuery job's will be launched under the guest account initially,
 : although the running XQuery may switch permissions through calls to
 : xmldb:login(). The job will be registered using the job name. The job
 : parameters argument can be used to specify parameters for the job, which
 : will be passed to the query as external variables. Parameters are specified
 : in an XML fragment with the following structure: &lt;parameters>&lt;param
 : name="param-name1" value="param-value1"/>&lt;/parameters>, Given the delay
 : passed and the repeat value. Jobs submitted via this function are transitory
 : and will be lost on a server restart. To ensure the persistence of scheduled
 : tasks add them to the conf.xml file.
 : @param $xquery-resource The path to the XQuery resource
 : @param $period Time in milliseconds between execution of the job
 : @param $job-name The name of the job.
 : @param $job-parameters XML fragment with the following structure: &lt;parameters>&lt;param name="param-name1" value="param-value1"/>&lt;/parameters>
 : @param $delay Can be used with a period in milliseconds to delay the start of a job.
 : @param $repeat Number of times to repeat the job after the initial execution. A value of -1 means repeat forever.
 : @param $unschedule Specifies whether to unschedule this job if an XPathException is raised, default is true.
 : @return Flag indicating successful execution
 :)
declare function scheduler:schedule-xquery-periodic-job(
	$xquery-resource as xs:string,
	$period as xs:integer,
	$job-name as xs:string,
	$job-parameters as element()?,
	$delay as xs:integer,
	$repeat as xs:integer,
	$unschedule as xs:boolean
) as xs:boolean external;
