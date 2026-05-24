module namespace datetime = "http://exist-db.org/xquery/datetime";

(:~
 : Returns the date portion of the given xs:dateTime value as xs:date.
 : @param $dateTime The dateTime value
 :)
declare function datetime:date($dateTime as xs:dateTime) as xs:date external;

(:~
 : Returns the time portion of the given xs:dateTime value as xs:time.
 : @param $dateTime The dateTime value
 :)
declare function datetime:time($dateTime as xs:dateTime) as xs:time external;

(:~
 : Returns the xs:dateTime that results from adding the given xs:duration to the given xs:dateTime.
 : @param $dateTime The base dateTime
 : @param $duration The duration to add
 :)
declare function datetime:add($dateTime as xs:dateTime, $duration as xs:duration) as xs:dateTime external;

(:~
 : Returns the xs:dayTimeDuration between two xs:dateTime values.
 : @param $dateTime1 The first dateTime
 : @param $dateTime2 The second dateTime
 :)
declare function datetime:diff($dateTime1 as xs:dateTime, $dateTime2 as xs:dateTime) as xs:dayTimeDuration external;

(:~
 : Formats a dateTime value using the given format string (Java SimpleDateFormat patterns).
 : @param $dateTime The dateTime to format
 : @param $format The format string (e.g. "yyyy-MM-dd HH:mm:ss")
 :)
declare function datetime:format-dateTime($dateTime as xs:dateTime, $format as xs:string) as xs:string external;

(:~
 : Formats a dateTime value using the given format string and locale.
 : @param $dateTime The dateTime to format
 : @param $format The format string
 : @param $locale The locale (e.g. "en", "nl", "de")
 :)
declare function datetime:format-dateTime($dateTime as xs:dateTime, $format as xs:string, $locale as xs:string) as xs:string external;

(:~
 : Formats a date value using the given format string.
 : @param $date The date to format
 : @param $format The format string
 :)
declare function datetime:format-date($date as xs:date, $format as xs:string) as xs:string external;

(:~
 : Formats a date value using the given format string and locale.
 : @param $date The date to format
 : @param $format The format string
 : @param $locale The locale
 :)
declare function datetime:format-date($date as xs:date, $format as xs:string, $locale as xs:string) as xs:string external;

(:~
 : Formats a time value using the given format string.
 : @param $time The time to format
 : @param $format The format string
 :)
declare function datetime:format-time($time as xs:time, $format as xs:string) as xs:string external;

(:~
 : Parses a date/time string using the given format string and returns an xs:dateTime.
 : @param $value The date/time string to parse
 : @param $format The format string (Java SimpleDateFormat)
 :)
declare function datetime:parse-dateTime($value as xs:string, $format as xs:string) as xs:dateTime external;

(:~
 : Returns the day of the week for the given date (1 = Sunday, 7 = Saturday).
 : @param $date The date value
 :)
declare function datetime:day-of-week($date as xs:date) as xs:integer external;

(:~
 : Returns the week in year for the given date.
 : @param $date The date value
 :)
declare function datetime:week-in-year($date as xs:date) as xs:integer external;
