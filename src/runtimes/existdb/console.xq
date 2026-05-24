module namespace console = "http://exist-db.org/xquery/console";

(:~
 : Log items to the 'default' console channel.
 : @param $items Values to log.
 : @return Empty
 :)
declare function console:log($items as item()*) as empty-sequence() external;

(:~
 : Log items to a specific console channel.
 : @param $channel The channel to log to.
 : @param $items Values to log.
 : @return Empty
 :)
declare function console:log($channel as xs:string, $items as item()*) as empty-sequence() external;

(:~
 : Send a JSON message to a console channel.
 : @param $channel The channel to send to.
 : @param $items Value to send as JSON.
 : @return Empty
 :)
declare function console:send($channel as xs:string, $items as item()?) as empty-sequence() external;
