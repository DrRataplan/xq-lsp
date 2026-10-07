module namespace kwic = "http://exist-db.org/xquery/kwic";

(:~
 : Expand the element in $hit. Creates an in-memory copy of the element and
 : marks all element matches with an exist:match tag and attribute matches with
 : an exist:matches tag, which will be used by all other functions in this
 : module. You need to call kwic:expand before kwic:get-summary. kwic:summarize
 : will call it automatically.
 :)
declare function kwic:expand($hit as element()) as element() external;

(:~
 : Return all matches within the specified element, $hit. Matches are returned
 : as exist:match elements or elements with exist:matches attribute. The
 : returned nodes are part of a new document whose root element is a copy of
 : the specified $hit element.
 : @param $hit an arbitrary XML element which has been selected by one of the full text operations or an ngram search.
 :)
declare function kwic:get-matches($hit as element()) as element()* external;

declare function kwic:get-summary($root as node(), $node as element(), $config as element()?) as element() external;

(:~
 : Print a summary of the match in $node. Output a predefined amount of text to
 : the left and the right of the match.
 : @param $root root element which should be used as context for the match. It defines the boundaries for the text extraction. Text will be taken from this context.
 : @param $node the exist:match element or the element with @exist:macthes attribute to process.
 : @param $config configuration element which determines the behaviour of the function
 : @param $callback (optional) reference to a callback function which will be called once for every text node before it is appended to the displayed text. The function should accept 2 parameters: 1) a single text node, 2) a string indicating the current direction in which text is appended, i.e. $kwic:MODE_BEFORE or $kwic:MODE_AFTER. The function may return the empty sequence if the current node should be ignore (e.g. if it belongs to a "footnote" which should not be displayed). Otherwise it should return a single string.
 :)
declare function kwic:get-summary(
	$root as node(),
	$node as element(),
	$config as element()?,
	$callback as function(*)?
) as element() external;

declare function kwic:summarize($hit as element(), $config as element()?) as element()* external;

(:~
 : Main function of the KWIC module: takes the passed element and returns an
 : XHTML fragment containing a chunk of text before and after the first full
 : text match in the node. The optional config parameter is used to configure
 : the behaviour of the function: &amp;lt;config width="character width"
 : table="yes|no" link="URL to which the match is linked"/&amp;gt; By default,
 : kwic:summarize returns an XHTML fragment with the following structure:
 : &amp;lt;p xmlns="http://www.w3.org/1999/xhtml"&amp;gt; &amp;lt;span
 : class="previous"&amp;gt;Text before match&amp;lt;/span&amp;gt; &amp;lt;a
 : href="passed URL if any" class="hi"&amp;gt;The highlighted
 : term&amp;lt;/a&amp;gt; &amp;lt;span class="following"&amp;gt;Text after
 : match&amp;lt;/span&amp;gt; &amp;lt;/p&amp;gt; If table=yes is passed with
 : the config element, a tr table row will be returned instead of a span (using
 : the same class names).
 : @param $hit an arbitrary XML element which has been selected by one of the full text operations or an ngram search.
 : @param $config configuration element to configure the behaviour of the function
 :)
declare function kwic:summarize($hit as element(), $config as element()?, $callback as function(*)?) as element()* external;
