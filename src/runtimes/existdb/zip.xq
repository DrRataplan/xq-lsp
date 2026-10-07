module namespace zip = "http://expath.org/ns/zip";

(:~
 : Extracts the binary stream from the file positioned at $entry within the ZIP
 : file identified by $href and returns it as a Base64 item.
 : @param $href The URI for locating the Zip file
 : @param $entry The entry within the Zip file to address
 : @return The binary representation of the entry from the Zip file.
 :)
declare function zip:binary-entry($href as xs:anyURI, $entry as xs:string) as xs:base64Binary external;

(:~
 : Returns a zip:file element that describes the hierarchical structure of the
 : ZIP file identified by $href in terms of ZIP entries
 : @param $href The URI for locating the Zip file
 : @return The document node containing a zip:entry
 :)
declare function zip:entries($href as xs:anyURI) as node() external;

(:~
 : Extracts the html file positioned at $entry within the ZIP file identified
 : by $href, and returns a document node. Because an HTML document is not
 : necessarily a well-formed XML document, an implementation may use a specific
 : parser in order to produce an XDM document node, like [TagSoup] or [HTML
 : Tidy]; the details of this process are implementation-defined.
 : @param $href The URI for locating the Zip file
 : @param $entry The entry within the Zip file to address
 : @return The document-node of the entry from the Zip file.
 :)
declare function zip:html-entry($href as xs:anyURI, $entry as xs:string) as document-node() external;

(:~
 : Extracts the contents of the text file positioned at entry within the ZIP
 : file identified by $href and returns it as a string.
 : @param $href The URI for locating the Zip file
 : @param $entry The entry within the Zip file to address
 : @return The string value of the entry from the Zip file.
 :)
declare function zip:text-entry($href as xs:anyURI, $entry as xs:string) as xs:string external;

(:~
 : Returns a copy of the zip file at $href, after replacing or adding each
 : binary using the matching path/filename in $paths.
 : @param $href The URI for locating the Zip file
 : @param $paths a sequence of file paths
 : @param $binaries a sequence of binaries matching the paths
 : @return The new zipped data or the empty sequence if the numbers of $paths and $binaries are different
 :)
declare function zip:update($href as xs:anyURI, $paths as xs:string+, $binaries as xs:base64Binary+) as xs:base64Binary? external;

(:~
 : Extracts the content from the XML file positioned at $entry within the ZIP
 : file identified by $href and returns it as a document-node.
 : @param $href The URI for locating the Zip file
 : @param $entry The entry within the Zip file to address
 : @return The document-node of the entry from the Zip file.
 :)
declare function zip:xml-entry($href as xs:anyURI, $entry as xs:string) as document-node() external;
