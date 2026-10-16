---
"@repo/backend": patch
"@repo/contents": patch
"www": patch
---

Give every account a username and a bio field, and serve a profile at
`/{locale}/@username`, kept out of search results. A new account gets the
username of its name, numbered or given a short random number when other
accounts hold it, and a temporary migration, with a dry pass, gives one to every
account made before. A person can rename it, with the reason in a word when it
is refused: a name with a character other than lowercase letters, digits, or an
underscore, one that starts with a digit or an underscore, one shorter than
three characters, a reserved route or brand name, and one another account holds.
No profile is public yet, because a profile is for an adult who belongs to no
school and the product stores no age: the account itself opens its profile,
every other request ends as not found, and a comment shows no link to its
author. The old address `/{locale}/user/{id}` redirects for good to the
username address of the account that holds the id, and is not found for anyone
else. A deleted account keeps neither username nor bio. The route roots that a
username cannot take now live in `@repo/contents/route/root`.
