module namespace ws = "http://exist-db.org/xquery/websocket";

(:~
 : Broadcast a message to ALL connected WebSocket clients, regardless of
 : channel.
 : @param $items Values to broadcast.
 : @return Empty
 :)
declare function ws:broadcast($items as item()*) as empty-sequence() external;

(:~
 : Return the number of WebSocket clients subscribed to a channel.
 : @param $channel The channel name.
 : @return The subscriber count.
 :)
declare function ws:channel-count($channel as xs:string) as xs:integer external;

(:~
 : Log items to the 'default' WebSocket channel.
 : @param $items Values to send. Will be concatenated into a single string.
 : @return Empty
 :)
declare function ws:log($items as item()*) as empty-sequence() external;

(:~
 : Log items to a specific WebSocket channel.
 : @param $channel The channel to log to.
 : @param $items Values to send. Will be concatenated into a single string.
 : @return Empty
 :)
declare function ws:log($channel as xs:string, $items as item()*) as empty-sequence() external;

(:~
 : Send a JSON message to a WebSocket channel.
 : @param $channel The channel to send to.
 : @param $items Value to send. Will be serialized as JSON.
 : @return Empty
 :)
declare function ws:send($channel as xs:string, $items as item()?) as empty-sequence() external;
