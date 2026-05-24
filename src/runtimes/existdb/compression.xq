module namespace compression = "http://exist-db.org/xquery/compression";

(:~
 : Stores an entry to the database. Attempts to guard against exit attacks; If
 : an exit attack is detected then the error `compression:archive-exit-attack
 : is raised`.
 : @param $destination A path to a Collection in the database where the entry should be extracted. If the Collection does not exist it will be created.
 : @return A function suitable for passing as the $entry-data#3
 :)
declare function compression:db-store-entry3($destination as xs:string?) as function(*) external;

(:~
 : Stores an entry to the database. Attempts to guard against exit attacks; If
 : an exit attack is detected then the error `compression:archive-exit-attack
 : is raised`.
 : @param $destination A path to a Collection in the database where the entry should be extracted. If the Collection does not exist it will be created.
 : @return A function suitable for passing as the $entry-data#4
 :)
declare function compression:db-store-entry4($destination as xs:string?) as function(*) external;

(:~
 : Deflate data (RFC 1950)
 : @param $data The data to Deflate
 :)
declare function compression:deflate($data as xs:base64Binary) as xs:base64Binary? external;

(:~
 : Deflate data (RFC 1951)
 : @param $data The data to Deflate
 : @param $raw If true, create raw deflate data that is not wrapped inside zlib header and checksum.
 :)
declare function compression:deflate($data as xs:base64Binary, $raw as xs:boolean) as xs:base64Binary? external;

(:~
 : Stores an entry to the filesystem. This method is only available to the DBA
 : role. Attempts to guard against exit attacks; If an exit attack is detected
 : then the error `compression:archive-exit-attack is raised`.
 : @param $destination A path to a directory on the filesystem where the entry should be extracted. If the path does not exist it will be created.
 : @return A function suitable for passing as the $entry-data#3
 :)
declare function compression:fs-store-entry3($destination as xs:string?) as function(*) external;

(:~
 : Stores an entry to the filesystem. This method is only available to the DBA
 : role. Attempts to guard against exit attacks; If an exit attack is detected
 : then the error `compression:archive-exit-attack is raised`.
 : @param $destination A path to a directory on the filesystem where the entry should be extracted. If the path does not exist it will be created.
 : @return A function suitable for passing as the $entry-data#4
 :)
declare function compression:fs-store-entry4($destination as xs:string?) as function(*) external;

(:~
 : GZip's data
 : @param $data The data to GZip
 :)
declare function compression:gzip($data as xs:base64Binary) as xs:base64Binary? external;

(:~
 : Inflate data (RFC 1950)
 : @param $inflate-data The inflate data to uncompress.
 :)
declare function compression:inflate($inflate-data as xs:base64Binary) as xs:base64Binary? external;

(:~
 : Inflate data (RFC 1951)
 : @param $inflate-data The inflate data to uncompress.
 : @param $raw If true, expect raw deflate data that is not wrapped inside zlib header and checksum.
 :)
declare function compression:inflate($inflate-data as xs:base64Binary, $raw as xs:boolean) as xs:base64Binary? external;

(:~
 : Does not filter any entries.
 : @param $path The path of the entry
 : @param $data-type The type of the entry, either 'directory' or 'resource'.
 : @return Always true, so that no entries are filtered. Parameters are ignored.
 :)
declare function compression:no-filter($path as xs:string, $data-type as xs:string) as xs:boolean external;

(:~
 : Does not filter any entries.
 : @param $path The path of the entry
 : @param $data-type The type of the entry, either 'directory' or 'resource'.
 : @param $param One or more parameters.
 : @return Always true, so that no entries are filtered. Parameters are ignored.
 :)
declare function compression:no-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean external;

declare function compression:tar() as xs:base64Binary* external;

(:~
 : UnGZip's data
 : @param $gzip-data The gzip data to uncompress.
 :)
declare function compression:ungzip($gzip-data as xs:base64Binary) as xs:base64Binary? external;

(:~
 : UnTar all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $tar-data The tar file data
 : @param $entry-filter A user defined function for filtering resources from the tar file. The function takes 2 parameters e.g. user:untar-entry-filter($path as xs:string, $data-type as xs:string) as xs:boolean. $data-type may be 'resource' or 'folder'. If the return type is true() it indicates the entry should be processed and passed to the entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#2 function.
 : @param $entry-data A user defined function for storing an extracted resource from the tar file. The function takes 3 parameters e.g. user:untar-entry-data($path as xs:string, $data-type as xs:string, $data as item()?). Or a user defined function which returns a db path for storing an extracted resource from the tar file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry3($dest) and compression:db-store-entry3($dest).
 :)
declare function compression:untar($tar-data as xs:base64Binary, $entry-filter as function(*), $entry-data as function(*)) as item()* external;

(:~
 : UnTar all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $tar-data The tar file data
 : @param $entry-filter A user defined function for filtering resources from the tar file. The function takes 3 parameters e.g. user:untar-entry-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters, for example a list of extracted files. If the return type is true() it indicates the entry should be processed and passed to the entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#3 function.
 : @param $entry-filter-param A sequence with an additional parameters for filtering function.
 : @param $entry-data A user defined function for storing an extracted resource from the tar file. The function takes 4 parameters e.g. user:untar-entry-data($path as xs:string, $data-type as xs:string, $data as item()?, $param as item()*). Or a user defined function which returns a db path for storing an extracted resource from the tar file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry4($dest) and compression:db-store-entry4($dest).
 : @param $entry-data-param A sequence with an additional parameters for storing function.
 :)
declare function compression:untar(
	$tar-data as xs:base64Binary,
	$entry-filter as function(*),
	$entry-filter-param as xs:anyType*,
	$entry-data as function(*),
	$entry-data-param as xs:anyType*
) as item()* external;

(:~
 : UnTar all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $tar-data The tar file data
 : @param $entry-filter A user defined function for filtering resources from the tar file. The function takes 3 parameters e.g. user:untar-entry-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters, for example a list of extracted files. If the return type is true() it indicates the entry should be processed and passed to the entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#3 function.
 : @param $entry-filter-param A sequence with an additional parameters for filtering function.
 : @param $entry-data A user defined function for storing an extracted resource from the tar file. The function takes 4 parameters e.g. user:untar-entry-data($path as xs:string, $data-type as xs:string, $data as item()?, $param as item()*). Or a user defined function which returns a db path for storing an extracted resource from the tar file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry4($dest) and compression:db-store-entry4($dest).
 : @param $entry-data-param A sequence with an additional parameters for storing function.
 : @param $encoding The encoding to be used during uncompressing eg: UTF8 or Cp437 from https://docs.oracle.com/javase/8/docs/technotes/guides/intl/encoding.doc.html
 :)
declare function compression:untar(
	$tar-data as xs:base64Binary,
	$entry-filter as function(*),
	$entry-filter-param as xs:anyType*,
	$entry-data as function(*),
	$entry-data-param as xs:anyType*,
	$encoding as xs:string
) as item()* external;

(:~
 : UnZip all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $zip-data The zip file data
 : @param $entry-filter A user defined function for filtering resources from the zip file. The function takes 2 parameters e.g. user:unzip-entry-filter($path as xs:string, $data-type as xs:string) as xs:boolean. $data-type may be 'resource' or 'folder'. If the return type is true() it indicates the entry should be processed and passed to the $entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#2 function.
 : @param $entry-data A user defined function for storing an extracted resource from the zip file. The function takes 3 parameters e.g. user:unzip-entry-data($path as xs:string, $data-type as xs:string, $data as item()?). Or a user defined function which returns a db path for storing an extracted resource from the zip file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry3($dest) and compression:db-store-entry3($dest).
 :)
declare function compression:unzip($zip-data as xs:base64Binary, $entry-filter as function(*), $entry-data as function(*)) as item()* external;

(:~
 : UnZip all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $zip-data The zip file data
 : @param $entry-filter A user defined function for filtering resources from the zip file. The function takes 3 parameters e.g. user:unzip-entry-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters, for example a list of extracted files. If the return type is true() it indicates the entry should be processed and passed to the $entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#3 function.
 : @param $entry-filter-param A sequence with an additional parameters for filtering function.
 : @param $entry-data A user defined function for storing an extracted resource from the zip file. The function takes 4 parameters e.g. user:unzip-entry-data($path as xs:string, $data-type as xs:string, $data as item()?, $param as item()*). Or a user defined function which returns a db path for storing an extracted resource from the zip file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters. Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry4($dest) and compression:db-store-entry4($dest).
 : @param $entry-data-param A sequence with an additional parameters for storing function.
 :)
declare function compression:unzip(
	$zip-data as xs:base64Binary,
	$entry-filter as function(*),
	$entry-filter-param as xs:anyType*,
	$entry-data as function(*),
	$entry-data-param as xs:anyType*
) as item()* external;

(:~
 : UnZip all the resources/folders from the provided data by calling user
 : defined functions to determine what and how to store the resources/folders
 : @param $zip-data The zip file data
 : @param $entry-filter A user defined function for filtering resources from the zip file. The function takes 3 parameters e.g. user:unzip-entry-filter($path as xs:string, $data-type as xs:string, $param as item()*) as xs:boolean. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters, for example a list of extracted files. If the return type is true() it indicates the entry should be processed and passed to the $entry-data function, else the resource is skipped. If you wish to extract all resources you can use the provided compression:no-filter#3 function.
 : @param $entry-filter-param A sequence with an additional parameters for filtering function.
 : @param $entry-data A user defined function for storing an extracted resource from the zip file. The function takes 4 parameters e.g. user:unzip-entry-data($path as xs:string, $data-type as xs:string, $data as item()?, $param as item()*). Or a user defined function which returns a db path for storing an extracted resource from the zip file. The function takes 3 parameters e.g. user:entry-path($path as xs:string, $data-type as xs:string, $param as item()*) as xs:anyURI. $data-type may be 'resource' or 'folder'. $param is a sequence with any additional parameters. Functions for storing the entries to a folder on the filesystem or a collection in the database provided by compression:fs-store-entry4($dest) and compression:db-store-entry4($dest).
 : @param $entry-data-param A sequence with an additional parameters for storing function.
 : @param $encoding The encoding to be used during uncompressing eg: UTF8 or Cp437 from https://docs.oracle.com/javase/8/docs/technotes/guides/intl/encoding.doc.html
 :)
declare function compression:unzip(
	$zip-data as xs:base64Binary,
	$entry-filter as function(*),
	$entry-filter-param as xs:anyType*,
	$entry-data as function(*),
	$entry-data-param as xs:anyType*,
	$encoding as xs:string
) as item()* external;

declare function compression:zip() as xs:base64Binary* external;
