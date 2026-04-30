module namespace math="http://www.w3.org/2005/xpath-functions/math";

(:~
 : Returns the mathematical constant π (approximately 3.14159265358979).
 : @return π as xs:double
 :)
declare function math:pi() as xs:double external;

(:~
 : Returns e raised to the power of a number (eˣ).
 : @param $x The exponent
 : @return e^x
 :)
declare function math:exp($x as xs:double?) as xs:double? external;

(:~
 : Returns 10 raised to the power of a number.
 : @param $x The exponent
 : @return 10^x
 :)
declare function math:exp10($x as xs:double?) as xs:double? external;

(:~
 : Returns the natural logarithm of a number.
 : @param $x The value (must be positive)
 : @return ln(x)
 :)
declare function math:log($x as xs:double?) as xs:double? external;

(:~
 : Returns the base-10 logarithm of a number.
 : @param $x The value (must be positive)
 : @return log₁₀(x)
 :)
declare function math:log10($x as xs:double?) as xs:double? external;

(:~
 : Returns a number raised to the power of another.
 : @param $x The base
 : @param $y The exponent
 : @return x^y
 :)
declare function math:pow($x as xs:double?, $y as xs:numeric) as xs:double? external;

(:~
 : Returns the square root of a number.
 : @param $x The value (must be non-negative)
 : @return √x
 :)
declare function math:sqrt($x as xs:double?) as xs:double? external;

(:~
 : Returns the sine of an angle given in radians.
 : @param $x The angle in radians
 : @return sin(x)
 :)
declare function math:sin($x as xs:double?) as xs:double? external;

(:~
 : Returns the cosine of an angle given in radians.
 : @param $x The angle in radians
 : @return cos(x)
 :)
declare function math:cos($x as xs:double?) as xs:double? external;

(:~
 : Returns the tangent of an angle given in radians.
 : @param $x The angle in radians
 : @return tan(x)
 :)
declare function math:tan($x as xs:double?) as xs:double? external;

(:~
 : Returns the arc sine of a value, in radians.
 : @param $x The value (between -1 and 1)
 : @return asin(x) in radians
 :)
declare function math:asin($x as xs:double?) as xs:double? external;

(:~
 : Returns the arc cosine of a value, in radians.
 : @param $x The value (between -1 and 1)
 : @return acos(x) in radians
 :)
declare function math:acos($x as xs:double?) as xs:double? external;

(:~
 : Returns the arc tangent of a value, in radians.
 : @param $x The value
 : @return atan(x) in radians
 :)
declare function math:atan($x as xs:double?) as xs:double? external;

(:~
 : Returns the angle in radians from the positive x-axis to the point (x, y).
 : @param $y The y coordinate
 : @param $x The x coordinate
 : @return The angle in radians (between -π and π)
 :)
declare function math:atan2($y as xs:double, $x as xs:double) as xs:double external;
