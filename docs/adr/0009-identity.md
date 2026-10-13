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

## Usernames And Profiles

A profile lives at `/{locale}/@username`. The username belongs to the app user
row (`users.username`, with the index `by_username`), not to Better Auth,
because sign-in is Google only and a username is no credential. It is the only
namespace of profile names. If the Better Auth username plugin is ever enabled,
for School accounts, it must hold this value and never a second one.

- A live account holds exactly one username. A deleted account keeps none: the
  tombstone removes the username and the bio, which frees the name at once, so
  the field is optional in the schema. A rename frees the old name the moment
  the new one is stored.
- The text is three to twenty characters of lowercase letters, digits, and
  underscores, and starts with a letter. A dot is not allowed, because the site
  answers addresses that end in `.md`, `.png`, or `.og` for the Markdown and
  image versions of a page. Capitals are accepted and stored as lowercase.
- A bio is one line of at most 160 characters: every run of white space becomes
  one space and the ends are trimmed. A character is a Unicode code point, so an
  emoji counts once, and whatever shows a count beside the field counts the
  same way.
- A name is refused when it is a route (every root in
  `@repo/contents/route/root`, every namespace of a public route surface, and
  the few roots that answer outside the route tree) or could pass for Nakafa,
  its people, or its help (`users/reserved.ts`). A test reads the route tree of
  `apps/www/app` and fails when a root that could be a username is not
  reserved.
- A new account gets its username in the transaction that makes the row: the
  letters and digits of its name, then the name with 2 up to 9, then the name
  with a random number from `Random` that has two digits and gains a digit
  after two collisions, up to eight digits. A name with no Latin letter becomes
  `teman`. Each try is one indexed read, and the write follows inside one
  Convex transaction, so two accounts that ask for the same name cannot both
  win. The tries are a fixed list, so one allocation reads at most
  `MAX_ALLOCATION_TRIES` rows however many accounts share a name. An
  allocation that finds every try taken dies with `UsernameExhausted`. A rename
  uses the same check, and the same check answers while a person types.
- A folder named `@username` would be a parallel route slot and not an address,
  so `next.config.ts` rewrites `/{locale}/@username` (and its `chat` tab) to
  the route file `user/[username]`. Route ownership accepts nothing else below
  `user` than the settings pages.
- A profile is `noindex, nofollow`. It shows a name, a bio, and comments, and
  many learners are minors. It stays reachable by link, and `robots.txt` does
  not block it, so a crawler can read the rule.

### Who Opens A Profile

A profile is public only for an adult who belongs to no school (owner decision
K15 of 13 October 2026). The product stores no age: no field, consent, or
sign-in step records one, and age capture is not built. School membership is
stored (a claimed person in `tenantPeople`), but without an age it decides
nothing. So no profile is public yet.

- The account itself opens its profile, because that page holds its own chats
  and comments. Every other request, signed in or not, ends as not found, the
  same as for a username nobody holds, so the profile address never tells
  whether a username exists. (The availability check and a refused rename do,
  because a person who picks a name must be told that it is taken.)
  `readProfile` in `apps/www/lib/profile/server.ts` is the one place that
  decides, and it reads the signed-in account, so the backend holds no public
  lookup of a profile by username.
- A comment shows no link to the profile of its author.
- The retired address `/{locale}/user/{id}` and its `chat` tab answer 308 to the
  username address, and only to the account that holds the id: the proxy reads
  the session of the request, and any other request falls to route ownership
  and is not found, so the redirect never shows the username of an account to
  someone else. The id address is retired for good. The answer is permanent
  even though the username it names can change, so a browser that kept it after
  a rename lands on the old name, which is not found (or is the page of the
  account that holds the name now). A profile has no Markdown version, so a
  request for the retired address with `.md` or `.mdx` is not redirected and
  ends as not found, as it does for anyone else.
- When an age is stored, the rule becomes: the account is of age and holds no
  claimed person in `tenantPeople` (read through
  `by_account_userId_and_kind_and_status`). The profile then becomes a public
  query by username in the backend, the comment link and the retired address
  follow it, and this section changes with it.

### Naming The Accounts Made Before

Accounts made before this decision got their usernames from a temporary
migration (`users/migration:allocateUsernames`), the expand step. It reads one
page of accounts at a time after a cursor, oldest first, and a dry pass counts
the accounts that wait and writes nothing. Exit: it runs on dev and on
production, dry first, until a dry pass over every account finds none waiting.
Cleanup: delete the migration with its tests and bindings. The schema keeps
`username` optional, because a deleted account holds none, so the cleanup
changes no stored shape. Until a live account has its username, the account
menu shows no profile entry for it and its profile address is not found.

## Rejected Alternatives

Validating the session inside every query closes the read window after
revocation, but it adds a Better Auth component read to every signed-in read to
protect a credential that is already short-lived and that the client discards
on sign-out.

Confirming a write through `safeGetAuthUser` gives the same answer as
`session.live` for a token Better Auth issued, at the cost above. It also does
not compare the session's user with the token's, which `session.live` does.

A public query of a profile by username, closed by a rule, was rejected until an
age is stored. With no age, the rule would answer not found for every account
but the caller's own, which `getCurrentUser` already gives, so the query would
repeat it.

## References

- https://docs.convex.dev/auth/functions-auth
- https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes
  and https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites:
  why a folder named `@username` is not an address, and the rewrite that serves
  it.
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
