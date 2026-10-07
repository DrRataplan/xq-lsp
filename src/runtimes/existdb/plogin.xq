module namespace plogin = "http://exist-db.org/xquery/persistentlogin";

(:~
 : Invalidate the supplied one-time token, so it can no longer be used to log
 : in.
 : @param $token a valid one-time token
 : @return empty sequence
 :)
declare function plogin:invalidate($token as xs:string) as empty-sequence() external;

(:~
 : Try to log in the user based on the supplied token. If the login succeeds,
 : the provided callback function is called with 4 arguments: $token as
 : xs:string, $user as xs:string, $password as xs:string, $timeToLive as
 : duration. $token will be a new token which can be used for the next request.
 : The old token is deleted.
 : @param $token a valid one-time token
 : @param $onLogin callback function to be called when the login succeeds
 : @return result of the callback function or the empty sequence
 :)
declare function plogin:login($token as xs:string, $onLogin as function(*)?) as item()* external;

(:~
 : Try to log in the user and create a one-time login token. The token can be
 : stored to a cookie and used to log in (via the login function) as the same
 : user without providing credentials. However, for security reasons the token
 : will be valid only for the next request to the login function and is deleted
 : afterwards. If the user is valid and the token could be generated, the
 : supplied callback function is called with 4 arguments: $token as xs:string,
 : $user as xs:string, $password as xs:string, $timeToLive as xs:duration.
 : @param $user user name
 : @param $password password
 : @param $timeToLive duration for which the user is remembered
 : @param $onLogin callback function to be called when the login succeeds
 : @return result of the callback function or the empty sequence
 :)
declare function plogin:register(
	$user as xs:string,
	$password as xs:string?,
	$timeToLive as xs:duration,
	$onLogin as function(*)?
) as item()* external;
