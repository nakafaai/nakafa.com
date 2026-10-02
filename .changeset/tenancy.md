---
"@repo/backend": minor
---

Let schools exist as tenants with units, Persons, and roles. Every School
function resolves the school from its address and the caller's Person in it,
checks each object it names against roles, relations, and conditions declared
once per kind, and answers another school's people with a typed denial. Owners
and admins can give and remove roles within the units they manage, every role
change is written to one audit journal in the same transaction, and the School
shell, the caller's school list, a school's public profile, and the audit log
read from these tables.
