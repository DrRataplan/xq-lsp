module namespace fn="http://www.w3.org/2005/xpath-functions";

(:~
 : Returns true if the argument is a non-empty sequence, false if it is the empty sequence.
 : @param $arg The sequence to test
 : @return true if $arg is non-empty
 :)
declare function fn:exists($arg as item()*) as xs:boolean external;

(:~
 : Returns true if the argument is the empty sequence, false if it is a non-empty sequence.
 : @param $arg The sequence to test
 : @return true if $arg is empty
 :)
declare function fn:empty($arg as item()*) as xs:boolean external;

(:~
 : Returns the xs:boolean value true.
 : @return true
 :)
declare function fn:true() as xs:boolean external;

(:~
 : Returns the xs:boolean value false.
 : @return false
 :)
declare function fn:false() as xs:boolean external;
