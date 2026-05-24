module namespace mail = "http://exist-db.org/xquery/mail";

(:~
 : Sends an email message using the given JavaMail session configuration.
 : The $message parameter must be a &lt;mail:Message&gt; element with the expected structure.
 : @param $session A &lt;mail:Session&gt; element describing the SMTP connection (host, port, from, etc.)
 : @param $message A &lt;mail:Message&gt; element with To, Subject, and Body children
 :)
declare function mail:send-message($session as element(), $message as element()) as xs:boolean external;

(:~
 : Gets a JavaMail session using the named JNDI resource.
 : @param $jndi-name The JNDI resource name for the mail session
 :)
declare function mail:get-mail-session($jndi-name as xs:string) as xs:long external;

(:~
 : Sends a message using a session obtained from JNDI.
 : @param $session-handle The session handle returned by mail:get-mail-session
 : @param $message A &lt;mail:Message&gt; element
 :)
declare function mail:send-message($session-handle as xs:long, $message as element()) as xs:boolean external;

(:~
 : Closes a mail session obtained via JNDI.
 : @param $session-handle The session handle to close
 :)
declare function mail:close-mail-session($session-handle as xs:long) as empty-sequence() external;
