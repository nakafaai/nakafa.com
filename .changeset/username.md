---
"@repo/backend": patch
"@repo/contents": patch
"www": patch
---

Give every account a username and a bio field, and serve a profile at
`/{locale}/@username`, kept out of search results. A new account gets the
username of its name, numbered or given a short random number when other
accounts hold it, and a temporary migration gives one to every account made
before. A person can rename it, with the reason in a word when it is refused: a
name with a character other than lowercase letters, digits, or an underscore,
one that starts with a digit or an underscore, one shorter than three
characters, a reserved route or brand name, and one another account holds. The
old address `/{locale}/user/{id}` answers with a temporary redirect to the
username, and a deleted account keeps neither username nor bio. The route roots
that a username cannot take now live in `@repo/contents/route/root`.
