module namespace repo = "http://exist-db.org/xquery/repo";

(:~
 : Returns the filesystem path of the local package repository.
 :)
declare function repo:get-root() as xs:string? external;

(:~
 : Returns the namespace URIs of all installed packages.
 :)
declare function repo:list() as xs:string* external;

(:~
 : Returns a package descriptor element for the given package URI.
 : @param $package-uri The package URI (namespace)
 :)
declare function repo:get-desc($package-uri as xs:string) as element()? external;

(:~
 : Returns application metadata for the given package URI.
 : @param $package-uri The package URI
 :)
declare function repo:get-app-info($package-uri as xs:string) as element()? external;

(:~
 : Returns application metadata for the currently executing application.
 :)
declare function repo:get-app-info() as element()? external;

(:~
 : Installs a package from the given .xar file path or URL.
 : @param $package-path The path or URL of the .xar package file
 :)
declare function repo:install($package-path as xs:string) as element()? external;

(:~
 : Installs and deploys a package from a remote repository URL.
 : @param $package-uri The package namespace URI to install
 : @param $repo-uri The remote repository URL (e.g. "http://demo.exist-db.org/exist/apps/public-repo")
 :)
declare function repo:install-and-deploy($package-uri as xs:string, $repo-uri as xs:string) as element()? external;

(:~
 : Installs and deploys a package from a .xar file already stored in the database.
 : @param $package-path The database URI of the .xar file
 : @param $repo-uri The remote repository URL for dependency resolution
 :)
declare function repo:install-and-deploy-from-db($package-path as xs:string, $repo-uri as xs:string) as element()? external;

(:~
 : Removes (uninstalls) the package with the given namespace URI.
 : @param $package-uri The package URI to remove
 :)
declare function repo:remove($package-uri as xs:string) as element()? external;

(:~
 : Deploys a package that is already installed in the repository.
 : @param $package-uri The package URI to deploy
 :)
declare function repo:deploy($package-uri as xs:string) as element()? external;

(:~
 : Undeploys a package (removes its deployment from the webapp) without removing it from the repo.
 : @param $package-uri The package URI to undeploy
 :)
declare function repo:undeploy($package-uri as xs:string) as element()? external;

(:~
 : Removes all packages from the repository.
 :)
declare function repo:clean-all() as empty-sequence() external;
