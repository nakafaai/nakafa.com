# ADR 0009: Convex Auth Sessions, Checked On Every Call, And School Sign-In

> Superseded in part by [ADR 0037](0037-cloudflare.md) and [ADR 0036](0036-boundary.md): the hosting and framework statements of this record describe the earlier stack. Cloudflare Workers through Alchemy and the TanStack Start boundary replace them.

## Decision

Nakafa signs people in with Convex Auth 2.0.0, whose components run inside the
deployment, and with nothing else. `packages/backend/convex/convex.config.ts`
mounts its core (`auth`: sessions and refresh tokens), Google (`authGoogle`,
served under `/oauth/google`), and the username and password methods
(`authUsername`, `authPassword`). `confect/auth/core.ts` sets them up and is the
one owner of the session rules:

- An access token lives 15 minutes, a session ends after 7 days without use,
  and no session lasts longer than 90 days.
- The deployment signs every access token with its own key
  (`ctx.auth.signJwt`, ES256), so no signing key or auth secret is configured,
  stored, or rotated by Nakafa. `confect/auth.ts` accepts these tokens
  (`convexAuthProvider`) and the agent tokens of ADR 0029, whose issuer is the
  deployment's own address.
- An access token's subject is its session. The session middleware
  (`confect/middleware/session.impl.ts`) resolves the caller once per function
  through `confect/auth/caller.ts`: an agent token names its grant, and every
  other token is a Convex Auth session whose row says whose it is
  (`getAuthUserId`). Queries, mutations and actions all read that row, so a
  session that signed out or was revoked stops reading and writing at once,
  not at its token's expiry. `Session` then carries the user id and the app
  user row, which every function reads for account state such as `deletedAt`.

The web app keeps the refresh token where no script reaches it. Its routes
`/api/auth/signin`, `/api/auth/refresh` and `/api/auth/signout`
(`apps/www/src/lib/auth/server.server.ts`, Convex Auth's
`setupConvexAuthServer`) hold the refresh token in an httpOnly cookie and hand
the browser only the access token. The sign-in route forwards exactly two
functions, Google's completion and the school login, and refuses every other.
The page's client (`apps/www/src/lib/auth/client.ts`, Convex Auth's
`AuthClient` in its SSR mode) refreshes through the refresh route, and the
server reads a request's session from the same cookies
(`apps/www/src/lib/auth/session.server.ts`).

## Consequences

- Signing out or revoking a session ends every read and write of it at once.
  The earlier design let a revoked session read for the rest of its token's
  15 minutes.
- Every signed-in function pays one small component query for the session row.
  The earlier design read a second system's component on every write and
  measured 327 to 615 ms for one adapter lookup on production; the before and
  after numbers of the cutover are recorded under Moving To Convex Auth.
- A refresh that cannot reach the route fails and is tried again; it never reads
  as signed out (`apps/www/src/lib/auth/token.ts`, `followAuthSession`).
- Account state that must take effect immediately lives on the app user row,
  which every function reads.

## Stored Secrets

Nakafa stores no token that Google issues at sign-in. Convex Auth's Google
method keeps one row per Google account, its subject (`sub`) and the Nakafa
user it signs in (`authGoogle` `accounts`), and the short-lived state of a
sign-in that is under way. The sign-in asks for `openid email profile` with
PKCE (S256) and sends no `access_type`, which Google reads as `online` and
answers with no refresh token. A connector token never sits on the account: it
is sealed in the vault (`confect/vault`) under the key of the connection's
owner, the learner's key for a personal connection and the school's key for a
school connection.

A school password is stored only as an argon2id hash in the password component.
Convex Auth throttles password checks per account with a token bucket of 5
attempts that refills one attempt a minute. A refresh token is stored only as a
hash, and a spent one is remembered for an hour so a replay is detected.

## The Shared Session Cookie

Nakafa and every school host of the `us` cell share one session. The routes set
both cookies, `__convexAuthRefreshToken` (httpOnly) and `__convexAuthJWT`,
with `Domain=nakafa.com` on production, so a school host reads the session that
the main site wrote (ADR 0026). A route answers only a request whose `Origin`
is its own host.

Staging, `staging.nakafa.com`, is a subdomain of the production domain, so the
browser sends production's cookies there too. Staging names its own cookies
apart (`nakafa-dev.` before each name, `siteAuthCookies` in
`apps/www/src/lib/auth/cookies.ts`): its routes read only those, under Convex
Auth's names, and drop production's, so staging never reads a production
session as its own. A local site uses the plain names without a domain.

Every answer that starts or ends a session also sets the signed-in hint
(`withSessionHint`), so a static page knows at once whether to start the live
session.

## School Sign-In

Every path below ends in a Convex Auth session. The username, the login card,
and the parent's sign-in are served on the school host (ADR 0026).

- **Google.** Google sign-in covers a school's Workspace accounts, belajar.id
  accounts and personal accounts alike. A sign-in starts on the main site,
  which is the only address it may return to besides staging's
  (`allowedRedirectOrigins`), and Google returns through the deployment's
  `/oauth/google/callback` to the page that completes it. Nakafa's user
  callbacks (`confect/auth/account.ts`) decide what a Google identity is:
  - An identity without an address, or whose address Google did not verify, is
    refused (`GoogleAddressRefused`).
  - A new identity whose verified address a live account holds signs in to
    that account. Addresses are stored lowercase, so the match is exact. This
    is how every account made before Convex Auth keeps its id.
  - Any other new identity makes an account: a username, an animal, the plan's
    credits, the welcome email, and the claim of any invite that waits for its
    address (ADR 0011).
  - A deleted account cannot sign in again (`AccountDeleted`), and each sign-in
    binds the guardian Persons that a school linked to the address (ADR 0034).
  An invite claim matches the verified address to the invite's, and a school's
  email domains still decide which addresses it may invite and claim
  (`admitsAddress`, ADR 0011). The earlier check of the Google account's hosted
  domain (`hd`), which told a Workspace account from a personal account made on
  a school address, is gone, because Convex Auth's Google profile carries no
  `hd` claim; at the cutover no school had set a domain. It returns when
  upstream passes `hd` through (Moving To Convex Auth).
- **Username.** A school issues a login name that is unique within the school
  (`schoolLogins`). Convex Auth's username of a school account is the account's
  own id, which nobody types: `auth/school:signIn` resolves the school and the
  login name to the account a card made (`loginAccountOf`), and Convex Auth's
  password method checks the password and makes the session. A name that is not
  a login of that school, a wrong password, and a throttled attempt all answer
  the same refusal. Nobody signs up with a password: the password method's
  `createUser` refuses (`SchoolSignUpRefused`), because only a card makes a
  school account. A school account holds an address in the reserved `.invalid`
  domain (RFC 2606) that never receives mail. A login name is never a public
  profile handle (K15).
- **Login card.** A card is a one-time setup secret, not a daily credential. It
  carries a 10-character Crockford base32 code, without the letters I, L, O, and
  U, and the school's host beside the code, such as `harapan.nakafa.com`.
  Nakafa stores only a keyed hash of the code. A code is single use, expires
  after 14 days, and is rate limited. Redeeming it creates the account, runs the
  card claim, and sets the password the student chooses. A teacher or an admin
  prints a card again, which voids the old code, and redeeming the new card sets
  a new password and ends the account's sessions. A card never goes to a Person
  who holds the Owner or Admin role, and it goes only to a Person with no
  account yet or with an account that a card made.
- **Parent.** A parent signs in with Google. The school links the parent's
  address, and the parent's first sign-in with that verified address binds the
  guardian Person (claim method `address`, ADR 0034). Signing in is not consent
  for a child: the consent still waits for the NISN check or for staff.
- **Microsoft Entra ID and SAML.** These come after Google, for the schools that
  ask for them.

### As built: login cards and the password store

`confect/identity` builds the login card, the school login, and the placeholder
address; Convex Auth's password component is the password store.

- **Password store.** `setLoginPassword` (`identity/account.ts`) sets a school
  account's password through the password component, with Convex Auth's
  minimum length of 8, and ends every session of the account, so a reprinted
  card signs the old device out.
- **Login name.** A school login name is 3 to 32 characters of lowercase letters,
  digits, dots, underscores, and hyphens, unique within its school. It refuses
  the names that could pass for Nakafa, the one list in `users/reserved.ts` that
  a username also refuses.
- **Login card.** `loginCards` keeps one row per Person: the HMAC-SHA-256 of the
  canonical code under `LOGIN_CARD_SECRET`, read through `Config` and never
  printed or stored (declared in `convex/convex.config.ts`, so Convex refuses a
  push to a deployment without it), its issuer, its dates, and `redeemedAt`. The
  code is drawn from Effect's `SecureRandom` service. A card works for
  `CARD_TERM`, 14 days. Issuing or reissuing replaces the row, so the old code
  matches nothing. `cardRefusalOf` (`identity/card`) is the one rule that issue,
  reissue, and redeem all call.
- **Redeem.** `identity/cards:redeem` is one mutation: it refuses a signed-in
  caller, counts the attempt against the device limit, checks the code, the
  typed login name and the Person, creates the account if the Person has none
  (`createLoginAccount`: the placeholder address, a username, and the account's
  id as its Convex Auth username), binds the Person with method `card`, sets the
  password, marks the card used, and journals `card.redeemed`. A refusal is a
  value, so the attempt still counts, and a failure that throws rolls the whole
  mutation back.
- **Rate limits.** Per device (the UUID the sign-in page keeps): five card
  attempts at once, then five more every 15 minutes. A code is 50 bits, so
  guessing one takes about 2^49 tries on average, computed from the alphabet.
- **Placeholder address.** An account made from a school login holds
  `<random key>@login.nakafa.invalid`, where the key is a random UUID, so the
  address names no one. `identity/address` owns the domain. `emails/client`
  refuses a message to it before the provider is called. No welcome intent and
  no payment customer is made for it.

## Account Deletion

`auth/deletion:deleteAccount` deletes the signed-in account in one transaction:
every Convex Auth session of the account ends, its school username is freed,
and the account is marked deleted, so nothing reaches it from that commit on.
A scheduled finalize releases its Persons, writes the tombstone, and starts the
durable cleanup of its data (`confect/auth/deletion`).

Two rows outlive the account, because Convex Auth 2.0.0 offers no deletion of a
user's rows in its Google and password components: the Google account row (the
Google subject and the tombstone's id) and, for a school account, the password
hash. They are why a deleted account's Google sign-in is refused with
`AccountDeleted` rather than making a new account. GDPR note: a Google subject
is a stable pseudonymous identifier and therefore personal data under Article
4(1). It is kept only to refuse that sign-in and is erased by the deletion
workflow as soon as the components can delete by user; the hash cannot sign in
once the username is freed. The owner accepted this bounded gap on 13 November
2026, and the upstream changes below close it.

## Moving To Convex Auth

The cutover of 13 November 2026 (#2423) replaced the earlier auth system in one
release, with no compatibility window and no migration function.

- At the cutover production held 752 Google sign-ins and no password, school
  login, login card, or guardian link, so every account moves by its first
  Google sign-in, which signs in to the account that holds its verified address
  and keeps its id. Each learner signs in once more, because the earlier
  sessions do not carry over.
- `users.authId`, the earlier id, cannot leave the schema in the same deploy,
  because Convex refuses a schema that drops a field every row holds. The
  cutover makes it optional and unread, the Convex CLI clears it from every row
  right after the deploy (`convex import --table users --replace` of the rows
  without it, which keeps each id and creation time), and the next change drops
  the field. This is the one exception to the one-step change rule.
- The earlier component's data is deleted, and the deployment variables it read,
  its secret and its key set, are removed by name.
- Upstream changes that close the gaps of Account Deletion and of the hosted
  domain check, opened on 13 November 2026: `deletePassword` for the password
  component (https://github.com/convex/convex-auth/pull/924),
  `deleteUserAccounts` for the OAuth components
  (https://github.com/convex/convex-auth/pull/925), and the Workspace domain
  in the Google profile (https://github.com/convex/convex-auth/pull/926). When
  they ship, the deletion workflow erases both rows and the invite claim checks
  the hosted domain again.

## Usernames And Profiles

A profile lives at `/{locale}/@username`. The username belongs to the app user
row (`users.username`, with the index `by_username`). It is the only namespace
of profile names, and it is no credential: a password or a Google sign-in is.
Convex Auth's username of a school account is the account's id, never this
handle (School Sign-In, below).

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
- The retired address `/{locale}/user/{id}` and its `chat` tab are not found for
  everyone, the account that holds the id included. Until 8 November 2026 they
  answered 308 to the username address for that account alone; in the 15 days
  of Cloudflare request data the redirect answered no request, and neither
  Google nor Bing showed the address, so the redirect was deleted.

### Naming The Accounts Made Before

Accounts made before this decision got their usernames from a temporary
migration, which named 1 account on dev and 729 accounts on production on 14
October 2026, and was then deleted with its tests and bindings. The schema keeps
`username` optional, because a deleted account holds none.

## Rejected Alternatives

Keeping the earlier auth system and tuning it was rejected by the owner on 13
November 2026: it read a separate component on every signed-in write, its
adapter bundled to 2,830 KiB, and its performance and stability cost Convex
function time and learner latency.

Reading the session only on writes, as the earlier design did, saves one
component query per read but leaves a revoked session reading for the rest of
its token's lifetime.

A migration function that copies the earlier sessions into Convex Auth was
rejected: it would ship a temporary function and a second session format for
the sake of 19 live sessions, and a learner's next Google sign-in links the
account by itself.

A public query of a profile by username, closed by a rule, was rejected until an
age is stored. With no age, the rule would answer not found for every account
but the caller's own, which `getCurrentUser` already gives, so the query would
repeat it.

## References

- https://docs.convex.dev/auth/convex-auth/getting-started and
  https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup: the components, the
  SSR routes, and the cookie names.
- `@convex-dev/auth` 2.0.0: `server/userId.js` (`getAuthUserId` reads the
  session row on every call), `ssr/handlers.js` (the refresh and sign-out
  routes, and the origin check of `ssr/origin.js`), `components/password/public.js`
  (the throttle), `component/sessions.js` (the refresh grace and the spent-token
  horizon), `lib/oauth/authorize.js` (PKCE and the parameters Google receives),
  `components/google/constants.js` (the scopes), and `lib/oauth/schema.js` (the
  Google account row, indexed by provider id only).
- https://developers.google.com/identity/protocols/oauth2/web-server: the
  default `access_type` is `online`, which returns no refresh token.
- https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites
  and `apps/www/src/lib/profile/rewrite.ts`: the router path that serves the
  `@username` address.
- GDPR Article 4(1) and Article 17: an online identifier is personal data, and
  the right to erasure.
- RFC 2606, section 2: `.invalid` is a reserved top-level domain whose names are
  sure to be invalid, so mail to an address in it never arrives.
