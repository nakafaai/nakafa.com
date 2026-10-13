# ADR 0009: Token-Verified Reads, Session-Validated Writes, And School Sign-In

## Decision

The session middleware resolves one caller identity per Convex function and
provides it as `Session`: the Better Auth user id and the matching app user.
How it gets the Better Auth user id depends on the function type.

- Queries read the identity Convex already verified from the Better Auth token
  (`Auth.getUserIdentity`) and look up the app user by its `authId` index. They
  never call the Better Auth component.
- For mutations and actions the middleware also confirms, before they write,
  that the token's session still exists, has not expired and belongs to the
  token's user, and that the user still exists. One read answers this:
  `session.live`, a query of the Better Auth component that reads the two rows
  by their ids and imports no Better Auth code. A verified token that does not
  name its session fails the write with `AuthReadError`: Better Auth puts the
  session in every token it issues, so the claim is never simply absent.
- `prepareCurrentAccountDeletion` runs without the middleware and reads the
  signed-in Better Auth user through the adapter (`getAuthUser`), as it did
  before.

`getCurrentUser` projects the account profile (name, email, image) from the app
user row. Better Auth's user triggers and the rename mutation keep those fields
current in the same transaction as the Better Auth write.

## Consequences

- A revoked or signed-out session can still read for the rest of its token's
  lifetime, which the Convex plugin sets to 15 minutes. Writes stop at once.
- Signed-in queries skip the Better Auth component. Production measured
  `getCurrentUser` at about one second at the median while it asked Better Auth
  through `safeGetAuthUser`, and every signed-in page waits on it before
  identity settles.
- A write pays one small component read. `safeGetAuthUser` answered the same
  question with two lookups through Better Auth's adapter. Measured on 12
  October 2026: the adapter's module bundles to 2,830 KiB in 1,438 modules and
  `session.live` to 56 KiB in 33 (the Convex CLI's bundler options); production
  ran one adapter lookup in 327 to 615 ms, and `nina/turns:start`, which reads
  23 rows, took 1,034 to 1,201 ms with two of them.
- Account state that must take effect immediately for reads, such as deletion,
  lives on the app user row, which every query reads.

## Stored Secrets

### Provider tokens

Nakafa stores no token that Google issues at sign-in. Nothing reads one after
sign-in (the Search Console scripts use their own service account), and a token
that nothing reads only widens what a leaked database or a leaked secret
exposes. A token for a connector that a learner links later belongs in the
vault, sealed under that learner's key, never on the account.

- Sign-in sends `prompt=select_account`, so a learner with several Google
  accounts still picks one. It sends no `access_type`, which Google reads as
  `online` and answers with no refresh token. It no longer sends the `consent`
  prompt, which showed Google's consent screen at every sign-in. Google still
  returns an access token and an ID token at the code exchange, and Better Auth
  reads the profile from the ID token.
- Two Better Auth database hooks (`confect/auth/tokens.ts`) set the access,
  refresh and ID tokens and their expiry times to `undefined` before every
  write to `account`. Better Auth merges what a hook returns over the data it
  writes, so a column left out of the result would still be written. The
  adapter leaves an `undefined` column out of the write. Sign-up, an implicit
  link, a link through the callback, the update at each sign-in and a token
  refresh all write through Better Auth's internal adapter, which runs the
  hooks, so one rule covers every path. The one place outside the table that
  could hold the tokens, the account cookie, is off, because Better Auth turns
  it on only when no database is configured.
- `/get-access-token`, `/account-info` and `/refresh-token`, the routes that
  read or refresh a stored token, answer 404 like the retired credential
  routes.
- `account.encryptOAuthTokens` stays on, so that a token that a later plugin
  writes is sealed.

### Clearing the tokens already stored

The hooks never touch a row they do not write, so every account written before
them still holds the tokens, sealed except for the ID token. The temporary
mutation `tokens:clearPage` of the Better Auth component removes the five
columns from them, one page of accounts a call, and leaves every other row and
column alone. With `dry` set it only counts. It runs on dev and then on
production with `convex run --component betterAuth tokens:clearPage`, on
production only after the release with the hooks is live. Clearing removes
Nakafa's copy. A refresh token that Google issued earlier is not revoked by it.

Owner: this ADR. Exit: a dry pass over every account on dev and on production
finds no row that holds a token. Cleanup: the change that records the
production result deletes the mutation and its test. The columns stay in the
schema, because Better Auth generates the table, and stay unset.

### Signing keys and the session token

Better Auth seals the private half of each signing key in `jwks`, also in the
static `JWKS` value, with the Better Auth secret. It stores the session token as
issued. The session token signs a learner in: the bearer hook that the Convex
plugin installs accepts it in an `Authorization` header, and Better Auth has no
option to seal it. Rotating the secret signs every learner out. List the new
secret first in `BETTER_AUTH_SECRETS`, keep `BETTER_AUTH_SECRET` at its old
value, and keep each older version listed while anything is still sealed with
it.

Planned for program wave A: sign-in stops storing Google tokens on the account.
The rows that hold them are counted on dev first, then cleared in the same
release that stops storing them. Connector tokens never sit on the account. They
are sealed in the vault (`confect/vault`) under the key of the connection's
owner: the learner's key for a personal connection, and the school's key for a
school connection.

## School Sign-In

Program wave A, the first delivery wave of the School program, changes how
school members sign in. Each path below is planned unless it says live. Every
path ends in the Better Auth session that the rest of this ADR checks.

- **Google.** Google sign-in covers a school's Workspace account and belajar.id
  accounts. The sign-in checks the hosted domain claim (`hd`) against the
  school's allowed email domains. A school account is matched by its Google
  issuer and subject, never by its email address. Google sign-in is live today.
  The school host, the domain check, and the belajar.id match are planned.
- **Username.** A school issues a username that is unique within the school. It
  is stored in the school's login table and maps to a Better Auth username that
  is unique worldwide and created automatically. Username sign-in works on the
  school's host only. That path is switched off on main, so it needs a test
  before it opens. A school username is a login name only, never a public
  profile handle (K15).
- **Login card.** A card carries a 10-character Crockford base32 code, without
  the letters I, L, O, and U. Nakafa stores only a keyed hash of the code. A code
  is single use, expires after 14 days, and is rate limited by the existing
  rate-limit component. The QR code on the card holds only the code. A teacher or
  an admin prints a card again, which voids the old code and writes a journal
  entry. A code is shown with dashes and accepted with or without them.
- **Parent.** A parent signs in with an email code: six digits, valid for five
  minutes, void after three wrong tries, and stored as a keyed hash (an HMAC
  under a server secret, like the login-card code), because six digits have
  only a million values and a plain digest would give the code to anyone who
  reads the row. Better Auth's `emailOTP` plugin keeps codes in plain text by
  default, so Nakafa stores its own keyed hash. `confect/emails` sends the code. Signing in is not consent for a
  child (K2). Consent is recorded with a second check, and ADR 0012 defines the
  verified parent relation.
- **Microsoft Entra ID and SAML.** These come after Google, for the schools that
  ask for them.

A learner under 18 whose Workspace account is blocked until a Workspace admin
marks Nakafa as trusted signs in with a login card. The status name that Google
shows for that block comes from third-party documentation and is not yet tested
on a Workspace account.

## Rejected Alternatives

Validating the session inside every query closes the read window after
revocation, but it adds a Better Auth component read to every signed-in read to
protect a credential that is already short-lived and that the client discards
on sign-out.

Confirming a write through `safeGetAuthUser` gives the same answer as
`session.live` for a token Better Auth issued, at the cost above. It also does
not compare the session's user with the token's, which `session.live` does.

Turning off `account.updateAccountOnSignIn` stops the update at each sign-in,
but not the writes at sign-up and at a link, and it stops the granted scopes
from following Google. The hooks cover every write with one rule.

Clearing the stored tokens from the app through the component's `updateOne`
would write `null` instead of removing the columns, and would cost one
component call for each row.

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
- `better-auth` 1.6.33, `dist/db/with-hooks` (`createWithHooks` line 7,
  `updateWithHooks` line 44): a hook's `data` is merged over the data to write.
  `dist/db/internal-adapter` (`createOAuthUser` 75, `createAccount` 102,
  `linkAccount` 509, `updateAccount` 577) runs the hooks for every account
  write. Its callers are `oauth2/link-account` (lines 31, 64, 97),
  `api/routes/callback` (114, 115) and `api/routes/account` (185, 315, 456).
  `dist/context/create-context` reads the hooks from `options.databaseHooks`
  (line 198) and turns `storeAccountCookie` on only without a database (line
  54).
- `@better-auth/core` 1.6.33, `dist/db/adapter/factory` (`transformInput`, lines
  115 and 141): the adapter leaves an `undefined` column out of the write.
- `better-auth` `dist/api/routes/account`: the routes that read a stored token,
  `/get-access-token` (line 344), `/refresh-token` (381) and `/account-info`
  (484), and `getValidAccessToken` (284) that two of them share.
  `dist/api/index` (lines 166 to 168) answers a disabled path with 404.
- `@better-auth/core` 1.6.33, `dist/social-providers/google` (lines 45 to 73)
  and `dist/oauth2/create-authorization-url` (lines 15 and 17): `prompt` and
  `access_type` reach Google only when set. `getUserInfo` (line 105) reads the
  profile from the ID token of the code exchange.
- https://developers.google.com/identity/protocols/oauth2/web-server: the
  default `access_type` is `online`, `prompt=consent` asks for consent and
  `prompt=select_account` shows the account chooser, and a request without
  `prompt` asks the learner only the first time.
- https://developers.google.com/identity/openid-connect/openid-connect: the
  token response holds a `refresh_token` only when `access_type` is `offline`.
