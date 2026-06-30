module namespace exist = "http://exist.sourceforge.net/NS/exist";

(:~
 : The path component of the URL that points to the controller, relative to the
 : application root. Injected by the URL rewriter when dispatching to a
 : controller.xq.
 :)
declare variable $exist:controller as xs:string external;

(:~
 : The remaining path after the controller, i.e. the portion of the request URL
 : below the controller collection.
 :)
declare variable $exist:path as xs:string external;

(:~
 : The last path component of the request URL (the filename, without extension).
 :)
declare variable $exist:resource as xs:string external;

(:~
 : The root collection of the application package (the xmldb:exist:// URI).
 :)
declare variable $exist:root as xs:string external;

(:~
 : The URL prefix prepended by the URL mapping (e.g. "/exist/apps/myapp").
 :)
declare variable $exist:prefix as xs:string external;
