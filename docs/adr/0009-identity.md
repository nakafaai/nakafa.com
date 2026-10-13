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

Planned for program wave A: sign-in stops storing Google tokens on the account.
The rows that hold them are counted on dev first, then cleared in the same
release that stops storing them. Connector tokens never sit on the account. They
are sealed in the vault (`confect/vault`) under the key of the connection's
owner: the learner's key for a personal connection, and the school's key for a
school connection.

## School Sign-In

Program wave A, the first delivery wave of the School program, changes how
school members sign in. Each path below is planned unless it says live. Every
path ends in the Better Auth session that the rest of this ADR checks. The
username, the login card, and the parent code are served on the school host
only, each at its own address (ADR 0026).

- **Google.** Google sign-in covers a school's Workspace account and belajar.id
  accounts. When the school has set allowed email domains, the sign-in checks the
  hosted domain claim (`hd`) against them, and an empty list restricts nothing
  (ADR 0011). A school account is matched by its Google issuer and subject, never
  by its email address. The one exception is an invite claim (ADR 0011), which
  matches the verified email of an account to the address of an invite once, to
  bind a Person. Google sign-in is live today. The school host, the domain
  check, and the belajar.id match are planned.
- **Username.** A school issues a username that is unique within the school. It
  is stored in the school's login table and maps to a Better Auth username that
  is unique within the cell, because each cell holds its own Better Auth rows
  (ADR 0026), and is created automatically. A username signs in with a password.
  The student sets the password when redeeming a login card (below), and the
  password is the daily credential. Better Auth's `/sign-in/username` endpoint
  finds a user by username among every user of the deployment and has no host
  check, so it is switched off on main and stays off on every host. Username
  sign-in is served only by an endpoint of the school host, never by the generic
  endpoint on `nakafa.com`, and that endpoint needs a test before it opens. A
  username account has an address in the reserved `.invalid` domain (RFC 2606)
  that never receives mail, and every sender refuses that domain. Its Person is
  bound by the card claim (claim method `card`). A school username is a login
  name only, never a public profile handle (K15).
- **Login card.** A card is a one-time setup secret, not a daily credential. It
  carries a 10-character Crockford base32 code, without the letters I, L, O, and
  U, and the school's host beside the code, such as `harapan.nakafa.com`.
  Nakafa stores only a keyed hash of the code. A code is single use, expires
  after 14 days, and is rate limited by the existing rate-limit component. The QR
  code on the card holds only the code. A student redeems the code on the card
  page of the school host (`/kartu`, ADR 0026). No other host accepts a card
  code, so a card typed at `nakafa.com` finds nothing. Redeeming creates the
  username account, runs the card claim, and asks the student to set a password.
  A teacher or an admin prints a card again, which voids the old code and writes
  a journal entry, and redeeming the new card lets the student set a new
  password. A card is an invite on the card channel, so the rules of ADR 0011
  apply to it, including who may print one for a Person who holds the Owner or
  Admin role. A code is shown with dashes and accepted with or without them.
- **Parent.** A parent signs in with an email code: six digits, valid for five
  minutes, void after three wrong tries, and stored as a keyed hash (an HMAC
  under a server secret, like the login-card code), because six digits have
  only a million values and a plain digest would give the code to anyone who
  reads the row. Better Auth's `emailOTP` plugin keeps codes in plain text by
  default, so Nakafa stores its own keyed hash. `confect/emails` sends the code.
  The parent enters it on the code entry page of the school host
  (`/orang-tua`, ADR 0026), the only page that accepts it. It is the one code
  that an email carries (ADR 0027): it lives five minutes, rests as a keyed hash,
  and is useless without that page. Signing in is not consent for a child (K2).
  Consent is recorded with a second check, and ADR 0012 defines the verified
  parent relation.
- **Microsoft Entra ID and SAML.** These come after Google, for the schools that
  ask for them.

A learner under 18 whose Workspace account is blocked until a Workspace admin
marks Nakafa as trusted redeems a login card once, sets a password, and then
signs in with the username and that password. The status name that Google shows
for that block comes from third-party documentation and is not yet tested on a
Workspace account.

## Rejected Alternatives

Validating the session inside every query closes the read window after
revocation, but it adds a Better Auth component read to every signed-in read to
protect a credential that is already short-lived and that the client discards
on sign-out.

Confirming a write through `safeGetAuthUser` gives the same answer as
`session.live` for a token Better Auth issued, at the cost above. It also does
not compare the session's user with the token's, which `session.live` does.

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
- `better-auth` `plugins/username`: the sign-in endpoint takes a username and a
  password, finds the user by username among every user of the deployment, and
  has no host check. The same plugin keeps a username unique within one
  deployment, which is why a school username maps to a Better Auth username that
  is unique per cell.
- RFC 2606, section 2: `.invalid` is a reserved top-level domain whose names are
  sure to be invalid, so mail to an address in it never arrives.
