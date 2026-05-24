module namespace sm = "http://exist-db.org/xquery/securitymanager";

(:~
 : Adds a Group ACE to the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to add the ACE to.
 : @param $group-name The name of the group to create an ACE for.
 : @param $mode The mode to set on the ACE e.g. 'rwx'
 :)
declare function sm:add-group-ace(
	$path as xs:anyURI,
	$group-name as xs:string,
	$allowed as xs:boolean,
	$mode as xs:string
) as empty-sequence() external;

(:~
 : Adds a manager to a groups managers. Can only be called by a group manager
 : or DBA.
 :)
declare function sm:add-group-manager($group as xs:string, $manager as xs:string+) as empty-sequence() external;

(:~
 : Adds a user to a group. Can only be called by a group manager or DBA.
 : @param $group The name of the group whoose membership you wish to modify.
 :)
declare function sm:add-group-member($group as xs:string, $member as xs:string+) as empty-sequence() external;

(:~
 : Adds a User ACE to the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to add the ACE to.
 : @param $user-name The name of the user to create an ACE for.
 : @param $mode The mode to set on the ACE e.g. 'rwx'
 :)
declare function sm:add-user-ace(
	$path as xs:anyURI,
	$user-name as xs:string,
	$allowed as xs:boolean,
	$mode as xs:string
) as empty-sequence() external;

(:~
 : Changes the group owner of a resource or collection.
 : @param $path The path to the resource or collection whose group owner you wish to set
 : @param $group-name The name of the user group owner to set on the resource or collection e.g. 'guest'
 :)
declare function sm:chgrp($path as xs:anyURI, $group-name as xs:string) as empty-sequence() external;

(:~
 : Changes the mode of a resource or collection.
 : @param $path The path to the resource or collection whose mode you wish to set
 : @param $mode The mode to set on the resource or collection e.g. 'rwxrwxrwx'
 :)
declare function sm:chmod($path as xs:anyURI, $mode as xs:string) as empty-sequence() external;

(:~
 : Changes the owner of a resource or collection.
 : @param $path The path to the resource or collection whose owner you wish to set
 : @param $owner The name of the user owner to set on the resource or collection e.g. 'guest'. You may also provide a group owner, by using the syntax 'user:group' if you wish.
 :)
declare function sm:chown($path as xs:anyURI, $owner as xs:string) as empty-sequence() external;

(:~
 : Removes all ACEs from the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to clear.
 :)
declare function sm:clear-acl($path as xs:anyURI) as empty-sequence() external;

(:~
 : Creates a User Account and a personal group for that user. The personal
 : group takes the same name as the user, and is set as the user's primary
 : group.
 : @param $username The User's username.
 : @param $password The User's password.
 : @param $groups Any supplementary groups of which the user should be a member.
 :)
declare function sm:create-account($username as xs:string, $password as xs:string, $groups as xs:string*) as empty-sequence() external;

(:~
 : Creates a User Account.
 : @param $username The User's username.
 : @param $password The User's password.
 : @param $primary-group The primary group of the user.
 : @param $groups Any supplementary groups of which the user should be a member.
 :)
declare function sm:create-account(
	$username as xs:string,
	$password as xs:string,
	$primary-group as xs:string,
	$groups as xs:string*
) as empty-sequence() external;

(:~
 : Creates a User Account and a personal group for that user. The personal
 : group takes the same name as the user, and is set as the user's primary
 : group.
 : @param $username The User's username.
 : @param $password The User's password.
 : @param $groups Any supplementary groups of which the user should be a member.
 : @param $full-name The full name of the user.
 : @param $description A description of the user.
 :)
declare function sm:create-account(
	$username as xs:string,
	$password as xs:string,
	$groups as xs:string*,
	$full-name as xs:string,
	$description as xs:string
) as empty-sequence() external;

(:~
 : Creates a User Account.
 : @param $username The User's username.
 : @param $password The User's password.
 : @param $primary-group The primary group of the user.
 : @param $groups Any supplementary groups of which the user should be a member.
 : @param $full-name The full name of the user.
 : @param $description A description of the user.
 :)
declare function sm:create-account(
	$username as xs:string,
	$password as xs:string,
	$primary-group as xs:string,
	$groups as xs:string*,
	$full-name as xs:string,
	$description as xs:string
) as empty-sequence() external;

(:~
 : Creates a User Group. The current user will be set as the group's manager.
 : @param $group-name The name of the group to create.
 :)
declare function sm:create-group($group-name as xs:string) as empty-sequence() external;

(:~
 : Creates a User Group. The current user will be set as the group's manager.
 : @param $group-name The name of the group to create.
 : @param $description A description of the group.
 :)
declare function sm:create-group($group-name as xs:string, $description as xs:string) as empty-sequence() external;

(:~
 : Creates a User Group. The current user will be set as a manager of the group
 : in addition to the specified managers.
 : @param $group-name The name of the group to create.
 : @param $managers The usernames of users that will be a manager of this group.
 : @param $description A description of the group.
 :)
declare function sm:create-group($group-name as xs:string, $managers as xs:string+, $description as xs:string) as empty-sequence() external;

(:~
 : Finds groups whoose group name starts with a matching string
 : @param $starts-with The starting string against which to match group names
 : @return The list of matching group names
 :)
declare function sm:find-groups-by-groupname($starts-with as xs:string) as xs:string* external;

(:~
 : Finds groups whoose group name contains the string fragment
 : @param $fragment The fragment against which to match group names
 : @return The list of matching group names
 :)
declare function sm:find-groups-where-groupname-contains($fragment as xs:string) as xs:string* external;

(:~
 : Finds users whoose personal name starts with a matching string
 : @param $starts-with The starting string against which to match a personal name
 : @return The list of matching usernames
 :)
declare function sm:find-users-by-name($starts-with as xs:string) as xs:string* external;

(:~
 : Finds users whoose first name or last name starts with a matching string
 : @param $starts-with The starting string against which to match a first or last name
 : @return The list of matching usernames
 :)
declare function sm:find-users-by-name-part($starts-with as xs:string) as xs:string* external;

(:~
 : Finds users whoose username starts with a matching string
 : @param $starts-with The starting string against which to match usernames
 : @return The list of matching usernames
 :)
declare function sm:find-users-by-username($starts-with as xs:string) as xs:string* external;

(:~
 : Gets a metadata attribute value for an account
 : @param $username The username of the account to retrieve metadata from.
 : @param $attribute The fully qualified metadata attribute key name
 : @return The metadata value
 :)
declare function sm:get-account-metadata($username as xs:string, $attribute as xs:anyURI) as xs:string? external;

(:~
 : Gets a sequence of the metadata attribute keys that may be used for an
 : account.
 : @return The fully qualified metadata attribute key names
 :)
declare function sm:get-account-metadata-keys() as xs:anyURI* external;

(:~
 : Gets a sequence of the metadata attribute keys present for an account
 : @param $username The username of the account to retrieve metadata from.
 : @return The fully qualified metadata attribute key names
 :)
declare function sm:get-account-metadata-keys($username as xs:string) as xs:anyURI* external;

(:~
 : Gets a list of the group managers. Can only be called by a group manager.
 : @param $group The group name to retrieve the list of managers for.
 : @return The list of group managers for the group $group
 :)
declare function sm:get-group-managers($group as xs:string) as xs:string+ external;

(:~
 : Gets a list of the group members.
 : @param $group The group name to retrieve the list of members for.
 : @return The list of group members for the group $group
 :)
declare function sm:get-group-members($group as xs:string) as xs:string+ external;

(:~
 : Gets a metadata attribute value for a group
 : @param $group-name The name of the group to retrieve metadata from.
 : @param $attribute The fully qualified metadata attribute key name
 : @return The metadata value
 :)
declare function sm:get-group-metadata($group-name as xs:string, $attribute as xs:anyURI) as xs:string? external;

(:~
 : Gets a sequence of the metadata attribute keys that may be used for a group.
 : @return The fully qualified metadata attribute key names
 :)
declare function sm:get-group-metadata-keys() as xs:anyURI* external;

(:~
 : Gets a sequence of the metadata attribute keys present for a group
 : @param $group-name The name of the group to retrieve metadata from.
 : @return The fully qualified metadata attribute key names
 :)
declare function sm:get-group-metadata-keys($group-name as xs:string) as xs:anyURI* external;

(:~
 : Gets the permissions of a resource or collection.
 : @param $path The path to the resource or collection to get permissions of.
 : @return The permissions of the resource or collection
 :)
declare function sm:get-permissions($path as xs:anyURI) as document-node() external;

(:~
 : Gets the umask of a Users Account.
 : @param $username The username of the account to retrieve the umask for.
 : @return The umask of the users account expressed as an integer
 :)
declare function sm:get-umask($username as xs:string) as xs:int* external;

(:~
 : Returns the sequence of groups that the user $user is a member of. You must
 : be a DBA or logged in as the user for which you are trying to retrieve group
 : details for.
 : @param $user The username to retrieve the group membership list for.
 : @return The users group memberships
 :)
declare function sm:get-user-groups($user as xs:string) as xs:string+ external;

(:~
 : Returns the primary group of the user $user. You must be a DBA or logged in
 : as the user for which you are trying to retrieve group details for.
 : @param $user The username to retrieve the primary group of.
 : @return The users primary group
 :)
declare function sm:get-user-primary-group($user as xs:string) as xs:string external;

(:~
 : Determines whether a user group exists.
 : @param $group The name of the user group to check for existence.
 : @return true if the user group exists, false otherwise.
 :)
declare function sm:group-exists($group as xs:string) as xs:boolean external;

(:~
 : Checks whether the current user has access to the resource or collection.
 : @param $path The path to the resource or collection whose access of which you wish to check
 : @param $mode The partial mode to check against the resource or collection e.g. 'rwx'
 :)
declare function sm:has-access($path as xs:anyURI, $mode as xs:string) as xs:boolean external;

(:~
 : Returns the user and group names of the account executing the XQuery. If the
 : real and effective accounts are different, then both the real and effective
 : account details are returned, otherwise only the real account details are
 : returned.
 : @return Example output when an XQuery is running setUid <id xmlns="http://exist-db.org/xquery/securitymanager"><real><username>guest</username><groups><group>guest</group></groups></real><effective><username>admin</username><groups><group>dba</group></groups></effective></id>.
 :)
declare function sm:id() as document-node() external;

(:~
 : Inserts a Group ACE into the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to add the ACE to.
 : @param $index The index in the ACL to insert the ACE before, subsequent entries will be renumbered
 : @param $group-name The name of the group to create an ACE for.
 : @param $mode The mode to set on the ACE e.g. 'rwx'
 :)
declare function sm:insert-group-ace(
	$path as xs:anyURI,
	$index as xs:int,
	$group-name as xs:string,
	$allowed as xs:boolean,
	$mode as xs:string
) as empty-sequence() external;

(:~
 : Inserts a User ACE into the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to add the ACE to.
 : @param $index The index in the ACL to insert the ACE before, subsequent entries will be renumbered
 : @param $user-name The name of the user to create an ACE for.
 : @param $mode The mode to set on the ACE e.g. 'rwx'
 :)
declare function sm:insert-user-ace(
	$path as xs:anyURI,
	$index as xs:int,
	$user-name as xs:string,
	$allowed as xs:boolean,
	$mode as xs:string
) as empty-sequence() external;

(:~
 : Determines whether a user account is enabled. You must be a DBA, or you must
 : be enquiring about your own user account.
 : @param $username The username of the account to check the status for.
 : @return true if the account is enabled, false otherwise.
 :)
declare function sm:is-account-enabled($username as xs:string) as xs:boolean external;

(:~
 : Returns the true() if current account is authenticated, false() otherwise.
 :)
declare function sm:is-authenticated() as xs:boolean external;

(:~
 : Determines if the user is a DBA.
 : @param $username The username of the user account to check if they are a member of the DBA group.
 : @return true of the user is a DBA, false otherwise.
 :)
declare function sm:is-dba($username as xs:string) as xs:boolean external;

(:~
 : Returns the true() if current account is authenticated by an external realm,
 : false() otherwise.
 :)
declare function sm:is-externally-authenticated() as xs:boolean external;

(:~
 : List all groups
 : @return The list of groups
 :)
declare function sm:list-groups() as xs:string* external;

(:~
 : List all users. You must be a DBA to enumerate all users, if you are not a
 : DBA you will just get the username of the currently logged in user.
 : @return The list of users.
 :)
declare function sm:list-users() as xs:string+ external;

(:~
 : Converts a mode string e.g. 'rwxrwxrwx' to an octal number e.g. 0777.
 : @param $mode The mode to convert to an octal string.
 :)
declare function sm:mode-to-octal($mode as xs:string) as xs:string external;

(:~
 : Modified an ACE of an ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to modify the ACE of.
 : @param $index The index of the ACE in the ACL to modify
 : @param $mode The mode to set on the ACE e.g. 'rwx'
 :)
declare function sm:modify-ace(
	$path as xs:anyURI,
	$index as xs:int,
	$allowed as xs:boolean,
	$mode as xs:string
) as empty-sequence() external;

(:~
 : Converts an octal string e.g. '0777' to a mode string e.g. 'rwxrwxrwx'.
 : @param $octal The octal string to convert to a mode.
 :)
declare function sm:octal-to-mode($octal as xs:string) as xs:string external;

(:~
 : Changes the password of a User Account.
 : @param $username The User's username.
 : @param $password The User's new password.
 :)
declare function sm:passwd($username as xs:string, $password as xs:string) as empty-sequence() external;

(:~
 : Changes the password of a User Account by directly setting the stored digest
 : password. The use-case for this function is migrating a user from one eXist
 : instance to another.
 : @param $username The User's username.
 :)
declare function sm:passwd-hash($username as xs:string, $password-digest as xs:string) as empty-sequence() external;

(:~
 : Removes a User Account. If the user has a personal group you are responsible
 : for removing that separately through sm:remove-group.
 : @param $username The User's username.
 :)
declare function sm:remove-account($username as xs:string) as empty-sequence() external;

(:~
 : Removes an ACE from the ACL of a resource or collection.
 : @param $path The path to the resource or collection whose ACL you wish to remove the ACE from.
 : @param $index The index of the ACE in the ACL to remove, subsequent entries will be renumbered
 :)
declare function sm:remove-ace($path as xs:anyURI, $index as xs:int) as empty-sequence() external;

(:~
 : Remove a User Group.
 : @param $group-name The group-id to delete
 :)
declare function sm:remove-group($group-name as xs:string) as empty-sequence() external;

(:~
 : Removes a manager from a groups managers. Can only be called by a group
 : manager of DBA.
 :)
declare function sm:remove-group-manager($group as xs:string, $manager as xs:string+) as empty-sequence() external;

(:~
 : Removes a user from a group. Can only be called by a group manager of DBA.
 : @param $group The name of the group whoose membership you wish to modify.
 :)
declare function sm:remove-group-member($group as xs:string, $member as xs:string+) as empty-sequence() external;

(:~
 : Enabled or disables a users account. You must be a DBA to enable or disable
 : an account.
 : @param $username The username of the account to enable or disable.
 : @param $enabled true to enable the account, false to disable the account.
 :)
declare function sm:set-account-enabled($username as xs:string, $enabled as xs:boolean) as empty-sequence() external;

(:~
 : Sets a metadata attribute value for an account
 : @param $username The username of the account to set metadata for.
 : @param $attribute The metadata attribute key.
 : @param $value The metadata value,
 :)
declare function sm:set-account-metadata($username as xs:string, $attribute as xs:anyURI, $value as xs:string) as empty-sequence() external;

(:~
 : Sets a metadata attribute value for a group
 : @param $group-name The name of the group to set metadata for.
 : @param $attribute The metadata attribute key.
 : @param $value The metadata value,
 :)
declare function sm:set-group-metadata($group-name as xs:string, $attribute as xs:anyURI, $value as xs:string) as empty-sequence() external;

(:~
 : Sets the umask of a Users Account.
 : @param $username The username of the account to set the umask for.
 : @param $umask The umask to set as an integer.
 :)
declare function sm:set-umask($username as xs:string, $umask as xs:int) as empty-sequence() external;

(:~
 : Sets the primary group of a user account. If the user is not yet in the
 : group, then they are added to the group first.
 : @param $username The name of the user account to set the primary group for.
 : @param $group The group to set as the primary group for the user.
 :)
declare function sm:set-user-primary-group($username as xs:string, $group as xs:string) as empty-sequence() external;

(:~
 : Determines whether a user exists.
 : @param $user The username to check for existence.
 : @return true if the user account exists, false otherwise.
 :)
declare function sm:user-exists($user as xs:string) as xs:boolean external;
