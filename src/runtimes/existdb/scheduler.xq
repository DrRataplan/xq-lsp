module namespace scheduler = "http://exist-db.org/xquery/scheduler";

(: ── Cron-Based Jobs ──────────────────────────────────────────────────────── :)

(:~
 : Schedules an XQuery script to run on a cron schedule.
 : @param $xquery The path to the XQuery script (database URI)
 : @param $period A cron expression (e.g. "0 0 * * * ?")
 : @param $name A unique name for the job
 :)
declare function scheduler:schedule-xquery-cron-job($xquery as xs:string, $period as xs:string, $name as xs:string) as xs:boolean external;

(:~
 : Schedules an XQuery script on a cron schedule with parameters.
 : @param $xquery The path to the XQuery script
 : @param $period A cron expression
 : @param $name A unique name for the job
 : @param $params Job parameters as an element or map
 :)
declare function scheduler:schedule-xquery-cron-job($xquery as xs:string, $period as xs:string, $name as xs:string, $params as item()?) as xs:boolean external;

(:~
 : Schedules an XQuery script on a cron schedule with unschedule-on-exception control.
 : @param $xquery The path to the XQuery script
 : @param $period A cron expression
 : @param $name A unique name for the job
 : @param $params Job parameters
 : @param $unschedule-on-exception If true, unschedule the job when it throws an exception
 :)
declare function scheduler:schedule-xquery-cron-job($xquery as xs:string, $period as xs:string, $name as xs:string, $params as item()?, $unschedule-on-exception as xs:boolean) as xs:boolean external;

(:~
 : Schedules a Java class on a cron schedule.
 : @param $java-classname The fully qualified Java class name implementing Job
 : @param $period A cron expression
 : @param $name A unique name for the job
 :)
declare function scheduler:schedule-java-cron-job($java-classname as xs:string, $period as xs:string, $name as xs:string) as xs:boolean external;

(:~
 : Schedules a Java class on a cron schedule with parameters.
 : @param $java-classname The fully qualified Java class name
 : @param $period A cron expression
 : @param $name A unique name for the job
 : @param $params Job parameters
 :)
declare function scheduler:schedule-java-cron-job($java-classname as xs:string, $period as xs:string, $name as xs:string, $params as item()?) as xs:boolean external;

(: ── Periodic Jobs ────────────────────────────────────────────────────────── :)

(:~
 : Schedules an XQuery script to run at a fixed interval (milliseconds).
 : @param $xquery The path to the XQuery script
 : @param $period The interval in milliseconds
 :)
declare function scheduler:schedule-xquery-periodic-job($xquery as xs:string, $period as xs:long) as xs:boolean external;

(:~
 : Schedules an XQuery script at a fixed interval with a name.
 : @param $xquery The path to the XQuery script
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 :)
declare function scheduler:schedule-xquery-periodic-job($xquery as xs:string, $period as xs:long, $name as xs:string) as xs:boolean external;

(:~
 : Schedules an XQuery script at a fixed interval with name and parameters.
 : @param $xquery The path to the XQuery script
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 : @param $params Job parameters
 :)
declare function scheduler:schedule-xquery-periodic-job($xquery as xs:string, $period as xs:long, $name as xs:string, $params as item()?) as xs:boolean external;

(:~
 : Schedules an XQuery script at a fixed interval with a start delay.
 : @param $xquery The path to the XQuery script
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 : @param $params Job parameters
 : @param $delay Initial delay in milliseconds before the first execution
 :)
declare function scheduler:schedule-xquery-periodic-job($xquery as xs:string, $period as xs:long, $name as xs:string, $params as item()?, $delay as xs:long) as xs:boolean external;

(:~
 : Schedules an XQuery script at a fixed interval with a start delay and repeat count.
 : @param $xquery The path to the XQuery script
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 : @param $params Job parameters
 : @param $delay Initial delay in milliseconds
 : @param $repeat Number of repetitions (-1 for indefinite)
 :)
declare function scheduler:schedule-xquery-periodic-job($xquery as xs:string, $period as xs:long, $name as xs:string, $params as item()?, $delay as xs:long, $repeat as xs:integer) as xs:boolean external;

(:~
 : Schedules a Java class to run at a fixed interval.
 : @param $java-classname The fully qualified Java class name
 : @param $period The interval in milliseconds
 :)
declare function scheduler:schedule-java-periodic-job($java-classname as xs:string, $period as xs:long) as xs:boolean external;

(:~
 : Schedules a Java class at a fixed interval with a name.
 : @param $java-classname The fully qualified Java class name
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 :)
declare function scheduler:schedule-java-periodic-job($java-classname as xs:string, $period as xs:long, $name as xs:string) as xs:boolean external;

(:~
 : Schedules a Java class at a fixed interval with name and parameters.
 : @param $java-classname The fully qualified Java class name
 : @param $period The interval in milliseconds
 : @param $name A unique name for the job
 : @param $params Job parameters
 :)
declare function scheduler:schedule-java-periodic-job($java-classname as xs:string, $period as xs:long, $name as xs:string, $params as item()?) as xs:boolean external;

(: ── Job Control ──────────────────────────────────────────────────────────── :)

(:~
 : Returns information about all scheduled jobs as an element.
 :)
declare function scheduler:get-scheduled-jobs() as element()? external;

(:~
 : Removes (unschedules) the job with the given name.
 : @param $name The job name
 :)
declare function scheduler:delete-scheduled-job($name as xs:string) as xs:boolean external;

(:~
 : Pauses the job with the given name.
 : @param $name The job name
 :)
declare function scheduler:pause-scheduled-job($name as xs:string) as xs:boolean external;

(:~
 : Resumes a previously paused job.
 : @param $name The job name
 :)
declare function scheduler:resume-scheduled-job($name as xs:string) as xs:boolean external;

(:~
 : Immediately triggers a single execution of the job with the given name.
 : @param $name The job name
 :)
declare function scheduler:run-scheduled-job($name as xs:string) as xs:boolean external;
