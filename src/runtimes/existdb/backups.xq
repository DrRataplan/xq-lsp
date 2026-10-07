module namespace backups = "http://exist-db.org/xquery/backups";

(:~
 : Returns an XML fragment listing all eXist backups found in a specified
 : backup directory.
 : @param $directory The path to the directory to show the list of backups on.
 : @return an XML fragment listing all eXist backups found in the specified backup directory: &lt;directory> &lt;backup file="filename"> &lt;key>value&lt;/key>&lt;key>value&lt;/key>&lt;/backup> &lt;backup file="filename"> &lt;key>value&lt;/key>&lt;key>value&lt;/key>&lt;/backup> &lt;/directory> Where key is a property name and value is a property value for the given .zip file.
 :)
declare function backups:list($directory as xs:string) as node() external;

(:~
 : Retrieves a zipped backup archive, $name, and directly streams it to the
 : HTTP response. For security reasons, the function will only read .zip files
 : in the specified directory, $directory.
 : @param $directory The path to the directory where the backup file is located.
 : @param $name The name of the file to retrieve.
 :)
declare function backups:retrieve($directory as xs:string, $name as xs:string) as empty-sequence() external;
