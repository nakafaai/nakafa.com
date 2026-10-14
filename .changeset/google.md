---
"@repo/backend": patch
---

Stop storing the tokens that Google issues at sign-in. Sign-in asks Google for
the account chooser only, with no offline access and no consent screen at every
sign-in, and two Better Auth database hooks keep the access, refresh and ID
tokens and their expiry times out of every write to the account table: sign-up,
a link, the update at each sign-in and a token refresh. The routes that read or
refresh a stored token, `/get-access-token`, `/account-info` and
`/refresh-token`, answer 404 over HTTP, and a plugin hook refuses them for
server code too. A temporary internal mutation of the Better Auth component,
`tokens:clearPage`, removes the tokens that older sign-ins stored, one page of
accounts a call, with a dry pass that only counts.
