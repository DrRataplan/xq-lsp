module namespace file = "http://exist-db.org/xquery/file";

(:~
 : Delete a file or directory. This method is only available to the DBA role.
 : @param $path The full path or URI to the file
 : @return true if successful, false otherwise
 :)
declare function file:delete($path as item()) as xs:boolean external;

(:~
 : @param $path The base directory path or URI in the file system where the files are located.
 : @param $pattern The file name pattern
 : @return a node fragment that shows all matching filenames, including their file size and modification time, and the subdirectory they were found in
 :)
declare function file:directory-list($path as item(), $pattern as xs:string*) as node()? external;

(:~
 : Tests if a file or directory exists. This method is only available to the
 : DBA role.
 : @param $path The full path or URI to the file in the file system
 : @return the boolean value true if the file exists, false otherwise
 :)
declare function file:exists($path as item()) as xs:boolean external;

(:~
 : Tests if a path is a directory. This method is only available to the DBA
 : role.
 : @param $path The full path or URI to the file or directory
 : @return true if the path is a directory
 :)
declare function file:is-directory($path as item()) as xs:boolean external;

(:~
 : Tests if a file is readable. This method is only available to the DBA role.
 : @param $path The full path or URI to the file
 : @return true if file can be read
 :)
declare function file:is-readable($path as item()) as xs:boolean external;

(:~
 : Tests if a file is writeable. This method is only available to the DBA role.
 : @param $path The full path or URI to the file
 : @return true if the file has write permissions
 :)
declare function file:is-writeable($path as item()) as xs:boolean external;

(:~
 : List all files and directories under the specified directory. This method is
 : only available to the DBA role.
 : @param $path The directory path or URI in the file system.
 : @return a node describing file and directory names and meta data.
 :)
declare function file:list($path as item()) as node()* external;

(:~
 : Create a directory. This method is only available to the DBA role.
 : @param $path The full path or URI to the directory
 : @return true if successful, false otherwise
 :)
declare function file:mkdir($path as item()) as xs:boolean external;

(:~
 : Create a directory including any necessary but nonexistent parent
 : directories. This method is only available to the DBA role.
 : @param $path The full path or URI to the directory
 : @return true if successful, false otherwise
 :)
declare function file:mkdirs($path as item()) as xs:boolean external;

(:~
 : Move (rename) a file or directory. Exact operation is platform dependent.
 : This method is only available to the DBA role.
 : @param $original The full path or URI to the file
 : @param $destination The full path or URI to the file
 : @return true if successful, false otherwise
 :)
declare function file:move($original as item(), $destination as item()) as xs:boolean external;

(:~
 : Reads the content of file. This method is only available to the DBA role.
 : @param $path The directory path or URI in the file system.
 : @return the file contents
 :)
declare function file:read($path as item()) as xs:string? external;

(:~
 : Reads the content of file. This method is only available to the DBA role.
 : @param $path The directory path or URI in the file system.
 : @param $encoding The encoding type for the file
 : @return the file contents
 :)
declare function file:read($path as item(), $encoding as xs:string) as xs:string? external;

(:~
 : Reads the contents of a binary file. This method is only available to the
 : DBA role.
 : @param $path The directory path or URI in the file system.
 : @return the file contents
 :)
declare function file:read-binary($path as item()) as xs:base64Binary? external;

(:~
 : Reads the contents of a file. Unicode BOM (Byte Order Marker) will be
 : stripped off if found. This method is only available to the DBA role.
 : @param $path The directory path or URI in the file system.
 : @return the contents of the file
 :)
declare function file:read-unicode($path as item()) as xs:string? external;

(:~
 : Reads the contents of a file. Unicode BOM (Byte Order Marker) will be
 : stripped off if found. This method is only available to the DBA role.
 : @param $path The directory path or URI in the file system.
 : @param $encoding The file is read with the encoding specified.
 : @return the contents of the file
 :)
declare function file:read-unicode($path as item(), $encoding as xs:string) as xs:string? external;

(:~
 : Writes the node set into a file on the file system. $parameters contains a
 : sequence of zero or more serialization parameters specified as key=value
 : pairs. The serialization options are the same as those recognized by
 : "declare option exist:serialize". The function does NOT automatically
 : inherit the serialization options of the XQuery it is called from. This
 : method is only available to the DBA role.
 : @param $node-set The contents to write to the file system.
 : @param $path The full path or URI to the file
 : @param $parameters The serialization parameters: either a sequence of key=value pairs or an output:serialization-parameters element as defined by the standard fn:serialize function.
 : @return true on success - false if the specified file can not be created or is not writable. The empty sequence is returned if the argument sequence is empty.
 :)
declare function file:serialize($node-set as node()*, $path as item(), $parameters as item()*) as xs:boolean? external;

(:~
 : Writes the node set into a file on the file system, optionally appending to
 : it. $parameters contains a sequence of zero or more serialization parameters
 : specified as key=value pairs. The serialization options are the same as
 : those recognized by "declare option exist:serialize". The function does NOT
 : automatically inherit the serialization options of the XQuery it is called
 : from. This method is only available to the DBA role.
 : @param $node-set The contents to write to the file system.
 : @param $path The full path or URI to the file
 : @param $parameters The serialization parameters: either a sequence of key=value pairs or an output:serialization-parameters element as defined by the standard fn:serialize function.
 : @param $append Should content be appended?
 : @return true on success - false if the specified file can not be created or is not writable. The empty sequence is returned if the argument sequence is empty.
 :)
declare function file:serialize(
	$node-set as node()*,
	$path as item(),
	$parameters as item()*,
	$append as xs:boolean
) as xs:boolean? external;

(:~
 : Writes binary data into a file on the file system. This method is only
 : available to the DBA role.
 : @param $binarydata The contents to write to the file system.
 : @param $path The full path or URI to the file
 : @return true on success - false if the specified file can not be created or is not writable
 :)
declare function file:serialize-binary($binarydata as xs:base64Binary, $path as item()) as xs:boolean external;

(:~
 : Writes binary data into a file on the file system, optionally appending the
 : content. This method is only available to the DBA role.
 : @param $binarydata The contents to write to the file system.
 : @param $path The full path or URI to the file
 : @param $append Should content be appended?
 : @return true on success - false if the specified file can not be created or is not writable
 :)
declare function file:serialize-binary($binarydata as xs:base64Binary, $path as item(), $append as xs:boolean) as xs:boolean external;

(:~
 : Synchronize a collection with a directory hierarchy. This method is only
 : available to the DBA role.
 : @param $collection Absolute path to the collection to synchronize to disk.
 : @param $targetPath The path or URI to the target directory. Relative paths resolve against EXIST_HOME.
 :)
declare function file:sync(
	$collection as xs:string,
	$targetPath as item(),
	$dateTimeOrOptionsMap as item()?
) as document-node() external;
