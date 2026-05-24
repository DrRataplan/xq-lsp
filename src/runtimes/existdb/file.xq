module namespace file = "http://exist-db.org/xquery/file";

(: ── Listing & Testing ────────────────────────────────────────────────────── :)

(:~
 : Lists entries in the given directory, returning their names as strings.
 : @param $path The filesystem path to list
 :)
declare function file:list($path as xs:string) as xs:string* external;

(:~
 : Lists entries in the given directory, optionally recursing into subdirectories.
 : @param $path The filesystem path to list
 : @param $recursive If true, recurse into subdirectories
 :)
declare function file:list($path as xs:string, $recursive as xs:boolean) as xs:string* external;

(:~
 : Lists entries in the given directory whose names match the given pattern.
 : @param $path The filesystem path to list
 : @param $recursive If true, recurse into subdirectories
 : @param $pattern A glob or regex pattern to filter filenames
 :)
declare function file:list($path as xs:string, $recursive as xs:boolean, $pattern as xs:string) as xs:string* external;

(:~
 : Returns true if the given path exists on the filesystem.
 : @param $path The filesystem path to test
 :)
declare function file:exists($path as xs:string) as xs:boolean external;

(:~
 : Returns true if the given path is a directory.
 : @param $path The filesystem path to test
 :)
declare function file:is-directory($path as xs:string) as xs:boolean external;

(:~
 : Returns true if the given path is readable.
 : @param $path The filesystem path to test
 :)
declare function file:is-readable($path as xs:string) as xs:boolean external;

(:~
 : Returns true if the given path is writable.
 : @param $path The filesystem path to test
 :)
declare function file:is-writeable($path as xs:string) as xs:boolean external;

(:~
 : Returns the size in bytes of the file at the given path.
 : @param $path The filesystem path
 :)
declare function file:size($path as xs:string) as xs:integer? external;

(:~
 : Returns the last-modified date-time of the file at the given path.
 : @param $path The filesystem path
 :)
declare function file:last-modified($path as xs:string) as xs:dateTime? external;

(: ── Reading ─────────────────────────────────────────────────────────────── :)

(:~
 : Reads the contents of a text file and returns it as a string (UTF-8).
 : @param $path The filesystem path of the file to read
 :)
declare function file:read($path as xs:string) as xs:string? external;

(:~
 : Reads the contents of a text file with the specified encoding.
 : @param $path The filesystem path of the file to read
 : @param $encoding The character encoding (e.g. "UTF-8", "ISO-8859-1")
 :)
declare function file:read($path as xs:string, $encoding as xs:string) as xs:string? external;

(:~
 : Reads the contents of a file as binary (xs:base64Binary).
 : @param $path The filesystem path of the file to read
 :)
declare function file:read-binary($path as xs:string) as xs:base64Binary? external;

(:~
 : Reads the contents of a Unicode text file using its BOM to detect encoding.
 : @param $path The filesystem path of the file to read
 :)
declare function file:read-unicode($path as xs:string) as xs:string? external;

(: ── Writing / Serialization ──────────────────────────────────────────────── :)

(:~
 : Serializes the given nodes to a file using the given serialization parameters.
 : @param $content The content to serialize
 : @param $path The filesystem path of the target file
 : @param $serialization-params Serialization options as a string or map
 :)
declare function file:serialize($content as item()*, $path as xs:string, $serialization-params as item()) as xs:boolean external;

(:~
 : Serializes the given nodes to a file, appending if the file already exists.
 : @param $content The content to serialize
 : @param $path The filesystem path of the target file
 : @param $serialization-params Serialization options
 : @param $append If true, append to existing file
 :)
declare function file:serialize($content as item()*, $path as xs:string, $serialization-params as item(), $append as xs:boolean) as xs:boolean external;

(:~
 : Writes binary content to a file.
 : @param $content The binary content to write
 : @param $path The filesystem path of the target file
 :)
declare function file:serialize-binary($content as xs:base64Binary, $path as xs:string) as xs:boolean external;

(: ── Directory Operations ─────────────────────────────────────────────────── :)

(:~
 : Creates a directory at the given path.
 : @param $path The filesystem path of the directory to create
 :)
declare function file:mkdir($path as xs:string) as xs:boolean external;

(:~
 : Creates a directory and all missing parent directories.
 : @param $path The filesystem path of the directory to create
 :)
declare function file:mkdirs($path as xs:string) as xs:boolean external;

(: ── Copy, Move, Delete ──────────────────────────────────────────────────── :)

(:~
 : Copies a file or directory to the destination path.
 : @param $source The source filesystem path
 : @param $destination The destination filesystem path
 :)
declare function file:copy($source as xs:string, $destination as xs:string) as xs:boolean external;

(:~
 : Moves a file or directory to the destination path.
 : @param $source The source filesystem path
 : @param $destination The destination filesystem path
 :)
declare function file:move($source as xs:string, $destination as xs:string) as xs:boolean external;

(:~
 : Deletes the file or empty directory at the given path.
 : @param $path The filesystem path to delete
 :)
declare function file:delete($path as xs:string) as xs:boolean external;

(:~
 : Deletes the file or directory (recursively) at the given path.
 : @param $path The filesystem path to delete
 : @param $recursive If true, delete directory contents recursively
 :)
declare function file:delete($path as xs:string, $recursive as xs:boolean) as xs:boolean external;

(:~
 : Synchronizes the contents of a database collection to a filesystem directory.
 : @param $collection The source database collection URI
 : @param $target The target filesystem directory path
 : @param $date Only sync files modified after this date (use empty sequence for all)
 :)
declare function file:sync($collection as xs:string, $target as xs:string, $date as xs:dateTime?) as xs:boolean external;

(: ── Temporary Files ──────────────────────────────────────────────────────── :)

(:~
 : Creates a temporary file and returns its path.
 : @param $prefix The prefix string for the temp file name
 : @param $suffix The suffix string for the temp file name (e.g. ".xml")
 :)
declare function file:create-temp-file($prefix as xs:string, $suffix as xs:string) as xs:string? external;

(:~
 : Creates a temporary directory and returns its path.
 : @param $prefix The prefix string for the temp directory name
 :)
declare function file:create-temp-dir($prefix as xs:string) as xs:string? external;

(:~
 : Returns the path to the system temporary directory.
 :)
declare function file:temp-dir() as xs:string external;

(: ── Path Utilities ───────────────────────────────────────────────────────── :)

(:~
 : Returns the OS-specific file separator character.
 :)
declare function file:path-separator() as xs:string external;

(:~
 : Returns the path to the directory containing the currently running XQuery module.
 :)
declare function file:base-dir() as xs:anyURI? external;

(:~
 : Returns the parent directory path of the given path.
 : @param $path The filesystem path
 :)
declare function file:parent($path as xs:string) as xs:string? external;

(:~
 : Returns the filename (last component) of the given path.
 : @param $path The filesystem path
 :)
declare function file:name($path as xs:string) as xs:string? external;
