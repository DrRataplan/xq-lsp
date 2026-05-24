module namespace mail = "http://exist-db.org/xquery/mail";

(:~
 : Closes a mail folder.
 : @param $expunge A boolean that specifies whether to expunge the folder on close.
 :)
declare function mail:close-mail-folder(
	$mail-folder-handle as xs:long,
	$expunge as xs:boolean
) as empty-sequence() external;

(:~
 : Closes a mail store.
 :)
declare function mail:close-mail-store($mail-store-handle as xs:long) as empty-sequence() external;

(:~
 : Closes a message list.
 :)
declare function mail:close-message-list($message-list-handle as xs:long) as empty-sequence() external;

(:~
 : Opens a mail folder.
 : @param $foldername The name of the folder to open
 : @return an xs:long representing the folder handle.
 :)
declare function mail:get-mail-folder($mail-store-handle as xs:long, $foldername as xs:string) as xs:long? external;

(:~
 : Opens a JavaMail session.
 : @param $properties An optional JavaMail session properties in the form <properties><property name="" value=""/></properties>. The JavaMail properties are spelled out in Appendix A of the JavaMail specifications.
 : @return an xs:long representing the session handle.
 :)
declare function mail:get-mail-session($properties as element()?) as xs:long? external;

(:~
 : Opens a JavaMail session with authentication.
 : @param $properties An optional JavaMail session properties in the form <properties><property name="" value=""/></properties>. The JavaMail properties are spelled out in Appendix A of the JavaMail specifications.
 : @param $authentication The username and password for authentication in the form <authentication username="" password=""/>.
 : @return an xs:long representing the session handle.
 :)
declare function mail:get-mail-session($properties as element()?, $authentication as element()) as xs:long? external;

(:~
 : Opens a mail store. Host/User/Password/Protocol values will be obtained from
 : the session.
 : @return an xs:long representing the store handle.
 :)
declare function mail:get-mail-store($mail-handle as xs:long) as xs:long? external;

(:~
 : Returns a message list of all messages in a folder.
 : @return an xs:long representing the message list handle.
 :)
declare function mail:get-message-list($mail-folder-handle as xs:long) as xs:long? external;

(:~
 : Returns a message list of all messages in a folder as XML. If there are no
 : messages in the list, an empty sequence will be returned
 : @param $include-headers A boolean specifying whether to include message headers
 : @return the list of all messages in a folder as XML
 :)
declare function mail:get-message-list-as-xml(
	$message-list-handle as xs:long,
	$include-headers as xs:boolean
) as element()? external;

(:~
 : Returns a sequence of emails as XML. If there are no messages-numbers in the
 : list, an empty sequence will be returned. Please see
 : get_messages_example.xql.
 : @param $message-numbers The messages to retrieve using the numbers from the message-list '//mail:message/@number'
 : @return the chosen messages as XML mail:messages/mail:message
 :)
declare function mail:get-messages(
	$message-list-handle as xs:long,
	$message-numbers as xs:integer*
) as element()? external;

(:~
 : Searches messages in a folder. Search terms are of the form <searchTerm
 : type="xxx">...</searchTerm>. Valid types include: not, and, or, from,
 : subject, body, recipient, header, flag, sent, received. <searchTerm
 : type="not"> requires a single nested child search term. <searchTerm
 : type="and"> and <searchTerm type="or"> must have one or more nested child
 : search terms. <searchTerm type="from" pattern="pat">, <searchTerm
 : type="subject" pattern="pat"> and <searchTerm type="body" pattern="pat">
 : require a pattern attribute and will search for a substring that matches the
 : pattern. <searchTerm type="recipient" pattern="pat"
 : recipientType="to|cc|bcc"> requires pattern and recipientType attributes.
 : <searchTerm type="header" pattern="pat" name="Content-Type"> requires
 : pattern and name attributes. <searchTerm type="flag"
 : flag="answered|deleted|draft|recent|seen" value="true|false"> requires flag
 : and value attributes. <searchTerm type="sent" comparison="eq|gt|ge|lt|le|ne"
 : format="format" date="date"> and <searchTerm type="received"
 : comparison="eq|gt|ge|lt|le|ne" format="format" date="date"> require
 : comparison, format and date attributes. The format string should conform to
 : Java SimpleDateFormat specifications and the date string must conform to the
 : specified format string.
 : @param $search-parameters The xml fragment defining the search terms
 : @return an xs:long representing the message list handle.
 :)
declare function mail:search-message-list(
	$mail-folder-handle as xs:long,
	$search-parameters as element()
) as xs:long? external;

(:~
 : Sends an email using javax.mail messaging libraries.
 : @param $email The email message in the following format: <mail> <from/> <reply-to/> <to/> <cc/> <bcc/> <subject/> <message> <text/> <xhtml/> </message> <attachment filename="" mimetype="">xs:base64Binary</attachment> </mail>.
 :)
declare function mail:send-email($mail-handle as xs:long, $email as element()+) as empty-sequence() external;

(:~
 : Sends an email through the SMTP Server.
 : @param $email The email message in the following format: <mail> <from/> <reply-to/> <to/> <cc/> <bcc/> <subject/> <message> <text/> <xhtml/> </message> <attachment filename="" mimetype="">xs:base64Binary</attachment> </mail>.
 : @param $server The SMTP server. If empty, then it tries to use the local sendmail program.
 : @return true if the email message was successfully sent
 :)
declare function mail:send-email(
	$email as element()+,
	$server as xs:string?,
	$charset as xs:string?
) as xs:boolean+ external;
