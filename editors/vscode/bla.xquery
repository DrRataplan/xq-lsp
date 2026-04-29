module namespace xq = "my-nms";
declare function xq:hello($name as xs:string) as xs:string {
    
  concat("Hello, ", $name, "!")
};

