module namespace scheduler = "http://exist-db.org/xquery/scheduler";

(:~
 : Delete the named job named from the Scheduler. Will only delete User
 : Scheduled Jobs! Returns true if the Job was deleted.
 : @param $job-name The name of the job to be deleted
 : @return a boolean value indicating success or failure on deleting the named job.
 :)
declare function scheduler:delete-scheduled-job($job-name as xs:string) as xs:boolean external;

(:~
 : Gets the details of all scheduled jobs in the form: <scheduler:jobs
 : xmlns:scheduler="http://exist-db.org/xquery/scheduler" count="iJobs">
 : <scheduler:group name="group"> <scheduler:job name=""> <scheduler:trigger
 : name=""> <expression></expression> <state></state> <start></start>
 : <end></end> <previous></previous> <next></next> <final></final>
 : </scheduler:trigger> </scheduler:job> </scheduler:group> </scheduler:jobs>
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
