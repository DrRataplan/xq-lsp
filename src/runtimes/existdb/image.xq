module namespace image = "http://exist-db.org/xquery/image";

(:~
 : Crop the image $image to a specified dimension. If no dimensions are
 : specified, then the default values are 'y1 = 0', 'x1 = 0', 'x2 = 100' and
 : 'y2 = 100'.
 : @param $image The image data
 : @param $mimeType The mime-type of the image
 : @return the cropd image or an empty sequence if $image is invalid
 :)
declare function image:crop(
	$image as xs:base64Binary,
	$dimension as xs:integer*,
	$mimeType as xs:string
) as xs:base64Binary? external;

(:~
 : Gets the Height of the image passed in, returning an integer of the images
 : Height in pixels or an empty sequence if the image is invalid.
 : @param $image The image data
 : @return the height in pixels
 :)
declare function image:get-height($image as xs:base64Binary) as xs:integer? external;

(:~
 : Gets the width of the image passed in, returning an integer of the images
 : width in pixels or an empty sequence if the image is invalid.
 : @param $image The image data
 : @return the width in pixels
 :)
declare function image:get-width($image as xs:base64Binary) as xs:integer? external;

(:~
 : @param $image The image data
 : @param $options A map of options for transforming the image. The map should be formatted like: map { 'source': map { 'media-type': xs:string }, 'destination': map { 'max-height': xs:integer?, 'max-width': xs:integer?, 'rendering-hints': map { $image:alpha-interpolation: ($image:alpha-interpolation_default|$image:alpha-interpolation_speed|$image:alpha-interpolation_default)?, $image:antialiasing: ($image:antialiasing_default|$image:antialiasing_on|$image:antialiasing_off)?, $image:color-rendering: ($image:color-rendering_default|$image:color-rendering_speed|$image:color-rendering_quality)?, $image:dithering: ($image:dithering_default|$image:dithering_enable|$image:dithering_disable)?, $image:fractional-metrics: ($image:fractional-metrics_default|$image:fractional-metrics_on|$image:fractional-metrics_off)?, $image:interpolation: ($image:interpolation_nearest_neighbor|$image:interpolation_bilinear|$image:interpolation_bicubic)?, $image:rendering: ($image:rendering_default|$image:rendering_speed|$image:rendering_quality)?, $image:resolution-variant: ($image:resolution-variant_default|$image:resolution-variant_base|$image:resolution-variant_size_fit|$image:resolution-variant_dpi_fit)?, $image:stroke-control: ($image:stroke-control_default|$image:stroke-control_normalize|$image:stroke-control_pure)?, $image:text-antialiasing: ($image:text-antialiasing_default|$image:text-antialiasing_on|$image:text-antialiasing_off|$image:text-antialiasing_gasp|$image:text-antialiasing_lcd_hrgb|$image:text-antialiasing_lcd_hbgr|$image:text-antialiasing_lcd_vrgb|$image:text-antialiasing_lcd_vbgr)? }?}
 : @return the scaled image or an empty sequence if $image is invalid
 :)
declare function image:scale($image as xs:base64Binary, $options as map(*)) as xs:base64Binary? external;

(:~
 : @param $image The image data
 : @param $dimension The maximum dimension of the scaled image. expressed in pixels (maxheight, maxwidth). If empty, then the default values are 'maxheight = 100' and 'maxwidth = 100'.
 : @param $media-type The mime-type of the image
 : @return the scaled image or an empty sequence if $image is invalid
 :)
declare function image:scale(
	$image as xs:base64Binary,
	$dimension as xs:integer*,
	$media-type as xs:string
) as xs:base64Binary? external;

(:~
 : Generate thumbnails from the given database collection
 : @param $collection The URI to the collection
 : @param $thumbnail-location The location in the database where the thumbnails should be created, this can be a local path, with the prefix 'xmldb:' a absolute path within the database or with 'rel:' path relative to the given $collection. You can leave this empty then the default is 'rel:/thumbs'.
 : @param $dimension The dimension of the thumbnails, if empty then the default values are 'maxheight = 100' and 'maxwidth = 100', the first value is 'maxheight' and the second 'maxwidth'.
 : @param $prefix The prefix to append to the thumbnail filenames
 : @return the result
 :)
declare function image:thumbnail(
	$collection as xs:anyURI,
	$thumbnail-location as xs:anyURI?,
	$dimension as xs:integer*,
	$prefix as xs:string?
) as xs:string* external;
