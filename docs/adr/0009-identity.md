# ADR 0009: Token-Verified Reads And Session-Validated Writes

## Decision

The session middleware resolves one caller identity per Convex function and
provides it as `Session`: the Better Auth user id and the matching app user.
How it gets the Better Auth user id depends on the function type.

- Queries read the identity Convex already verified from the Better Auth token
  (`Auth.getUserIdentity`) and look up the app user by its `authId` index. They
  never call the Better Auth component.
- Mutations and actions also confirm, through Better Auth's `safeGetAuthUser`,
  that the token's session still exists and has not expired before they write.

`getCurrentUser` projects the account profile (name, email, image) from the app
user row. Better Auth's user triggers and the rename mutation keep those fields
current in the same transaction as the Better Auth write.

## Consequences

- A revoked or signed-out session can still read for the rest of its token's
  lifetime, which the Convex plugin sets to 15 minutes. Writes stop at once.
- Signed-in queries skip two Better Auth component lookups per call. Production
  measured `getCurrentUser` at about one second at the median, and every
  signed-in page waits on it before identity settles.
- Account state that must take effect immediately for reads, such as deletion,
  lives on the app user row, which every query reads.

## Stored Secrets

Better Auth seals the provider access and refresh tokens in `account`
(`account.encryptOAuthTokens`) and the private half of each signing key in
`jwks`, also in the static `JWKS` value, with the Better Auth secret. It stores
the Google ID token and the session token as issued. The ID token signs no one
in, because Google ID token sign-in is off (`disableIdTokenSignIn`). The session
token does: the bearer hook that the Convex plugin installs accepts it in an
`Authorization` header, and Better Auth has no option to seal it. Rotating the
secret signs every learner out. List the new secret first in
`BETTER_AUTH_SECRETS`, keep `BETTER_AUTH_SECRET` at its old value, and keep each
older version listed while anything is still sealed with it. Keep
`encryptOAuthTokens` on, because with it off Better Auth hands out the cipher
text.

## Rejected Alternative

Validating the session inside every query closes the read window after
revocation, but it adds two Better Auth component lookups to every signed-in
read to protect a credential that is already short-lived and that the client
discards on sign-out.

## References

- https://docs.convex.dev/auth/functions-auth
- `@convex-dev/better-auth` `plugins/convex`: the default token lifetime of
  15 minutes (`jwtExpirationSeconds`), which Nakafa does not override.
- `better-auth` `oauth2/utils` (`setTokenUtil`, `decryptOAuthToken`) and
  `plugins/jwt/utils` (`createJwk`): the encryption of stored provider tokens
  and signing keys.
- `better-auth` `api/routes/sign-in` and `api/routes/account` (`link-social`):
  the ID token branches that `disableIdTokenSignIn` closes.
- `better-auth` `context/create-context` and `cookies`: the secret list, and
  the cookie signature that a rotation invalidates.
- `better-auth` `plugins/bearer` and `@convex-dev/better-auth` `plugins/convex`:
  the hook that accepts a session token in an `Authorization` header.
