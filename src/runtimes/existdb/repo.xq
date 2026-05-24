module namespace repo = "http://exist-db.org/xquery/repo";

(:~
 : Deploy an application package. Installs package contents to the specified
 : target collection, using the permissions defined by the &lt;permissions&gt;
 : element in repo.xml. Pre- and post-install XQuery scripts can be specified
 : via the &lt;prepare&gt; and &lt;finish&gt; elements.
 : @param $pkgName package name
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:deploy($pkgName as xs:string) as element() external;

(:~
 : Deploy an application package. Installs package contents to the specified
 : target collection, using the permissions defined by the &lt;permissions&gt;
 : element in repo.xml. Pre- and post-install XQuery scripts can be specified
 : via the &lt;prepare&gt; and &lt;finish&gt; elements.
 : @param $pkgName package name
 : @param $targetCollection the target collection into which the package will be stored
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:deploy($pkgName as xs:string, $targetCollection as xs:string) as element() external;

(:~
 : Retrieves the specified resource from an installed expath application
 : package.
 : @param $pkgName package name
 : @param $resource resource path
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:get-resource($pkgName as xs:string, $resource as xs:string) as xs:base64Binary? external;

(:~
 : Returns the root collection into which applications are installed.
 : Corresponds to the collection path defined in conf.xml (<repository
 : root="..."/>) or /db if not configured.
 : @return The application root collection
 :)
declare function repo:get-root() as xs:string external;

(:~
 : Install package from repository.
 : @param $pkgName package name
 : @return true if successful, false otherwise
 :)
declare function repo:install($pkgName as xs:string) as xs:boolean external;

(:~
 : Downloads, installs and deploys a package from the public repository at
 : $publicRepoURL. Dependencies are resolved automatically. For downloading the
 : package, the package name is appended to the repository URL as parameter
 : 'name'.
 : @param $pkgName Unique name of the package to install.
 : @param $publicRepoURL The URL of the public repo.
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:install-and-deploy($pkgName as xs:string, $publicRepoURL as xs:string) as element() external;

(:~
 : Downloads, installs and deploys a package from the public repository at
 : $publicRepoURL. Dependencies are resolved automatically. For downloading the
 : package, the package name and version are appended to the repository URL as
 : parameters 'name' and 'version'.
 : @param $pkgName Unique name of the package to install.
 : @param $version Version to install.
 : @param $publicRepoURL The URL of the public repo.
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:install-and-deploy(
	$pkgName as xs:string,
	$version as xs:string?,
	$publicRepoURL as xs:string
) as element() external;

(:~
 : Installs and deploys a package from a .xar archive file stored in the
 : database. Dependencies are not resolved and will just be ignored.
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:install-and-deploy-from-db($path as xs:string) as element() external;

(:~
 : Installs and deploys a package from a .xar archive file stored in the
 : database. Dependencies will be downloaded from the public repo and installed
 : automatically.
 : @param $publicRepoURL The URL of the public repo.
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:install-and-deploy-from-db($path as xs:string, $publicRepoURL as xs:string) as element() external;

(:~
 : Install package stored in database.
 : @return true if successful, false otherwise
 :)
declare function repo:install-from-db($path as xs:string) as xs:boolean external;

(:~
 : List repository packages.
 : @return sequence of strings
 :)
declare function repo:list() as xs:string* external;

(:~
 : Remove package, pkgName, from repository.
 : @param $pkgName package name
 : @return true if successful, false otherwise
 :)
declare function repo:remove($pkgName as xs:string) as xs:boolean external;

(:~
 : Returns true if the specified resource exists in the named EXPath package,
 : false otherwise.
 : @param $pkgName package name
 : @param $resource resource path
 : @return true if the resource exists in the package, false otherwise
 :)
declare function repo:resource-available($pkgName as xs:string, $resource as xs:string) as xs:boolean external;

(:~
 : Uninstall the resources belonging to a package from the db. Calls cleanup
 : scripts if defined.
 : @param $pkgName package name
 : @return <status result="ok"/> if deployment was ok. Throws an error otherwise.
 :)
declare function repo:undeploy($pkgName as xs:string) as element() external;
