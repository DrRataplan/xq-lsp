module namespace transform = "http://exist-db.org/xquery/transform";

(:~
 : Transforms the given input node using the given XSLT stylesheet.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 :)
declare function transform:transform($input as node()?, $stylesheet as item(), $parameters as node()?) as node()? external;

(:~
 : Transforms the given input node with additional JAXP transformer attributes.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 : @param $attributes A map of transformer attributes, or the empty sequence
 :)
declare function transform:transform($input as node()?, $stylesheet as item(), $parameters as node()?, $attributes as map(*)?) as node()? external;

(:~
 : Transforms the given input node with additional JAXP transformer attributes and serialization options.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 : @param $attributes A map of transformer attributes, or the empty sequence
 : @param $serialization-options Additional serialization options as a string
 :)
declare function transform:transform($input as node()?, $stylesheet as item(), $parameters as node()?, $attributes as map(*)?, $serialization-options as xs:string?) as node()? external;

(:~
 : Transforms the given input and streams the result directly to the HTTP response.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 :)
declare function transform:stream-transform($input as node()?, $stylesheet as item(), $parameters as node()?) as empty-sequence() external;

(:~
 : Transforms the given input and streams the result with transformer attributes.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 : @param $attributes A map of transformer attributes, or the empty sequence
 :)
declare function transform:stream-transform($input as node()?, $stylesheet as item(), $parameters as node()?, $attributes as map(*)?) as empty-sequence() external;

(:~
 : Transforms the given input and streams the result with full options.
 : @param $input The source node to transform
 : @param $stylesheet The XSLT stylesheet (node or URI string)
 : @param $parameters A map of stylesheet parameters, or the empty sequence
 : @param $attributes A map of transformer attributes, or the empty sequence
 : @param $serialization-options Additional serialization options as a string
 :)
declare function transform:stream-transform($input as node()?, $stylesheet as item(), $parameters as node()?, $attributes as map(*)?, $serialization-options as xs:string?) as empty-sequence() external;
