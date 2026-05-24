module namespace sm = "http://exist-db.org/xquery/securitymanager";

(: ── Account Management ───────────────────────────────────────────────────── :)

(:~
 : Creates a new user account with the given name, password, and primary group.
 : @param $user-name The username for the new account
 : @param $password The password (plain text)
 : @param $primary-group The primary group name
 :)
declare function sm:create-account($user-name as xs:string, $password as xs:string, $primary-group as xs:string) as empty-sequence() external;

(:~
 : Creates a new user account with the given name, password, groups, and metadata.
 : @param $user-name The username for the new account
 : @param $password The password (plain text)
 : @param $primary-group The primary group name
 : @param $groups Additional groups to assign
 :)
declare function sm:create-account($user-name as xs:string, $password as xs:string, $primary-group as xs:string, $groups as xs:string*) as empty-sequence() external;

(:~
 : Creates a new user account from an account descriptor element.
 : @param $account The account descriptor element
 :)
declare function sm:create-account($account as element()) as empty-sequence() external;

(:~
 : Modifies an existing account using an account descriptor element.
 : @param $account The account descriptor element
 :)
declare function sm:modify-account($account as element()) as empty-sequence() external;

(:~
 : Removes the user account with the given name.
 : @param $user-name The username of the account to remove
 :)
declare function sm:remove-account($user-name as xs:string) as empty-sequence() external;

(:~
 : Returns true if the given user account exists.
 : @param $user-name The username to check
 :)
declare function sm:account-exists($user-name as xs:string) as xs:boolean external;

(:~
 : Returns information about the given user account as an element.
 : @param $user-name The username
 :)
declare function sm:get-account($user-name as xs:string) as element()? external;

(:~
 : Returns the names of all user accounts.
 :)
declare function sm:find-accounts-by-name($user-name as xs:string) as element()* external;

(:~
 : Lists all known account (user) names.
 :)
declare function sm:list-groups() as xs:string* external;

(:~
 : Returns all user account names registered in the system.
 :)
declare function sm:list-accounts() as xs:string* external;

(:~
 : Changes the password of the given user account.
 : @param $user-name The username
 : @param $password The new password (plain text)
 :)
declare function sm:passwd($user-name as xs:string, $password as xs:string) as empty-sequence() external;

(:~
 : Enables or disables the given user account.
 : @param $user-name The username
 : @param $enabled True to enable, false to disable
 :)
declare function sm:set-account-enabled($user-name as xs:string, $enabled as xs:boolean) as empty-sequence() external;

(:~
 : Returns true if the given user account is enabled.
 : @param $user-name The username
 :)
declare function sm:is-account-enabled($user-name as xs:string) as xs:boolean external;

(:~
 : Returns metadata for the given user account attribute.
 : @param $user-name The username
 : @param $attribute The metadata attribute URI
 :)
declare function sm:get-account-metadata($user-name as xs:string, $attribute as xs:anyURI) as xs:string? external;

(:~
 : Sets a metadata attribute on the given user account.
 : @param $user-name The username
 : @param $attribute The metadata attribute URI
 : @param $value The value to set
 :)
declare function sm:set-account-metadata($user-name as xs:string, $attribute as xs:anyURI, $value as xs:string) as empty-sequence() external;

(:~
 : Returns the available account metadata attribute URIs.
 :)
declare function sm:get-account-metadata-keys() as xs:anyURI* external;

(:~
 : Returns the UMask setting (file-creation mode mask) for the given user.
 : @param $user-name The username
 :)
declare function sm:get-umask($user-name as xs:string) as xs:integer external;

(:~
 : Sets the UMask for the given user.
 : @param $user-name The username
 : @param $umask The new umask value (integer)
 :)
declare function sm:set-umask($user-name as xs:string, $umask as xs:integer) as empty-sequence() external;

(: ── Group Management ─────────────────────────────────────────────────────── :)

(:~
 : Creates a new group with the given name.
 : @param $group-name The name of the new group
 :)
declare function sm:create-group($group-name as xs:string) as empty-sequence() external;

(:~
 : Creates a new group with the given name and manager.
 : @param $group-name The name of the new group
 : @param $manager The username of the group manager
 :)
declare function sm:create-group($group-name as xs:string, $manager as xs:string) as empty-sequence() external;

(:~
 : Creates a new group from a group descriptor element.
 : @param $group The group descriptor element
 :)
declare function sm:create-group($group as element()) as empty-sequence() external;

(:~
 : Modifies an existing group using a group descriptor element.
 : @param $group The group descriptor element
 :)
declare function sm:modify-group($group as element()) as empty-sequence() external;

(:~
 : Removes the group with the given name.
 : @param $group-name The group name to remove
 :)
declare function sm:remove-group($group-name as xs:string) as empty-sequence() external;

(:~
 : Returns true if the given group exists.
 : @param $group-name The group name to check
 :)
declare function sm:group-exists($group-name as xs:string) as xs:boolean external;

(:~
 : Returns information about the given group as an element.
 : @param $group-name The group name
 :)
declare function sm:get-group($group-name as xs:string) as element()? external;

(:~
 : Returns a list of group names that match the given name (usually one).
 : @param $group-name The group name to search for
 :)
declare function sm:find-groups-by-name($group-name as xs:string) as element()* external;

(: ── Group Membership ─────────────────────────────────────────────────────── :)

(:~
 : Adds a user to the given group.
 : @param $group-name The group name
 : @param $user-name The username to add
 :)
declare function sm:add-group-member($group-name as xs:string, $user-name as xs:string) as empty-sequence() external;

(:~
 : Removes a user from the given group.
 : @param $group-name The group name
 : @param $user-name The username to remove
 :)
declare function sm:remove-group-member($group-name as xs:string, $user-name as xs:string) as empty-sequence() external;

(:~
 : Returns the names of all members of the given group.
 : @param $group-name The group name
 :)
declare function sm:get-group-members($group-name as xs:string) as xs:string* external;

(:~
 : Returns the names of all managers of the given group.
 : @param $group-name The group name
 :)
declare function sm:get-group-managers($group-name as xs:string) as xs:string* external;

(:~
 : Adds a manager to the given group.
 : @param $group-name The group name
 : @param $user-name The username to make manager
 :)
declare function sm:add-group-manager($group-name as xs:string, $user-name as xs:string) as empty-sequence() external;

(:~
 : Removes a manager from the given group.
 : @param $group-name The group name
 : @param $user-name The username to remove as manager
 :)
declare function sm:remove-group-manager($group-name as xs:string, $user-name as xs:string) as empty-sequence() external;

(: ── Authentication Context ───────────────────────────────────────────────── :)

(:~
 : Returns an element describing the current authentication identity (user and groups).
 :)
declare function sm:id() as element() external;

(:~
 : Returns true if the current user is authenticated through an external system (e.g. LDAP).
 :)
declare function sm:is-externally-authenticated() as xs:boolean external;

(:~
 : Returns true if the given user has DBA (administrator) privileges.
 : @param $user-name The username to check
 :)
declare function sm:is-dba($user-name as xs:string) as xs:boolean external;

(: ── Permissions ──────────────────────────────────────────────────────────── :)

(:~
 : Returns the permissions for the resource at the given URI as an element.
 : @param $uri The resource URI
 :)
declare function sm:get-permissions($uri as xs:anyURI) as element() external;

(:~
 : Returns the permissions for the given node (must be a stored document node).
 : @param $node The document node
 :)
declare function sm:get-permissions($node as node()) as element() external;

(:~
 : Changes the permissions of the resource at the given URI using a chmod-style string.
 : @param $uri The resource URI
 : @param $mode The permission mode string (e.g. "rwxr-xr-x" or octal like "0755")
 :)
declare function sm:chmod($uri as xs:anyURI, $mode as xs:string) as empty-sequence() external;

(:~
 : Changes the owner of the resource at the given URI.
 : @param $uri The resource URI
 : @param $owner The new owner username
 :)
declare function sm:chown($uri as xs:anyURI, $owner as xs:string) as empty-sequence() external;

(:~
 : Changes the group of the resource at the given URI.
 : @param $uri The resource URI
 : @param $group The new group name
 :)
declare function sm:chgrp($uri as xs:anyURI, $group as xs:string) as empty-sequence() external;

(:~
 : Returns true if the current user has the specified access to the resource.
 : @param $uri The resource URI
 : @param $mode The access mode to check (e.g. "r", "w", "x", "rw")
 :)
declare function sm:has-access($uri as xs:anyURI, $mode as xs:string) as xs:boolean external;

(: ── Access Control Lists ─────────────────────────────────────────────────── :)

(:~
 : Adds a user-based ACE (Access Control Entry) to the resource.
 : @param $target The resource URI
 : @param $user-name The username for the ACE
 : @param $allowed True to allow, false to deny
 : @param $mode The access mode string (e.g. "rwx")
 :)
declare function sm:add-user-ace($target as xs:anyURI, $user-name as xs:string, $allowed as xs:boolean, $mode as xs:string) as empty-sequence() external;

(:~
 : Adds a group-based ACE to the resource.
 : @param $target The resource URI
 : @param $group-name The group name for the ACE
 : @param $allowed True to allow, false to deny
 : @param $mode The access mode string (e.g. "rwx")
 :)
declare function sm:add-group-ace($target as xs:anyURI, $group-name as xs:string, $allowed as xs:boolean, $mode as xs:string) as empty-sequence() external;

(:~
 : Inserts a user-based ACE at the specified position in the resource ACL.
 : @param $target The resource URI
 : @param $index The position at which to insert (0-based)
 : @param $user-name The username for the ACE
 : @param $allowed True to allow, false to deny
 : @param $mode The access mode string
 :)
declare function sm:insert-user-ace($target as xs:anyURI, $index as xs:integer, $user-name as xs:string, $allowed as xs:boolean, $mode as xs:string) as empty-sequence() external;

(:~
 : Inserts a group-based ACE at the specified position in the resource ACL.
 : @param $target The resource URI
 : @param $index The position at which to insert (0-based)
 : @param $group-name The group name for the ACE
 : @param $allowed True to allow, false to deny
 : @param $mode The access mode string
 :)
declare function sm:insert-group-ace($target as xs:anyURI, $index as xs:integer, $group-name as xs:string, $allowed as xs:boolean, $mode as xs:string) as empty-sequence() external;

(:~
 : Modifies an existing ACE on the resource at the given index.
 : @param $target The resource URI
 : @param $index The ACE position (0-based)
 : @param $allowed True to allow, false to deny
 : @param $mode The new access mode string
 :)
declare function sm:modify-ace($target as xs:anyURI, $index as xs:integer, $allowed as xs:boolean, $mode as xs:string) as empty-sequence() external;

(:~
 : Removes the ACE at the given position from the resource ACL.
 : @param $target The resource URI
 : @param $index The ACE position (0-based)
 :)
declare function sm:remove-ace($target as xs:anyURI, $index as xs:integer) as empty-sequence() external;

(:~
 : Removes all ACEs from the resource ACL.
 : @param $target The resource URI
 :)
declare function sm:clear-acl($target as xs:anyURI) as empty-sequence() external;
