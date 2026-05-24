module namespace crypto = "http://expath.org/ns/crypto";

(:~
 : Generates a hash of the given string using the specified algorithm.
 : @param $message The message to hash
 : @param $algorithm The hash algorithm: "MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"
 : @param $provider The provider name, or empty string for the default provider
 :)
declare function crypto:hash($message as xs:string, $algorithm as xs:string, $provider as xs:string) as xs:string external;

(:~
 : Generates a hash of the given string and returns it in the given encoding.
 : @param $message The message to hash
 : @param $algorithm The hash algorithm
 : @param $provider The provider name (empty string for default)
 : @param $encoding The output encoding: "hex" or "base64"
 :)
declare function crypto:hash($message as xs:string, $algorithm as xs:string, $provider as xs:string, $encoding as xs:string) as xs:string external;

(:~
 : Generates an HMAC (hash-based message authentication code) for the given message.
 : @param $message The message to authenticate
 : @param $secret-key The secret key as a string
 : @param $algorithm The HMAC algorithm: "HMAC-MD5", "HMAC-SHA-1", "HMAC-SHA-256", etc.
 : @param $encoding The output encoding: "hex" or "base64"
 :)
declare function crypto:hmac($message as xs:string, $secret-key as xs:string, $algorithm as xs:string, $encoding as xs:string) as xs:string external;

(:~
 : Encrypts data using the given algorithm and key.
 : @param $data The data to encrypt (string or xs:base64Binary)
 : @param $secret-key The encryption key
 : @param $algorithm The encryption algorithm (e.g. "AES/CBC/PKCS5Padding")
 : @param $provider The provider name (empty string for default)
 :)
declare function crypto:encrypt($data as item(), $secret-key as xs:string, $algorithm as xs:string, $provider as xs:string) as xs:string external;

(:~
 : Decrypts data that was encrypted with crypto:encrypt.
 : @param $data The encrypted data (as Base64 string)
 : @param $secret-key The decryption key
 : @param $algorithm The encryption algorithm
 : @param $provider The provider name (empty string for default)
 :)
declare function crypto:decrypt($data as xs:string, $secret-key as xs:string, $algorithm as xs:string, $provider as xs:string) as xs:string external;

(:~
 : Generates an XML digital signature for the given input.
 : @param $input The data to sign (node or string)
 : @param $canonicalization-algorithm The canonicalization algorithm URI
 : @param $digest-algorithm The digest algorithm URI
 : @param $signature-algorithm The signature algorithm URI
 : @param $signature-namespace-prefix The namespace prefix for the signature element
 : @param $xpath-expression An XPath expression selecting the nodes to sign (empty string for whole document)
 : @param $cryptographic-provider The cryptographic provider
 : @param $digest-property-id The ID of the signature properties element, or empty string
 :)
declare function crypto:generate-signature($input as node(), $canonicalization-algorithm as xs:string, $digest-algorithm as xs:string, $signature-algorithm as xs:string, $signature-namespace-prefix as xs:string, $xpath-expression as xs:string, $cryptographic-provider as xs:string, $digest-property-id as xs:string) as node() external;

(:~
 : Validates an XML digital signature on the given input.
 : @param $input The signed document node
 :)
declare function crypto:validate-signature($input as node()) as xs:boolean external;
