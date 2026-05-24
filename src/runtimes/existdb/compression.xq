module namespace compression = "http://exist-db.org/xquery/compression";

(:~
 : Creates a ZIP archive containing the given resources.
 : @param $sources The resources to include: a sequence of xs:anyURI values or nodes
 : @param $use-collection-hierarchy If true, preserves the collection path inside the archive
 :)
declare function compression:zip($sources as item()*, $use-collection-hierarchy as xs:boolean) as xs:base64Binary external;

(:~
 : Creates a ZIP archive stripping a path prefix from entries.
 : @param $sources The resources to include
 : @param $use-collection-hierarchy If true, preserves the collection path inside the archive
 : @param $strip-prefix A prefix to strip from resource paths when computing entry names
 :)
declare function compression:zip($sources as item()*, $use-collection-hierarchy as xs:boolean, $strip-prefix as xs:string) as xs:base64Binary external;

(:~
 : Creates a ZIP archive with a custom root collection and prefix.
 : @param $sources The resources to include
 : @param $use-collection-hierarchy If true, preserves the collection path inside the archive
 : @param $strip-prefix A prefix to strip from resource paths
 : @param $root-collection The root collection path to use for entries in the archive
 :)
declare function compression:zip($sources as item()*, $use-collection-hierarchy as xs:boolean, $strip-prefix as xs:string, $root-collection as xs:string) as xs:base64Binary external;

(:~
 : Extracts entries from a ZIP archive, calling the entry-filter and entry-data functions for each entry.
 : @param $data The ZIP archive as xs:base64Binary
 : @param $entry-filter A function called with (path, data-type, param) to decide if an entry should be processed
 : @param $entry-filter-param A parameter passed to entry-filter
 : @param $entry-data A function called with (path, data-type, data, param) for each accepted entry
 : @param $entry-data-param A parameter passed to entry-data
 :)
declare function compression:unzip($data as xs:base64Binary, $entry-filter as function(*), $entry-filter-param as item()*, $entry-data as function(*), $entry-data-param as item()*) as item()* external;

(:~
 : Creates a TAR archive containing the given resources.
 : @param $sources The resources to include
 : @param $use-collection-hierarchy If true, preserves the collection path inside the archive
 :)
declare function compression:tar($sources as item()*, $use-collection-hierarchy as xs:boolean) as xs:base64Binary external;

(:~
 : Creates a TAR archive stripping a path prefix from entries.
 : @param $sources The resources to include
 : @param $use-collection-hierarchy If true, preserves the collection path inside the archive
 : @param $strip-prefix A prefix to strip from resource paths
 :)
declare function compression:tar($sources as item()*, $use-collection-hierarchy as xs:boolean, $strip-prefix as xs:string) as xs:base64Binary external;

(:~
 : Extracts entries from a TAR archive, calling the entry-filter and entry-data functions for each entry.
 : @param $data The TAR archive as xs:base64Binary
 : @param $entry-filter A function called with (path, data-type, param) for each entry
 : @param $entry-filter-param A parameter passed to entry-filter
 : @param $entry-data A function called with (path, data-type, data, param) for each accepted entry
 : @param $entry-data-param A parameter passed to entry-data
 :)
declare function compression:untar($data as xs:base64Binary, $entry-filter as function(*), $entry-filter-param as item()*, $entry-data as function(*), $entry-data-param as item()*) as item()* external;

(:~
 : Compresses the given binary data using GZIP and returns the compressed data.
 : @param $data The data to compress
 :)
declare function compression:gzip($data as xs:base64Binary) as xs:base64Binary external;

(:~
 : Decompresses GZIP-compressed binary data.
 : @param $data The GZIP-compressed data
 :)
declare function compression:gunzip($data as xs:base64Binary) as xs:base64Binary external;
