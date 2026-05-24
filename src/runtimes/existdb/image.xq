module namespace image = "http://exist-db.org/xquery/image";

(:~
 : Returns metadata for the given image as a sequence of elements.
 : @param $image The image as xs:base64Binary
 :)
declare function image:get-metadata($image as xs:base64Binary) as element()* external;

(:~
 : Returns the width of the given image in pixels.
 : @param $image The image as xs:base64Binary
 :)
declare function image:get-width($image as xs:base64Binary) as xs:integer? external;

(:~
 : Returns the height of the given image in pixels.
 : @param $image The image as xs:base64Binary
 :)
declare function image:get-height($image as xs:base64Binary) as xs:integer? external;

(:~
 : Scales an image so that the longer dimension equals the given maximum, preserving aspect ratio.
 : @param $image The image as xs:base64Binary
 : @param $dimension The maximum dimension in pixels
 :)
declare function image:scale($image as xs:base64Binary, $dimension as xs:integer) as xs:base64Binary? external;

(:~
 : Resizes an image to the given dimensions. Pass -1 for one dimension to preserve aspect ratio.
 : @param $image The image as xs:base64Binary
 : @param $width The target width in pixels (-1 to compute from height)
 : @param $height The target height in pixels (-1 to compute from width)
 :)
declare function image:resize($image as xs:base64Binary, $width as xs:integer, $height as xs:integer) as xs:base64Binary? external;

(:~
 : Crops an image to the given rectangle.
 : @param $image The image as xs:base64Binary
 : @param $upper-left-x The x coordinate of the upper-left corner of the crop area
 : @param $upper-left-y The y coordinate of the upper-left corner of the crop area
 : @param $width The width of the crop area in pixels
 : @param $height The height of the crop area in pixels
 :)
declare function image:crop($image as xs:base64Binary, $upper-left-x as xs:integer, $upper-left-y as xs:integer, $width as xs:integer, $height as xs:integer) as xs:base64Binary? external;

(:~
 : Converts an image to the given MIME type (e.g. "image/png", "image/jpeg").
 : @param $image The image as xs:base64Binary
 : @param $mime-type The target MIME type
 :)
declare function image:convert($image as xs:base64Binary, $mime-type as xs:string) as xs:base64Binary? external;

(:~
 : Creates thumbnails for all images in a collection, storing them in a thumbnail collection.
 : @param $collection The source collection URI
 : @param $thumbnail-collection The target thumbnail collection URI
 : @param $max-dimension Maximum thumbnail dimension in pixels
 :)
declare function image:thumbnail($collection as xs:string, $thumbnail-collection as xs:string, $max-dimension as xs:integer) as empty-sequence() external;

(:~
 : Creates thumbnails for all images matching the given prefix.
 : @param $collection The source collection URI
 : @param $thumbnail-collection The target thumbnail collection URI
 : @param $max-dimension Maximum thumbnail dimension in pixels
 : @param $prefix A prefix filter for source image names
 :)
declare function image:thumbnail($collection as xs:string, $thumbnail-collection as xs:string, $max-dimension as xs:integer, $prefix as xs:string) as empty-sequence() external;
