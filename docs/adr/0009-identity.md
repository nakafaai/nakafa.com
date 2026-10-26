# ADR 0009: Token-Verified Reads, Session-Validated Writes, And School Sign-In

> Superseded in part by [ADR 0037](0037-cloudflare.md) and [ADR 0036](0036-boundary.md): the hosting and framework statements of this record describe the earlier stack. Cloudflare Workers through Alchemy and the TanStack Start boundary replace them.

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
exposes. A connector token never sits on the account either. It is sealed in
the vault (`confect/vault`) under the key of the connection's owner: the
learner's key for a personal connection, and the school's key for a school
connection.

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
  read or refresh a stored token (`confect/auth/routes.ts`), answer 404 like the
  retired credential routes, and the API reference leaves them out. Better Auth
  checks `disabledPaths` in the HTTP router only, and `auth.api` runs an
  endpoint without that check. A server call that sends no headers and names a
  `userId` is taken to speak for that learner, so a before hook of a plugin
  refuses the same three routes with 404 for server code too. Without it, such
  a call would return a token that an older sign-in stored, until the clearing
  below has run.
- `disableIdTokenSignIn` stays on. With it off, Better Auth would accept any
  Google ID token that was issued to Nakafa in the last hour as a credential, to
  sign a learner in and to link an account. Only the redirect flow signs a
  learner in.
- `account.encryptOAuthTokens` stays on, so that a token that a later plugin
  writes is sealed.

### Clearing the tokens already stored

The hooks never touch a row they do not write, so every account written before
them held the tokens, sealed except for the ID token. A temporary internal
mutation of the Better Auth component (#1052) removed the five columns from
those rows, one page of accounts a call, and left every other row and column
alone. On 14 October 2026, after the release with the hooks was live, it found
1 account holding a token on dev and 734 of 734 on production, cleared them,
and a dry pass after it found none on either. The cleanup change deleted the
mutation and its test. Clearing removed Nakafa's copy; a refresh token that
Google issued earlier is not revoked by it. The columns stay in the schema,
because Better Auth generates the table, and stay unset.

### Signing keys and the session token

Better Auth seals the private half of each signing key in `jwks`, also in the
static `JWKS` value, with the Better Auth secret. It stores the session token as
issued. The session token signs a learner in: the bearer hook that the Convex
plugin installs accepts it in an `Authorization` header, and Better Auth has no
option to seal it. Rotating the secret signs every learner out. List the new
secret first in `BETTER_AUTH_SECRETS`, keep `BETTER_AUTH_SECRET` at its old
value, and keep each older version listed while anything is still sealed with
it.

## The Shared Session Cookie

Nakafa and every school host of the `us` cell share one session cookie. Better
Auth sets it with a `Domain` attribute that is the host of `SITE_URL`
(`advanced.crossSubDomainCookies`, Better Auth 1.6.33, `cookies/index.mjs`). The
name stays `better-auth.session_token`, with the `__Secure-` prefix on HTTPS,
because the app sets no cookie name or prefix of its own, and ADR 0026 rejects a
session cookie named for each cell.

Before school hosts, the cookie had no `Domain` attribute. A browser that still
holds that older host-only cookie sends it next to the shared one under the same
name, and the two readers pick different values:

- The identity route (`get-session` and `sign-out`) reads the first value of a
  name (better-call `parseCookies`, which skips a name it already has). The
  browser sends the older cookie first (RFC 6265 section 5.4), so the identity
  route reads the older host-only cookie.
- The presence check of the app (`getSessionCookie` in `cookies/index.mjs`,
  which parses with `cookie-utils.mjs`) reads the last value.

A response that sets or clears the shared cookie also expires the older host-only
cookie of the host that answered, when the shared cookie reaches that host
(`packages/backend/confect/auth/host.ts`). The shared cookie reaches the site's
own host and, when its domain has a dot, every subdomain of that domain. A
response from a host that the shared cookie does not reach leaves that host's
cookie alone. The expiry has no `Domain` attribute, so it reaches only the host
that answered. The expiry comes before the shared cookie in the response, because
a browser that stores both as one cookie, as Chromium does for `localhost`, must
keep the shared one.

The pair would form if a school host wrote the shared cookie while an older
host-only cookie existed. The browser would send the older cookie first, and the
identity route reads the first value, so the main site would serve the older
session. No flow of this change does that, since the Google callback runs on the
main site. A school sign-in endpoint must not write the shared cookie while an
older host-only cookie can exist: it must end on the main site, where a response
that sets the shared cookie expires that older cookie.

A session that exists only as the older cookie keeps working on the main site
until its next refresh or sign-in, and it shows as signed out on a school host
until then. A rollback to the build before this change has one known effect: a
sign-out in that build clears only its own host-only cookie, so the shared
cookie can still identify a valid session until that session expires.

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
  password. A card is not an invite row (ADR 0011), but the same rules apply to
  it: a card never goes to a Person who holds the Owner or Admin role, and it goes
  only to a Person with no account yet or with an account that a card made. A code
  is shown with dashes and accepted with or without them. A typed code reads O as 0
  and I or L as 1, as Crockford base32 does, and U is refused.
- **Parent.** A parent signs in with an email code: six digits, valid for five
  minutes, void after three wrong tries, and stored as a keyed hash (an HMAC
  under a server secret, like the login-card code, with its own purpose label,
  `guardian-code`, ADR 0034), because six digits have only a million values and
  a plain digest would give the code to anyone who reads the row. Better Auth's `emailOTP` plugin keeps codes in plain text by
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

### As built: login cards and the password store

`confect/identity` builds the login card, the school login, the password store,
and the placeholder address. The school host's username sign-in is built on that
host alone (`auth/login`), and the card code is typed on the school's entry page
for now, not yet on the card page of `/kartu`. The Workspace domain check is not
built yet.

- **Password store.** `emailAndPassword` is enabled only as the store of school
  passwords, with `disableSignUp`, so Better Auth refuses a public sign-up even
  from server code. Sign-in with an email and a password is closed on every host:
  the router answers 404 (`disabledPaths`), and server code gets the same refusal
  from `auth/routes`, because `auth.api` runs an endpoint without the router's
  check. Sign-in with a school username is served on the school host alone, and a
  server call to it is refused, because a server call names no host.
  The minimum length is Better Auth's default, 8 (`context/create-context`). A
  password reset ends the sessions it replaces (`revokeSessionsOnPasswordReset`).
- **Username.** The `username` plugin holds the global username of the account,
  under the rule of `users/username.ts`, so the Better Auth username and
  `users.username` are one value. A rename changes both in one transaction
  (`auth/username`, which changes only an account that holds a Better Auth
  username). `update-user` refuses a username field (`usernameUpdatesDisabled`),
  so the app's rename is the only writer. `/is-username-available` stays closed,
  because it would tell any visitor which usernames exist. `/sign-in/username`
  answers on a school host only: the school login name it reads maps to the
  account's username (`usernameOf`), and a name that is not a login of that school
  is refused with the same error as a wrong password.
- **Login name.** A school login name is 3 to 32 characters of lowercase letters,
  digits, dots, underscores, and hyphens, unique within its school. It refuses
  the names that could pass for Nakafa, the one list in `users/reserved.ts` that
  a username also refuses. It does not refuse a route word, because a login is
  never a URL.
- **Login card.** `loginCards` keeps one row per Person: the HMAC-SHA-256 of the
  canonical code under `LOGIN_CARD_SECRET`, read through `Config` and never
  printed or stored (declared in `convex/convex.config.ts`, so Convex refuses a
  push to a deployment without it), its issuer, its dates, and `redeemedAt`. The code has ten
  characters of Crockford base32. It is drawn from Effect's `Crypto` service,
  because the default `Random` is not secure. A card works for `CARD_TERM`, 14
  days. Issuing or reissuing replaces the row, so the old code matches nothing.
  `card.issue` is an Admin's right. A card never goes to a Person who holds the
  Owner or Admin role: issuing or reissuing for one answers `CardRoleRefused`, and
  redeeming a card for one reads as `invalid`. `cardRefusalOf` (`identity/card`)
  is the one rule that issue, reissue, and redeem all call. A card goes only to a
  Person with no account or with an account a card made. Issuing for any other
  Person answers `PersonClaimed`, the refusal an invite gives, and redeeming a card
  for one reads as `invalid`.
- **Redeem.** `identity/cards:redeem` is one mutation, in this order: it
  refuses a request that carries a signed-in identity as `invalid` before any
  limit is spent, counts the attempt against the device limit, reads the code and
  the typed login name, which must be the card's own (`invalid`, before `used`
  and `expired`), reads the Person and refuses one that is removed or that the card rule
  refuses (the Owner or Admin role, or an account that a card did not make) as
  `invalid` whatever the card says, opens the card on the school's host (`used`,
  then `expired`), refuses a password outside Better Auth's length before any
  write, creates the account if the Person has none (the global username from
  `users/allocation`, the placeholder address named by a random key, no Google
  link), binds the Person with method `card`, stores the password through Better
  Auth's reset endpoint, marks the card used, and journals `card.redeemed` with
  the Person and the card. A reissue keeps the card's row, so the `card.issued`
  or `card.reissued` entry before it in journal order names the printing that
  was redeemed. A refusal is a value, so the attempt still counts.
  A failure that throws rolls back the whole mutation, so an account, a claim,
  or a redemption never survives without the others. A card whose Person has no
  school login cannot exist: issuing writes the login first and nothing deletes
  one, so the login is a required read, and a broken row fails the mutation.
- **Rate limits.** Per device (the UUID the sign-in page keeps): five attempts at
  once, then five more every 15 minutes. These are design choices, not
  measurements. Every attempt counts against it. A code is 50 bits, ten characters
  of five bits each, so guessing one takes about 2^49, or 5.6 x 10^14, tries on
  average. That figure is computed from the alphabet, not measured. A bucket shared
  by every device would add no protection against that guessing, and it would let
  one person block another's card, so there is no limit per code prefix.
- **Username attempts.** Per school login, on the school host: ten sign-in attempts
  at once, then ten more every 15 minutes. The count belongs to the account that the
  login names, so one login's attempts never refuse another login. An attempt takes
  one before the password is checked, so parallel guesses cannot all pass a limit
  that none of them has reached. A successful sign-in clears the count, so a success
  never counts against the login. A refused attempt answers the same 401 as a wrong
  password, whether or not the limit refused it, so the answer reveals nothing about
  a login name. These are design choices, not measurements.
- **Placeholder address.** An account made from a school login holds
  `<random key>@login.nakafa.invalid`, where the key is a random UUID drawn for that
  account, so the address names no one. The Convex adapter writes the Better Auth
  id itself, so the id is not known before the write. The handle is allocated from
  the Person's name, as it is for every account. `identity/address` owns the domain.
  `emails/client` refuses a message to it before the provider is called, in any
  recipient field and in any written form of the address. No welcome intent and
  no payment customer is made for it, on creation or on a profile change, and an
  invitation to it sends nothing. The address is an internal key, not personal
  data, and RFC 2606 keeps mail from ever reaching it.

## Usernames And Profiles

A profile lives at `/{locale}/@username`. The username belongs to the app user
row (`users.username`, with the index `by_username`). It is the only namespace
of profile names, and it is no credential: a password or a Google sign-in is.
The Better Auth username plugin holds this same value for school accounts, and
never a second one.

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
  `apps/www/src` and fails when a root that could be a username is not
  reserved.
- A new account gets its username in the transaction that makes the row: the
  letters and digits of its name, then the name with 2 up to 9, then the name
  with a random number from `Random` that has two digits and gains a digit
  after two collisions, up to eight digits. A name with no Latin letter to start
  from, or a reserved one such as `nakafa` or `admin`, becomes `teman`, so no
  handle is built on a reserved base. Each try is one indexed read, and the
  write follows inside one Convex transaction, so two accounts that ask for the
  same name cannot both win. The tries are a fixed list, so one allocation reads
  at most `MAX_ALLOCATION_TRIES` rows however many accounts share a name. An
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

A profile is not for a school member and not for an account under 18 (owner
decision K15 of 13 October 2026, restated in the School blueprint revision 11 of
24 October). Since 17 October anyone opens and shares a learner's profile
(#1113), and K15 narrows that rule as far as the stored data can.

- The profile of an account that belongs to no school is public: anyone, signed in
  or not, reads its name, bio, picture, posts and comments, and shares its address.
- The profile of a school member opens for its own account alone. An account
  belongs to a school while it holds an active or a suspended member Person in any
  tenant (`belongsToSchool` in `confect/tenancy/members.ts`, read through
  `by_account_userId_and_kind_and_status`); a removed member and an operator Person
  do not count. Every other request, signed in or not, ends as not found with a 404,
  the same as for a username nobody holds, so the address never tells whether a
  school member holds a username. Its own account sees no Share profile button, and
  neither does anyone else, because nobody else reaches the page.
- One rule decides all three reads: `profileAccess` in `confect/users/profile.ts`.
  `users/queries:getProfileByUsername` answers null to a caller that may not open the
  profile, and its `shareable` field says whether the page shows Share profile;
  `posts/queries:list` and `comments/queries:getCommentsByUserId` answer the empty
  page of an author without posts or comments. `readProfileOrNotFound` in
  `apps/www/src/lib/account/access.server.ts` passes the request's session to the
  profile query and ends the request as not found before the page streams.
- The Chat tab of any profile opens for its own account alone. (The availability
  check and a refused rename tell whether a username is taken, because a person who
  picks a name must be told so; both answer only a signed-in account, and a
  visitor's check is refused with `SessionRequired`.)
- The under-18 part of K15 cannot be enforced yet: the product stores no age, so no
  field, consent, or sign-in step records one. When an age is stored, an account
  under 18 joins the school member's rule in `profileAccess`, and this section
  changes with it.
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

### Naming The Accounts Made Before

Accounts made before this decision got their usernames from a temporary
migration, which named 1 account on dev and 729 accounts on production on 14
October 2026, and was then deleted with its tests and bindings. The schema keeps
`username` optional, because a deleted account holds none.

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

A public query of a profile by username, closed by a rule, was rejected until an
age is stored. With no age, the rule would answer not found for every account
but the caller's own, which `getCurrentUser` already gives, so the query would
repeat it.

## References

- https://docs.convex.dev/auth/functions-auth
- https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites
  and `apps/www/src/lib/profile/rewrite.ts`: the router path that serves the
  `@username` address.
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
  `resolveUserId` (265 to 274) takes the `userId` of the call when it carries no
  headers and no session. `dist/api/index` (lines 166 to 168) answers a disabled
  path with 404, and `dist/plugins/open-api/generator` (lines 426 and 474)
  leaves it out of the API reference.
- `better-auth` 1.6.33, `dist/auth/base` (line 9) and `dist/api/index` (line
  114): `auth.api` and the router are built from the same endpoints, and
  `dist/api/to-auth-endpoints` (line 34) wraps each one in the hook pipeline of
  `dist/api/dispatch`. `getHooks` (line 137) collects the before hooks of every
  plugin, `dispatchAuthEndpoint` (186 and 210) runs them for a router request
  and for an `auth.api` call alike, and a hook that rejects ends the call. Only
  the router checks `disabledPaths`.
- `convex` 1.46.0, `browser/http_client` (`setAdminAuth`, line 167) and the CLI
  `run` command (`runFunctionAndLog`, line 121210 of `dist/cli.bundle.cjs`): the
  admin key may call internal queries, mutations and actions, and `run` sends it
  with the component path of `--component`.
- https://docs.convex.dev/components/authoring: a component exposes only its
  public functions to the app, and `npx convex run` and the dashboard run public
  and internal functions alike.
- `@better-auth/core` 1.6.33, `dist/social-providers/google` (lines 45 to 73)
  and `dist/oauth2/create-authorization-url` (lines 15 and 17): `prompt` and
  `access_type` reach Google only when set. `getUserInfo` (line 105) reads the
  profile from the ID token of the code exchange, and `verifyIdToken` (line 95)
  refuses every ID token when `disableIdTokenSignIn` is set.
- https://developers.google.com/identity/protocols/oauth2/web-server: the
  default `access_type` is `online`, `prompt=consent` asks for consent and
  `prompt=select_account` shows the account chooser, and a request without
  `prompt` asks the learner only the first time.
- https://developers.google.com/identity/openid-connect/openid-connect: the
  token response holds a `refresh_token` only when `access_type` is `offline`.
- `better-auth` `plugins/username`: the sign-in endpoint takes a username and a
  password, finds the user by username among every user of the deployment, and
  has no host check. The same plugin keeps a username unique within one
  deployment, which is why a school username maps to a Better Auth username that
  is unique per cell.
- RFC 2606, section 2: `.invalid` is a reserved top-level domain whose names are
  sure to be invalid, so mail to an address in it never arrives.
