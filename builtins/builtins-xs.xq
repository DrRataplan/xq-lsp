module namespace xs = "http://www.w3.org/2001/XMLSchema";

(: XQuery 3.1 §4.4.1 constructor functions — each takes exactly one xs:anyAtomicType? argument.
   Abstract types (xs:anyAtomicType, xs:anySimpleType, xs:anyType) and xs:NOTATION are
   intentionally absent; calls to them are undefined → XPST0017 "not declared".
   xs:error IS defined (arity 1) but always raises FORG0001 at runtime.
   xs:numeric IS defined as a union-type constructor in XPath 3.1. :)

declare function xs:string($value as xs:anyAtomicType?) as xs:string external;
declare function xs:boolean($value as xs:anyAtomicType?) as xs:boolean external;
declare function xs:decimal($value as xs:anyAtomicType?) as xs:decimal external;
declare function xs:float($value as xs:anyAtomicType?) as xs:float external;
declare function xs:double($value as xs:anyAtomicType?) as xs:double external;
declare function xs:duration($value as xs:anyAtomicType?) as xs:duration external;
declare function xs:dateTime($value as xs:anyAtomicType?) as xs:dateTime external;
declare function xs:time($value as xs:anyAtomicType?) as xs:time external;
declare function xs:date($value as xs:anyAtomicType?) as xs:date external;
declare function xs:gYearMonth($value as xs:anyAtomicType?) as xs:gYearMonth external;
declare function xs:gYear($value as xs:anyAtomicType?) as xs:gYear external;
declare function xs:gMonthDay($value as xs:anyAtomicType?) as xs:gMonthDay external;
declare function xs:gDay($value as xs:anyAtomicType?) as xs:gDay external;
declare function xs:gMonth($value as xs:anyAtomicType?) as xs:gMonth external;
declare function xs:hexBinary($value as xs:anyAtomicType?) as xs:hexBinary external;
declare function xs:base64Binary($value as xs:anyAtomicType?) as xs:base64Binary external;
declare function xs:anyURI($value as xs:anyAtomicType?) as xs:anyURI external;
declare function xs:QName($value as xs:anyAtomicType?) as xs:QName external;
declare function xs:untypedAtomic($value as xs:anyAtomicType?) as xs:untypedAtomic external;

declare function xs:integer($value as xs:anyAtomicType?) as xs:integer external;
declare function xs:long($value as xs:anyAtomicType?) as xs:long external;
declare function xs:int($value as xs:anyAtomicType?) as xs:int external;
declare function xs:short($value as xs:anyAtomicType?) as xs:short external;
declare function xs:byte($value as xs:anyAtomicType?) as xs:byte external;
declare function xs:nonPositiveInteger($value as xs:anyAtomicType?) as xs:nonPositiveInteger external;
declare function xs:negativeInteger($value as xs:anyAtomicType?) as xs:negativeInteger external;
declare function xs:nonNegativeInteger($value as xs:anyAtomicType?) as xs:nonNegativeInteger external;
declare function xs:positiveInteger($value as xs:anyAtomicType?) as xs:positiveInteger external;
declare function xs:unsignedLong($value as xs:anyAtomicType?) as xs:unsignedLong external;
declare function xs:unsignedInt($value as xs:anyAtomicType?) as xs:unsignedInt external;
declare function xs:unsignedShort($value as xs:anyAtomicType?) as xs:unsignedShort external;
declare function xs:unsignedByte($value as xs:anyAtomicType?) as xs:unsignedByte external;

declare function xs:normalizedString($value as xs:anyAtomicType?) as xs:normalizedString external;
declare function xs:token($value as xs:anyAtomicType?) as xs:token external;
declare function xs:language($value as xs:anyAtomicType?) as xs:language external;
declare function xs:NMTOKEN($value as xs:anyAtomicType?) as xs:NMTOKEN external;
declare function xs:Name($value as xs:anyAtomicType?) as xs:Name external;
declare function xs:NCName($value as xs:anyAtomicType?) as xs:NCName external;
declare function xs:ID($value as xs:anyAtomicType?) as xs:ID external;
declare function xs:IDREF($value as xs:anyAtomicType?) as xs:IDREF external;
declare function xs:ENTITY($value as xs:anyAtomicType?) as xs:ENTITY external;

declare function xs:yearMonthDuration($value as xs:anyAtomicType?) as xs:yearMonthDuration external;
declare function xs:dayTimeDuration($value as xs:anyAtomicType?) as xs:dayTimeDuration external;
declare function xs:dateTimeStamp($value as xs:anyAtomicType?) as xs:dateTimeStamp external;

declare function xs:numeric($value as xs:anyAtomicType?) as xs:numeric external;
declare function xs:error($value as xs:anyAtomicType?) as xs:error external;

(: List-type constructors: accept a whitespace-separated string of tokens :)
declare function xs:IDREFS($value as xs:anyAtomicType?) as xs:IDREFS external;
declare function xs:NMTOKENS($value as xs:anyAtomicType?) as xs:NMTOKENS external;
declare function xs:ENTITIES($value as xs:anyAtomicType?) as xs:ENTITIES external;
