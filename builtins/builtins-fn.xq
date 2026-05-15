module namespace fn="http://www.w3.org/2005/xpath-functions";

(: ── Accessors ──────────────────────────────────────────────────────────────── :)

(:~ Returns the name of a node as a QName. :)
declare function fn:node-name() as xs:QName? external;
(:~ @param $arg The node whose name to return :)
declare function fn:node-name($arg as node()?) as xs:QName? external;

(:~ Returns true if the element has been nilled. :)
declare function fn:nilled() as xs:boolean? external;
(:~ @param $arg The node to test :)
declare function fn:nilled($arg as node()?) as xs:boolean? external;

(:~ Returns the string value of the context item. :)
declare function fn:string() as xs:string external;
(:~
 : Returns the string value of an item.
 : @param $arg The item to convert to string
 : @return The string value
 :)
declare function fn:string($arg as item()?) as xs:string external;

(:~ Atomizes the context item. :)
declare function fn:data() as xs:anyAtomicType* external;
(:~
 : Atomizes a sequence, extracting typed values from nodes.
 : @param $arg The sequence to atomize
 : @return The atomized values
 :)
declare function fn:data($arg as item()*) as xs:anyAtomicType* external;

(:~ Returns the base URI of the context node. :)
declare function fn:base-uri() as xs:anyURI? external;
(:~
 : Returns the base URI of a node.
 : @param $arg The node
 : @return The base URI, or empty sequence if absent
 :)
declare function fn:base-uri($arg as node()?) as xs:anyURI? external;

(:~ Returns the document URI of the context node. :)
declare function fn:document-uri() as xs:anyURI? external;
(:~
 : Returns the document URI of a document node.
 : @param $arg The document node
 : @return The document URI, or empty sequence if absent
 :)
declare function fn:document-uri($arg as node()?) as xs:anyURI? external;

(: ── Error and diagnostics ─────────────────────────────────────────────────── :)

(:~ Raises a dynamic error. :)
declare function fn:error() as empty-sequence() external;
(:~ @param $code Error code :)
declare function fn:error($code as xs:QName?) as empty-sequence() external;
(:~ @param $code Error code @param $description Error message :)
declare function fn:error($code as xs:QName?, $description as xs:string) as empty-sequence() external;
(:~ @param $code Error code @param $description Error message @param $error-object Additional error data :)
declare function fn:error($code as xs:QName?, $description as xs:string, $error-object as item()*) as empty-sequence() external;

(:~
 : Returns the value of the first argument unchanged and emits a diagnostic trace message.
 : @param $value The value to return unchanged
 : @param $label A label for the trace output
 : @return The input value
 :)
declare function fn:trace($value as item()*, $label as xs:string) as item()* external;

(: ── Numeric functions ──────────────────────────────────────────────────────── :)

(:~
 : Returns the absolute value of a number.
 : @param $arg The number
 : @return The absolute value
 :)
declare function fn:abs($arg as xs:numeric?) as xs:numeric? external;

(:~
 : Rounds a number up to the nearest integer.
 : @param $arg The number to round up
 : @return The smallest integer not less than $arg
 :)
declare function fn:ceiling($arg as xs:numeric?) as xs:numeric? external;

(:~
 : Rounds a number down to the nearest integer.
 : @param $arg The number to round down
 : @return The largest integer not greater than $arg
 :)
declare function fn:floor($arg as xs:numeric?) as xs:numeric? external;

(:~
 : Rounds a number to the nearest integer.
 : @param $arg The number to round
 : @return The nearest integer
 :)
declare function fn:round($arg as xs:numeric?) as xs:numeric? external;
(:~
 : Rounds a number to a specified precision.
 : @param $arg The number to round
 : @param $precision Number of decimal places
 : @return The rounded number
 :)
declare function fn:round($arg as xs:numeric?, $precision as xs:integer) as xs:numeric? external;

(:~
 : Rounds to the nearest value, rounding halfway values to the nearest even number.
 : @param $arg The number to round
 : @return The rounded number
 :)
declare function fn:round-half-to-even($arg as xs:numeric?) as xs:numeric? external;
(:~
 : @param $arg The number to round
 : @param $precision Number of decimal places
 : @return The rounded number
 :)
declare function fn:round-half-to-even($arg as xs:numeric?, $precision as xs:integer) as xs:numeric? external;

(:~
 : Converts a value to xs:double.
 : @param $arg The value to convert
 : @return The value as xs:double, or NaN if not convertible
 :)
declare function fn:number($arg as xs:anyAtomicType?) as xs:double external;
(:~ Returns the numeric value of the context item. :)
declare function fn:number() as xs:double external;

(:~
 : Formats a number for display using a picture string.
 : @param $value The number to format
 : @param $picture The picture string
 : @return The formatted string
 :)
declare function fn:format-number($value as xs:numeric?, $picture as xs:string) as xs:string external;
(:~
 : @param $value The number to format
 : @param $picture The picture string
 : @param $decimal-format-name Named decimal format to use
 : @return The formatted string
 :)
declare function fn:format-number($value as xs:numeric?, $picture as xs:string, $decimal-format-name as xs:string) as xs:string external;

(: ── String functions ───────────────────────────────────────────────────────── :)

(:~
 : Constructs a string from a sequence of Unicode codepoints.
 : @param $arg Sequence of codepoint integers
 : @return The resulting string
 :)
declare function fn:codepoints-to-string($arg as xs:integer*) as xs:string external;

(:~
 : Returns the Unicode codepoints of a string.
 : @param $arg The input string
 : @return Sequence of codepoint integers
 :)
declare function fn:string-to-codepoints($arg as xs:string?) as xs:integer* external;

(:~
 : Compares two strings, returning -1, 0, or 1.
 : @param $comparand1 First string
 : @param $comparand2 Second string
 : @return -1, 0, or 1
 :)
declare function fn:compare($comparand1 as xs:string?, $comparand2 as xs:string?) as xs:integer? external;
(:~
 : @param $comparand1 First string
 : @param $comparand2 Second string
 : @param $collation Collation URI
 : @return -1, 0, or 1
 :)
declare function fn:compare($comparand1 as xs:string?, $comparand2 as xs:string?, $collation as xs:string) as xs:integer? external;

(:~
 : Tests equality of two strings using Unicode codepoint comparison.
 : @param $comparand1 First string
 : @param $comparand2 Second string
 : @return true if equal
 :)
declare function fn:codepoint-equal($comparand1 as xs:string?, $comparand2 as xs:string?) as xs:boolean? external;

(:~
 : Concatenates two or more strings. Accepts 2 or more arguments.
 : @param $arg1 First string
 : @param $arg2 Second string
 : @return Concatenated string
 :)
declare function fn:concat($arg1 as xs:anyAtomicType?, $arg2 as xs:anyAtomicType?) as xs:string external;

(:~
 : Joins a sequence of strings into one.
 : @param $arg1 The strings to join
 : @return The joined string
 :)
declare function fn:string-join($arg1 as xs:anyAtomicType*) as xs:string external;
(:~
 : Joins a sequence of strings using a separator.
 : @param $arg1 The strings to join
 : @param $arg2 The separator
 : @return The joined string
 :)
declare function fn:string-join($arg1 as xs:anyAtomicType*, $arg2 as xs:string) as xs:string external;

(:~
 : Returns a substring starting at a position.
 : @param $sourceString The source string
 : @param $start 1-based starting position
 : @return The substring
 :)
declare function fn:substring($sourceString as xs:string?, $start as xs:double) as xs:string external;
(:~
 : Returns a substring of specified length starting at a position.
 : @param $sourceString The source string
 : @param $start 1-based starting position
 : @param $length Number of characters
 : @return The substring
 :)
declare function fn:substring($sourceString as xs:string?, $start as xs:double, $length as xs:double) as xs:string external;

(:~ Returns the length of the context item string value. :)
declare function fn:string-length() as xs:integer external;
(:~
 : Returns the number of characters in a string.
 : @param $arg The input string
 : @return The character count
 :)
declare function fn:string-length($arg as xs:string?) as xs:integer external;

(:~ Strips leading and trailing whitespace from the context item. :)
declare function fn:normalize-space() as xs:string external;
(:~
 : Strips leading and trailing whitespace and collapses internal whitespace.
 : @param $arg The input string
 : @return The normalized string
 :)
declare function fn:normalize-space($arg as xs:string?) as xs:string external;

(:~
 : Applies Unicode normalization to a string.
 : @param $arg The input string
 : @return The normalized string (NFC form)
 :)
declare function fn:normalize-unicode($arg as xs:string?) as xs:string external;
(:~
 : @param $arg The input string
 : @param $normalizationForm Normalization form: NFC, NFD, NFKC, NFKD, FULLY-NORMALIZED
 : @return The normalized string
 :)
declare function fn:normalize-unicode($arg as xs:string?, $normalizationForm as xs:string) as xs:string external;

(:~
 : Converts a string to uppercase.
 : @param $arg The input string
 : @return Uppercased string
 :)
declare function fn:upper-case($arg as xs:string?) as xs:string external;

(:~
 : Converts a string to lowercase.
 : @param $arg The input string
 : @return Lowercased string
 :)
declare function fn:lower-case($arg as xs:string?) as xs:string external;

(:~
 : Translates characters in a string.
 : @param $arg The input string
 : @param $mapString Characters to replace
 : @param $transString Replacement characters
 : @return The translated string
 :)
declare function fn:translate($arg as xs:string?, $mapString as xs:string, $transString as xs:string) as xs:string external;

(:~
 : Encodes a string for use in a URI component.
 : @param $uri-part The string to encode
 : @return The percent-encoded string
 :)
declare function fn:encode-for-uri($uri-part as xs:string?) as xs:string external;

(:~
 : Converts an IRI to a URI by percent-encoding non-ASCII characters.
 : @param $iri The IRI string
 : @return The URI string
 :)
declare function fn:iri-to-uri($iri as xs:string?) as xs:string external;

(:~
 : Encodes a URI for use in HTML. Only encodes characters not allowed in URIs.
 : @param $uri The URI string
 : @return The encoded URI
 :)
declare function fn:escape-html-uri($uri as xs:string?) as xs:string external;

(:~
 : Tests whether a string contains a substring.
 : @param $arg1 The string to search
 : @param $arg2 The substring to find
 : @return true if $arg1 contains $arg2
 :)
declare function fn:contains($arg1 as xs:string?, $arg2 as xs:string?) as xs:boolean external;
(:~ @param $arg1 The string to search @param $arg2 The substring @param $collation Collation URI :)
declare function fn:contains($arg1 as xs:string?, $arg2 as xs:string?, $collation as xs:string) as xs:boolean external;

(:~
 : Tests whether a string starts with a given prefix.
 : @param $arg1 The string to test
 : @param $arg2 The prefix to look for
 : @return true if $arg1 starts with $arg2
 :)
declare function fn:starts-with($arg1 as xs:string?, $arg2 as xs:string?) as xs:boolean external;
(:~ @param $arg1 The string @param $arg2 The prefix @param $collation Collation URI :)
declare function fn:starts-with($arg1 as xs:string?, $arg2 as xs:string?, $collation as xs:string) as xs:boolean external;

(:~
 : Tests whether a string ends with a given suffix.
 : @param $arg1 The string to test
 : @param $arg2 The suffix to look for
 : @return true if $arg1 ends with $arg2
 :)
declare function fn:ends-with($arg1 as xs:string?, $arg2 as xs:string?) as xs:boolean external;
(:~ @param $arg1 The string @param $arg2 The suffix @param $collation Collation URI :)
declare function fn:ends-with($arg1 as xs:string?, $arg2 as xs:string?, $collation as xs:string) as xs:boolean external;

(:~
 : Returns the part of a string that precedes the first occurrence of a pattern.
 : @param $arg1 The input string
 : @param $arg2 The pattern string
 : @return The substring before the pattern
 :)
declare function fn:substring-before($arg1 as xs:string?, $arg2 as xs:string?) as xs:string external;
(:~ @param $arg1 Input @param $arg2 Pattern @param $collation Collation URI :)
declare function fn:substring-before($arg1 as xs:string?, $arg2 as xs:string?, $collation as xs:string) as xs:string external;

(:~
 : Returns the part of a string that follows the first occurrence of a pattern.
 : @param $arg1 The input string
 : @param $arg2 The pattern string
 : @return The substring after the pattern
 :)
declare function fn:substring-after($arg1 as xs:string?, $arg2 as xs:string?) as xs:string external;
(:~ @param $arg1 Input @param $arg2 Pattern @param $collation Collation URI :)
declare function fn:substring-after($arg1 as xs:string?, $arg2 as xs:string?, $collation as xs:string) as xs:string external;

(:~
 : Tests whether a string matches a regular expression.
 : @param $input The string to test
 : @param $pattern The regex pattern
 : @return true if the string matches
 :)
declare function fn:matches($input as xs:string?, $pattern as xs:string) as xs:boolean external;
(:~ @param $input The string @param $pattern The regex @param $flags Flags (i, m, s, x) :)
declare function fn:matches($input as xs:string?, $pattern as xs:string, $flags as xs:string) as xs:boolean external;

(:~
 : Replaces parts of a string matching a regex.
 : @param $input The input string
 : @param $pattern The regex pattern
 : @param $replacement The replacement string (may use $0, $1 … back-references)
 : @return The modified string
 :)
declare function fn:replace($input as xs:string?, $pattern as xs:string, $replacement as xs:string) as xs:string external;
(:~ @param $input Input @param $pattern Regex @param $replacement Replacement @param $flags Flags :)
declare function fn:replace($input as xs:string?, $pattern as xs:string, $replacement as xs:string, $flags as xs:string) as xs:string external;

(:~
 : Splits a string on whitespace, returning a sequence of tokens.
 : @param $input The input string
 : @return Sequence of token strings
 :)
declare function fn:tokenize($input as xs:string?) as xs:string* external;
(:~
 : Splits a string on a regex delimiter.
 : @param $input The input string
 : @param $pattern The delimiter pattern
 : @return Sequence of token strings
 :)
declare function fn:tokenize($input as xs:string?, $pattern as xs:string) as xs:string* external;
(:~ @param $input Input @param $pattern Delimiter @param $flags Flags :)
declare function fn:tokenize($input as xs:string?, $pattern as xs:string, $flags as xs:string) as xs:string* external;

(:~
 : Applies a regex to a string, returning an XML analysis of matches and non-matches.
 : @param $input The input string
 : @param $pattern The regex pattern
 : @return An fn:analyze-string-result element
 :)
declare function fn:analyze-string($input as xs:string?, $pattern as xs:string) as element() external;
(:~ @param $input Input @param $pattern Regex @param $flags Flags :)
declare function fn:analyze-string($input as xs:string?, $pattern as xs:string, $flags as xs:string) as element() external;

(: ── URI functions ──────────────────────────────────────────────────────────── :)

(:~
 : Resolves a relative URI against the static base URI.
 : @param $relative The relative URI reference
 : @return The resolved absolute URI
 :)
declare function fn:resolve-uri($relative as xs:string?) as xs:anyURI? external;
(:~
 : Resolves a relative URI against a given base URI.
 : @param $relative The relative URI reference
 : @param $base The base URI
 : @return The resolved absolute URI
 :)
declare function fn:resolve-uri($relative as xs:string?, $base as xs:string) as xs:anyURI? external;

(: ── Boolean functions ──────────────────────────────────────────────────────── :)

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

(:~
 : Computes the effective boolean value of a sequence.
 : @param $arg The sequence to evaluate
 : @return The effective boolean value
 :)
declare function fn:boolean($arg as item()*) as xs:boolean external;

(:~
 : Returns the logical negation of the effective boolean value.
 : @param $arg The sequence to negate
 : @return The negated boolean value
 :)
declare function fn:not($arg as item()*) as xs:boolean external;

(: ── Sequence functions ──────────────────────────────────────────────────────── :)

(:~
 : Returns true if the argument is the empty sequence.
 : @param $arg The sequence to test
 : @return true if $arg is empty
 :)
declare function fn:empty($arg as item()*) as xs:boolean external;

(:~
 : Returns true if the argument is a non-empty sequence.
 : @param $arg The sequence to test
 : @return true if $arg is non-empty
 :)
declare function fn:exists($arg as item()*) as xs:boolean external;

(:~
 : Returns the first item in a sequence.
 : @param $arg The sequence
 : @return The first item, or empty sequence if $arg is empty
 :)
declare function fn:head($arg as item()*) as item()? external;

(:~
 : Returns all but the first item in a sequence.
 : @param $arg The sequence
 : @return The sequence without its first item
 :)
declare function fn:tail($arg as item()*) as item()* external;

(:~
 : Inserts items into a sequence at a given position.
 : @param $target The target sequence
 : @param $position 1-based insertion point
 : @param $inserts Items to insert
 : @return The modified sequence
 :)
declare function fn:insert-before($target as item()*, $position as xs:integer, $inserts as item()*) as item()* external;

(:~
 : Removes the item at a given position from a sequence.
 : @param $target The sequence
 : @param $position 1-based position to remove
 : @return The sequence without the specified item
 :)
declare function fn:remove($target as item()*, $position as xs:integer) as item()* external;

(:~
 : Reverses the order of items in a sequence.
 : @param $arg The sequence
 : @return The sequence in reverse order
 :)
declare function fn:reverse($arg as item()*) as item()* external;

(:~
 : Returns a contiguous subsequence.
 : @param $sourceSeq The source sequence
 : @param $startingLoc 1-based start position
 : @return Items from $startingLoc to the end
 :)
declare function fn:subsequence($sourceSeq as item()*, $startingLoc as xs:double) as item()* external;
(:~
 : @param $sourceSeq The source sequence
 : @param $startingLoc 1-based start position
 : @param $length Number of items to return
 : @return The subsequence
 :)
declare function fn:subsequence($sourceSeq as item()*, $startingLoc as xs:double, $length as xs:double) as item()* external;

(:~
 : Returns the items in an implementation-defined order.
 : @param $sourceSeq The sequence
 : @return The sequence in any order
 :)
declare function fn:unordered($sourceSeq as item()*) as item()* external;

(:~
 : Returns the argument if it contains zero or one items; raises an error if it contains more.
 : @param $arg The sequence
 : @return The single item, or empty sequence
 :)
declare function fn:zero-or-one($arg as item()*) as item()? external;

(:~
 : Returns the argument if it contains one or more items; raises an error if it is empty.
 : @param $arg The sequence
 : @return The non-empty sequence
 :)
declare function fn:one-or-more($arg as item()*) as item()+ external;

(:~
 : Returns the argument if it contains exactly one item; raises an error otherwise.
 : @param $arg The sequence
 : @return The single item
 :)
declare function fn:exactly-one($arg as item()*) as item() external;

(:~
 : Returns distinct values from a sequence using value comparison.
 : @param $arg The sequence of atomic values
 : @return Sequence with duplicates removed
 :)
declare function fn:distinct-values($arg as xs:anyAtomicType*) as xs:anyAtomicType* external;
(:~ @param $arg The sequence @param $collation Collation URI :)
declare function fn:distinct-values($arg as xs:anyAtomicType*, $collation as xs:string) as xs:anyAtomicType* external;

(:~
 : Returns positions in a sequence where a value occurs.
 : @param $seq The sequence to search
 : @param $search The value to find
 : @return Sequence of 1-based positions
 :)
declare function fn:index-of($seq as xs:anyAtomicType*, $search as xs:anyAtomicType) as xs:integer* external;
(:~ @param $seq Sequence @param $search Value @param $collation Collation URI :)
declare function fn:index-of($seq as xs:anyAtomicType*, $search as xs:anyAtomicType, $collation as xs:string) as xs:integer* external;

(:~
 : Tests whether two sequences are deeply equal.
 : @param $parameter1 First sequence
 : @param $parameter2 Second sequence
 : @return true if the sequences are deeply equal
 :)
declare function fn:deep-equal($parameter1 as item()*, $parameter2 as item()*) as xs:boolean external;
(:~ @param $parameter1 First @param $parameter2 Second @param $collation Collation URI :)
declare function fn:deep-equal($parameter1 as item()*, $parameter2 as item()*, $collation as xs:string) as xs:boolean external;

(:~
 : Returns the number of items in a sequence.
 : @param $arg The sequence
 : @return The count
 :)
declare function fn:count($arg as item()*) as xs:integer external;

(:~
 : Returns the average of a sequence of numeric values.
 : @param $arg The sequence of numbers
 : @return The average
 :)
declare function fn:avg($arg as xs:anyAtomicType*) as xs:anyAtomicType? external;

(:~
 : Returns the maximum value in a sequence.
 : @param $arg The sequence
 : @return The maximum value
 :)
declare function fn:max($arg as xs:anyAtomicType*) as xs:anyAtomicType? external;
(:~ @param $arg Sequence @param $collation Collation URI :)
declare function fn:max($arg as xs:anyAtomicType*, $collation as xs:string) as xs:anyAtomicType? external;

(:~
 : Returns the minimum value in a sequence.
 : @param $arg The sequence
 : @return The minimum value
 :)
declare function fn:min($arg as xs:anyAtomicType*) as xs:anyAtomicType? external;
(:~ @param $arg Sequence @param $collation Collation URI :)
declare function fn:min($arg as xs:anyAtomicType*, $collation as xs:string) as xs:anyAtomicType? external;

(:~
 : Returns the sum of a sequence of numeric values.
 : @param $arg The sequence of numbers
 : @return The sum, or 0 if empty
 :)
declare function fn:sum($arg as xs:anyAtomicType*) as xs:anyAtomicType external;
(:~
 : @param $arg The sequence
 : @param $zero Value to return for an empty sequence
 : @return The sum, or $zero if empty
 :)
declare function fn:sum($arg as xs:anyAtomicType*, $zero as xs:anyAtomicType?) as xs:anyAtomicType? external;

(: ── Higher-order functions ─────────────────────────────────────────────────── :)

(:~
 : Applies a function to every item in a sequence.
 : @param $seq The input sequence
 : @param $action Function to apply to each item
 : @return Concatenated results
 :)
declare function fn:for-each($seq as item()*, $action as function(item()) as item()*) as item()* external;

(:~
 : Returns items from a sequence for which a predicate is true.
 : @param $seq The input sequence
 : @param $f Predicate function
 : @return Items where $f returns true
 :)
declare function fn:filter($seq as item()*, $f as function(item()) as xs:boolean) as item()* external;

(:~
 : Reduces a sequence to a single value by applying a function from the left.
 : @param $seq The input sequence
 : @param $zero The initial accumulator value
 : @param $f Combining function
 : @return The accumulated result
 :)
declare function fn:fold-left($seq as item()*, $zero as item()*, $f as function(item()*, item()) as item()*) as item()* external;

(:~
 : Reduces a sequence to a single value by applying a function from the right.
 : @param $seq The input sequence
 : @param $zero The initial accumulator value
 : @param $f Combining function
 : @return The accumulated result
 :)
declare function fn:fold-right($seq as item()*, $zero as item()*, $f as function(item(), item()*) as item()*) as item()* external;

(:~
 : Applies a function pairwise to two sequences.
 : @param $seq1 First sequence
 : @param $seq2 Second sequence
 : @param $action Function to apply to each pair
 : @return Concatenated results
 :)
declare function fn:for-each-pair($seq1 as item()*, $seq2 as item()*, $action as function(item(), item()) as item()*) as item()* external;

(:~
 : Sorts a sequence using the default collation and natural ordering.
 : @param $seq The sequence to sort
 : @return The sorted sequence
 :)
declare function fn:sort($seq as item()*) as item()* external;
(:~ @param $seq Sequence @param $collation Collation URI or empty :)
declare function fn:sort($seq as item()*, $collation as xs:string?) as item()* external;
(:~
 : @param $seq Sequence
 : @param $collation Collation URI or empty
 : @param $key Function that extracts the sort key from an item
 : @return The sorted sequence
 :)
declare function fn:sort($seq as item()*, $collation as xs:string?, $key as function(item()) as xs:anyAtomicType*) as item()* external;

(:~
 : Calls a function with arguments supplied as an array.
 : @param $function The function to call
 : @param $array Array of arguments
 : @return The result of the function call
 :)
declare function fn:apply($function as function(*), $array as array(*)) as item()* external;

(: ── Function introspection ─────────────────────────────────────────────────── :)

(:~
 : Returns a function from the in-scope functions by name and arity, or empty if not found.
 : @param $name The function name as a QName
 : @param $arity The function arity
 : @return The function, or empty sequence
 :)
declare function fn:function-lookup($name as xs:QName, $arity as xs:integer) as function(*)? external;

(:~
 : Returns the name of a function item.
 : @param $func The function
 : @return The function name as a QName, or empty for anonymous functions
 :)
declare function fn:function-name($func as function(*)) as xs:QName? external;

(:~
 : Returns the arity of a function item.
 : @param $func The function
 : @return The number of arguments the function accepts
 :)
declare function fn:function-arity($func as function(*)) as xs:integer external;

(: ── QName functions ────────────────────────────────────────────────────────── :)

(:~
 : Constructs a QName from a namespace URI and a lexical QName.
 : @param $paramURI The namespace URI (empty string for no namespace)
 : @param $paramQName The lexical qualified name, e.g. "prefix:local"
 : @return The QName value
 :)
declare function fn:QName($paramURI as xs:string?, $paramQName as xs:string) as xs:QName external;

(:~
 : Resolves a lexical QName in the context of an element's in-scope namespaces.
 : @param $qname The lexical QName string
 : @param $element The element providing in-scope namespaces
 : @return The resolved QName
 :)
declare function fn:resolve-QName($qname as xs:string?, $element as element()) as xs:QName? external;

(:~
 : Returns the namespace URI of a QName.
 : @param $arg The QName
 : @return The namespace URI
 :)
declare function fn:namespace-uri-from-QName($arg as xs:QName?) as xs:anyURI? external;

(:~
 : Returns the namespace URI for a given prefix within an element's in-scope namespaces.
 : @param $prefix The namespace prefix (empty string for the default namespace)
 : @param $element The element providing in-scope namespaces
 : @return The namespace URI
 :)
declare function fn:namespace-uri-for-prefix($prefix as xs:string?, $element as element()) as xs:anyURI? external;

(:~
 : Returns the in-scope namespace prefixes of an element.
 : @param $element The element
 : @return Sequence of prefix strings
 :)
declare function fn:in-scope-prefixes($element as element()) as xs:string* external;

(:~
 : Returns the prefix part of a QName.
 : @param $arg The QName
 : @return The prefix, or empty sequence if no prefix
 :)
declare function fn:prefix-from-QName($arg as xs:QName?) as xs:NCName? external;

(:~
 : Returns the local part of a QName.
 : @param $arg The QName
 : @return The local name
 :)
declare function fn:local-name-from-QName($arg as xs:QName?) as xs:NCName? external;

(: ── Node functions ─────────────────────────────────────────────────────────── :)

(:~ Returns the name of the context node as a string. :)
declare function fn:name() as xs:string external;
(:~
 : Returns the name of a node as a string.
 : @param $arg The node
 : @return The node name string
 :)
declare function fn:name($arg as node()?) as xs:string external;

(:~ Returns the local name of the context node. :)
declare function fn:local-name() as xs:string external;
(:~
 : Returns the local name of a node.
 : @param $arg The node
 : @return The local name string
 :)
declare function fn:local-name($arg as node()?) as xs:string external;

(:~ Returns the namespace URI of the context node. :)
declare function fn:namespace-uri() as xs:anyURI external;
(:~
 : Returns the namespace URI of a node.
 : @param $arg The node
 : @return The namespace URI
 :)
declare function fn:namespace-uri($arg as node()?) as xs:anyURI external;

(:~
 : Tests whether the context node has a given language.
 : @param $testlang The language to test for
 : @return true if the node's language matches
 :)
declare function fn:lang($testlang as xs:string?) as xs:boolean external;
(:~ @param $testlang Language @param $node The node to test :)
declare function fn:lang($testlang as xs:string?, $node as node()) as xs:boolean external;

(:~ Returns the root of the tree containing the context node. :)
declare function fn:root() as node() external;
(:~
 : Returns the root of the tree containing a node.
 : @param $arg The node
 : @return The root node
 :)
declare function fn:root($arg as node()?) as node()? external;

(:~ Returns the path to the context node. :)
declare function fn:path() as xs:string? external;
(:~
 : Returns an XPath expression that uniquely identifies a node within its document.
 : @param $arg The node
 : @return The path string
 :)
declare function fn:path($arg as node()?) as xs:string? external;

(:~ Tests whether the context node has child nodes. :)
declare function fn:has-children() as xs:boolean external;
(:~
 : Tests whether a node has child nodes.
 : @param $node The node to test
 : @return true if the node has children
 :)
declare function fn:has-children($node as node()?) as xs:boolean external;

(:~
 : Returns nodes from a sequence that have no ancestor in the sequence.
 : @param $nodes The sequence of nodes
 : @return The innermost nodes
 :)
declare function fn:innermost($nodes as node()*) as node()* external;

(:~
 : Returns nodes from a sequence that have no descendant in the sequence.
 : @param $nodes The sequence of nodes
 : @return The outermost nodes
 :)
declare function fn:outermost($nodes as node()*) as node()* external;

(:~ Generates a unique ID string for the context node. :)
declare function fn:generate-id() as xs:string external;
(:~
 : Generates a unique ID string for a node.
 : @param $arg The node
 : @return A unique xs:ID string
 :)
declare function fn:generate-id($arg as node()?) as xs:string external;

(: ── Context functions ──────────────────────────────────────────────────────── :)

(:~
 : Returns the position of the context item in the sequence being processed.
 : @return The 1-based context position
 :)
declare function fn:position() as xs:integer external;

(:~
 : Returns the number of items in the sequence being processed.
 : @return The context size
 :)
declare function fn:last() as xs:integer external;

(:~
 : Returns the current date and time with timezone.
 : @return The current dateTime
 :)
declare function fn:current-dateTime() as xs:dateTime external;

(:~
 : Returns the current date with timezone.
 : @return The current date
 :)
declare function fn:current-date() as xs:date external;

(:~
 : Returns the current time with timezone.
 : @return The current time
 :)
declare function fn:current-time() as xs:time external;

(:~
 : Returns the implicit timezone.
 : @return The implicit timezone as a dayTimeDuration
 :)
declare function fn:implicit-timezone() as xs:dayTimeDuration external;

(:~
 : Returns the default collation.
 : @return The default collation URI
 :)
declare function fn:default-collation() as xs:string external;

(:~
 : Returns the default language.
 : @return The default language
 :)
declare function fn:default-language() as xs:language external;

(:~
 : Returns the static base URI.
 : @return The static base URI, or empty sequence if none
 :)
declare function fn:static-base-uri() as xs:anyURI? external;

(: ── Date/time component extraction ────────────────────────────────────────── :)

(:~
 : Creates a dateTime value from a date and a time.
 : @param $arg1 The date part
 : @param $arg2 The time part
 : @return The combined dateTime
 :)
declare function fn:dateTime($arg1 as xs:date?, $arg2 as xs:time?) as xs:dateTime? external;

(:~ @param $arg A duration @return The years component :)
declare function fn:years-from-duration($arg as xs:duration?) as xs:integer? external;
(:~ @param $arg A duration @return The months component :)
declare function fn:months-from-duration($arg as xs:duration?) as xs:integer? external;
(:~ @param $arg A duration @return The days component :)
declare function fn:days-from-duration($arg as xs:duration?) as xs:integer? external;
(:~ @param $arg A duration @return The hours component :)
declare function fn:hours-from-duration($arg as xs:duration?) as xs:integer? external;
(:~ @param $arg A duration @return The minutes component :)
declare function fn:minutes-from-duration($arg as xs:duration?) as xs:integer? external;
(:~ @param $arg A duration @return The seconds component :)
declare function fn:seconds-from-duration($arg as xs:duration?) as xs:decimal? external;

(:~ @param $arg A dateTime @return The year component :)
declare function fn:year-from-dateTime($arg as xs:dateTime?) as xs:integer? external;
(:~ @param $arg A dateTime @return The month component (1–12) :)
declare function fn:month-from-dateTime($arg as xs:dateTime?) as xs:integer? external;
(:~ @param $arg A dateTime @return The day-of-month component (1–31) :)
declare function fn:day-from-dateTime($arg as xs:dateTime?) as xs:integer? external;
(:~ @param $arg A dateTime @return The hours component (0–23) :)
declare function fn:hours-from-dateTime($arg as xs:dateTime?) as xs:integer? external;
(:~ @param $arg A dateTime @return The minutes component (0–59) :)
declare function fn:minutes-from-dateTime($arg as xs:dateTime?) as xs:integer? external;
(:~ @param $arg A dateTime @return The seconds component :)
declare function fn:seconds-from-dateTime($arg as xs:dateTime?) as xs:decimal? external;
(:~ @param $arg A dateTime @return The timezone as a dayTimeDuration :)
declare function fn:timezone-from-dateTime($arg as xs:dateTime?) as xs:dayTimeDuration? external;

(:~ @param $arg A date @return The year component :)
declare function fn:year-from-date($arg as xs:date?) as xs:integer? external;
(:~ @param $arg A date @return The month component (1–12) :)
declare function fn:month-from-date($arg as xs:date?) as xs:integer? external;
(:~ @param $arg A date @return The day-of-month component (1–31) :)
declare function fn:day-from-date($arg as xs:date?) as xs:integer? external;
(:~ @param $arg A date @return The timezone as a dayTimeDuration :)
declare function fn:timezone-from-date($arg as xs:date?) as xs:dayTimeDuration? external;

(:~ @param $arg A time @return The hours component (0–23) :)
declare function fn:hours-from-time($arg as xs:time?) as xs:integer? external;
(:~ @param $arg A time @return The minutes component (0–59) :)
declare function fn:minutes-from-time($arg as xs:time?) as xs:integer? external;
(:~ @param $arg A time @return The seconds component :)
declare function fn:seconds-from-time($arg as xs:time?) as xs:decimal? external;
(:~ @param $arg A time @return The timezone as a dayTimeDuration :)
declare function fn:timezone-from-time($arg as xs:time?) as xs:dayTimeDuration? external;

(:~
 : Adjusts a dateTime to the implicit timezone.
 : @param $arg The dateTime to adjust
 : @return The adjusted dateTime
 :)
declare function fn:adjust-dateTime-to-timezone($arg as xs:dateTime?) as xs:dateTime? external;
(:~
 : Adjusts a dateTime to a given timezone.
 : @param $arg The dateTime to adjust
 : @param $timezone The target timezone, or empty sequence to remove timezone
 : @return The adjusted dateTime
 :)
declare function fn:adjust-dateTime-to-timezone($arg as xs:dateTime?, $timezone as xs:dayTimeDuration?) as xs:dateTime? external;

(:~ @param $arg Date to adjust @return Adjusted to implicit timezone :)
declare function fn:adjust-date-to-timezone($arg as xs:date?) as xs:date? external;
(:~ @param $arg Date @param $timezone Target timezone :)
declare function fn:adjust-date-to-timezone($arg as xs:date?, $timezone as xs:dayTimeDuration?) as xs:date? external;

(:~ @param $arg Time to adjust @return Adjusted to implicit timezone :)
declare function fn:adjust-time-to-timezone($arg as xs:time?) as xs:time? external;
(:~ @param $arg Time @param $timezone Target timezone :)
declare function fn:adjust-time-to-timezone($arg as xs:time?, $timezone as xs:dayTimeDuration?) as xs:time? external;

(:~
 : Formats a dateTime value as a string using a picture string.
 : @param $value The dateTime to format
 : @param $picture The picture string
 : @return The formatted string
 :)
declare function fn:format-dateTime($value as xs:dateTime?, $picture as xs:string) as xs:string? external;
(:~ @param $value dateTime @param $picture Picture @param $language Language @param $calendar Calendar @param $place Place :)
declare function fn:format-dateTime($value as xs:dateTime?, $picture as xs:string, $language as xs:string?, $calendar as xs:string?, $place as xs:string?) as xs:string? external;

(:~ @param $value Date @param $picture Picture @return Formatted date string :)
declare function fn:format-date($value as xs:date?, $picture as xs:string) as xs:string? external;
(:~ @param $value Date @param $picture Picture @param $language Language @param $calendar Calendar @param $place Place :)
declare function fn:format-date($value as xs:date?, $picture as xs:string, $language as xs:string?, $calendar as xs:string?, $place as xs:string?) as xs:string? external;

(:~ @param $value Time @param $picture Picture @return Formatted time string :)
declare function fn:format-time($value as xs:time?, $picture as xs:string) as xs:string? external;
(:~ @param $value Time @param $picture Picture @param $language Language @param $calendar Calendar @param $place Place :)
declare function fn:format-time($value as xs:time?, $picture as xs:string, $language as xs:string?, $calendar as xs:string?, $place as xs:string?) as xs:string? external;

(: ── Document and collection functions ──────────────────────────────────────── :)

(:~
 : Returns the document at a given URI.
 : @param $uri The document URI
 : @return The document node
 :)
declare function fn:doc($uri as xs:string?) as document-node()? external;

(:~
 : Tests whether a document is available at a given URI.
 : @param $uri The document URI
 : @return true if the document is available
 :)
declare function fn:doc-available($uri as xs:string?) as xs:boolean external;

(:~ Returns all documents in the default collection. :)
declare function fn:collection() as item()* external;
(:~
 : Returns a collection of documents or nodes.
 : @param $arg The collection URI
 : @return The items in the collection
 :)
declare function fn:collection($arg as xs:string?) as item()* external;

(:~ Returns the URIs in the default URI collection. :)
declare function fn:uri-collection() as xs:anyURI* external;
(:~
 : Returns the URIs in a named URI collection.
 : @param $arg The collection URI
 : @return Sequence of URIs
 :)
declare function fn:uri-collection($arg as xs:string?) as xs:anyURI* external;

(:~
 : Returns the content of a text file.
 : @param $href The URI of the text file
 : @return The file content as a string
 :)
declare function fn:unparsed-text($href as xs:string?) as xs:string? external;
(:~ @param $href URI @param $encoding Character encoding :)
declare function fn:unparsed-text($href as xs:string?, $encoding as xs:string) as xs:string? external;

(:~
 : Returns the lines of a text file as a sequence of strings.
 : @param $href The URI of the text file
 : @return Sequence of line strings
 :)
declare function fn:unparsed-text-lines($href as xs:string?) as xs:string* external;
(:~ @param $href URI @param $encoding Character encoding :)
declare function fn:unparsed-text-lines($href as xs:string?, $encoding as xs:string) as xs:string* external;

(:~
 : Tests whether a text file is available.
 : @param $href The URI to test
 : @return true if the resource is available
 :)
declare function fn:unparsed-text-available($href as xs:string?) as xs:boolean external;
(:~ @param $href URI @param $encoding Character encoding :)
declare function fn:unparsed-text-available($href as xs:string?, $encoding as xs:string) as xs:boolean external;

(:~
 : Returns the value of a named environment variable.
 : @param $name The variable name
 : @return The variable value, or empty sequence if not set
 :)
declare function fn:environment-variable($name as xs:string) as xs:string? external;

(:~
 : Returns the names of all available environment variables.
 : @return Sequence of variable name strings
 :)
declare function fn:available-environment-variables() as xs:string* external;

(: ── XML identity functions ─────────────────────────────────────────────────── :)

(:~
 : Returns elements with the given IDs in the document containing the context node.
 : @param $arg Sequence of ID strings
 : @return The matching elements
 :)
declare function fn:id($arg as xs:string*) as element()* external;
(:~ @param $arg ID strings @param $node Node in the target document :)
declare function fn:id($arg as xs:string*, $node as node()) as element()* external;

(:~
 : Returns nodes with an IDREF attribute matching the given IDs.
 : @param $arg Sequence of ID strings
 : @return The matching nodes
 :)
declare function fn:idref($arg as xs:string*) as node()* external;
(:~ @param $arg ID strings @param $node Node in the target document :)
declare function fn:idref($arg as xs:string*, $node as node()) as node()* external;

(:~
 : Returns elements whose ID attribute matches one of the given strings.
 : @param $arg Sequence of ID strings
 : @return The matching elements
 :)
declare function fn:element-with-id($arg as xs:string*) as element()* external;
(:~ @param $arg ID strings @param $node Node in the target document :)
declare function fn:element-with-id($arg as xs:string*, $node as node()) as element()* external;
