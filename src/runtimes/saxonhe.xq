module namespace saxon="http://saxon.sf.net/";
(:~ Evaluates an XPath expression. :)
declare function saxon:evaluate($xpath as xs:string) as item()* external;
(:~ Returns the Saxon version. :)
declare function saxon:version() as xs:string external;
