# ADR 0026: School Hosts, One URL Tree, And Data Cells

> Superseded in part by [ADR 0037](0037-cloudflare.md) and [ADR 0036](0036-boundary.md): the hosting and framework statements of this record describe the earlier stack. Cloudflare Workers through Alchemy and the TanStack Start boundary replace them.

## Status

Accepted on 13 October 2026 with owner decisions K5, K11, and K15. The owner
approved decisions K1 to K20 on that day. The host rewrite for school subdomains
and the root of the URL tree are live, and the rest of the URL tree is planned.
The eu data cell is planned, and it is created when the first school in the
European Union signs (K5). The routes of the old School are deleted from the web
app (#1051, K11) and get no redirect. Amended on 14 October 2026: ADR 0027
decides what an email may hold (Data cells). Amended on 17 October 2026: the
proxy decides the 404 of a school page before it streams, and the shared sign-in
trusts only school hosts (Hosts).

## Context

The first School lived under the locale path `/[locale]/school/[slug]`. #1051
deleted its routes and its sign-in redirect from the web app (ADR 0011,
Retirement), and the proxy in `apps/www/proxy.ts` did not route school hosts.

A school needs an address that a member can open in any language, that keeps its
data in one place, and that never carries a person's name. ADR 0011 makes the
organisation (the tenant) the owner of one host label under `nakafa.com`. This
ADR fixes what sits under that label, where the data lives, and how a request
finds the right data.

## Decision

### Hosts

- An organisation's host is `slug.nakafa.com`, where the slug follows ADR 0011.
  That is the `us` cell's domain: a cell other than `us` serves its
  organisations under a registrable domain of its own (see Data cells). One host
  serves every unit of the organisation.
- A school host has no locale prefix. The language comes from the `NEXT_LOCALE`
  cookie, then from Accept-Language, then from the default locale, as next-intl
  resolves it. Sign-in sets the cookie, and changing the language in the account
  menu sets it again.
- One sign-in covers `nakafa.com` and every school host of the `us` cell,
  through the cross-subdomain cookies that ADR 0011 describes.
- The shared sign-in trusts an origin only when it is the site's own origin on a
  local run, or a school host of the site. A school host's label must pass
  `isSchoolLabel` (`confect/tenancy/slug.ts`), the rule that the school router
  applies too, so a reserved label such as `cas`, `api` or `mcp` is not trusted,
  and neither is a label of two levels, a label the slug rules refuse, or an
  origin that a browser would not write. A script on a service host sends the
  shared session cookie with a credentialed request, so trusting every subdomain
  would let that script act on the session (ADR 0009). Better Auth asks for the
  trusted origins with each request (`trustedOrigins` as a function in
  `better-auth` 1.6.33, `dist/context/helpers.mjs` lines 76 to 82, and
  `dist/api/middlewares/origin-check.mjs` line 108), so the answer holds the
  origin that Better Auth checks for the request only when the rule trusts it
  (`confect/auth/host.ts`). That origin is the Origin header or, when the header
  is empty, the origin of the Referer header (`origin-check.mjs` line 98). A
  browser sends an Origin with every POST: the Fetch standard appends one to
  every request whose method is neither GET nor HEAD (section 3.2, step 4), and
  MDN lists same-origin POST requests among those that carry it. A `null` Origin
  is refused before the Referer is read, because the header is not empty. The
  Referer therefore answers only a client that is not a browser, and such a
  client already holds the session cookie that the check protects. A school host
  and the base host both pass the check for a request with no Origin. A callback
  URL on a school host is trusted only for a request from that host. No sign-in
  flow names another school host yet.
- The proxy reads the host, the cookie, and Accept-Language. The map from host to
  school is configuration, so a request never reads the database to find its
  school. A request that reads nothing has a target of under 1 ms, which no run has
  measured yet. A page request on a school host makes the one Convex query of the
  next bullets, and only to decide the page's status. The Convex site trusts
  `x-forwarded-host` for the school host gate, and credentials and the slug-scoped
  lookup, not the header, protect sign-in.
- The proxy's redirects name the host and port that the visitor asked for, read
  from the Host header (`apps/www/src/lib/routing/school/host.ts`): the port of the header, or the
  default port of the protocol when the header names none. Only the protocol comes
  from the request URL. Its rewrites name the request URL, the origin of the
  server, because Next proxies a rewrite to any other origin: a
  school page is never rewritten to the visitor's host, and the school rewrite
  reads the request URL and not `nextUrl`, which maps a loopback address to
  `localhost`. A self-hosted run builds the request URL from the server's own
  address, so the redirects of next-intl, such as `/` to `/en` on the main site,
  still name that address.
- A school page's status is decided by the proxy before the page streams, in
  `apps/www/src/lib/routing/school/refusal.ts`, as the profile page already decides its 404 in
  the proxy (`apps/www/src/lib/routing/public/profile.ts`). The gate reads one query,
  `tenancy.profile.refusal` (`packages/backend/confect/tenancy/profile.impl.ts`),
  which decides the school's existence and the caller's view of it together: a
  school that no one has the address of is refused for every caller, and a signed-in
  member whom the school does not admit (`tenant.view` denied) is refused. A visitor,
  and a signed-in non-member of an existing school, reach the layout, which renders
  the outsider page (`apps/www/src/components/tenant/outsider.tsx`) with a 200 status. The refused page answers
  with the app's not-found page and a 404 status, through a rewrite to the
  not-found route, in the locale that the school page negotiates. The school
  layout cannot answer 404 itself: Next sends the static shell of the route with
  status 200 first, and a `notFound()` call after that keeps the 200 (the
  installed docs, `loading.md`, "Status codes").
- A page request is a GET or HEAD document that is not a Flight request. A client
  navigation and a prefetch both carry `rsc: 1`, so they pay no read, and the
  layout still refuses a membership that has ended. A read that fails goes on to
  the school tree, and its full cause is logged, so an outage never answers with
  not found.
- A path that next-intl cannot decode, such as `/%`, gets no rewrite and no
  locale, so the request goes on unchanged for a refused visitor and an admitted
  one. A 404 for a refused visitor alone would tell the two apart, so the refusal
  does not apply to such a path.
- A school page request costs two or three Convex query calls. The proxy makes one:
  `tenancy.profile.refusal`, which reads one school row by its slug and, for a
  signed-in caller, the caller's Person and grants, so a non-member costs the same
  one call as a member. The layout reads its profile and, for a signed-in viewer,
  its viewer once per request (`apps/www/src/lib/tenant/read.ts`), because it still renders the
  name and the role. A signed-in viewer also
  reads the session token twice, once in the proxy and once in the layout, because
  React's `cache` does not span the two. Each read of the layout, token or query,
  is retried within the shared network budget, so one read answers or fails
  within 31.5 seconds (`packages/backend/client/network.ts`). The proxy's gate
  makes one attempt per query, and the whole gate, its session read included,
  waits at most one deadline: `NETWORK_ATTEMPT_DEADLINE`, 10 seconds, the bound
  that every attempt of a network read already has (`packages/backend/client/network.ts`,
  used by `apps/www/src/lib/routing/school/refusal.ts`). A gate that misses the deadline or
  fails goes on to the page, with its full cause logged. So a school that does not
  answer holds a page request for at most 10 seconds in the proxy and then up to
  31.5 seconds in the layout, before the error boundary. Before this change the
  proxy alone could hold it for 31.5 seconds, so the worst case falls from about
  63 seconds to about 42 seconds.
  The deadline is not derived from a measured latency in this change: the
  p50 and p99 of `tenancy.profile.get` and `tenancy.viewer.get` on a local
  acceptance backend are not recorded here, and the bound stays the existing one
  until they are.
- School pages are private and not indexed (ADR 0011).
- An address never holds personal data, so a student's name never enters a URL.
- A school member or an account under 18 has no public profile (K15). Each school
  uses its own host.

### URL tree of the school workspace

Every address below is planned, except the root of a school host, which is live.

| Address | Purpose |
| --- | --- |
| `harapan.nakafa.com` | Signed out: sign-in with Google or a school username. Signed in: home. |
| `harapan.nakafa.com/setup` | Setup for the owner and the admin. It disappears when setup is complete. |
| `harapan.nakafa.com/classes/fisika-x-1` | A class home. The slug comes from the subject and the class group, not from an ID. |
| `.../classes/fisika-x-1/forum`, `/library`, `/tasks`, `/people`, `/grades` | The class tabs. Each tab has its own address. |
| `.../classes/fisika-x-1/forum/12` | A numbered discussion. The number is per class, like an issue number. |
| `.../classes/fisika-x-1/tasks/latihan-gerak-lurus` | A task. The slug comes from the task title. |
| `harapan.nakafa.com/exams` | All exams and their status. |
| `.../exams/pts-matematika` | An exam. Its information, taking it, and its results share this address. |
| `.../exams/pts-matematika/sittings/sesi-2` | One sitting: one room and one token. |
| `.../exams/pts-matematika/review` | Answers that wait for a teacher, and attempts whose late records wait for a decision (ADR 0013). |
| `harapan.nakafa.com/people` | Everyone in the school. Admins invite people. Teachers manage their class members from this list. |
| `harapan.nakafa.com/reports/2026-2027-1/x-1` | A report card, by period, then class group. A teacher reaches a report card only through the homeroom relation (ADR 0012). |
| `harapan.nakafa.com/bank`, `/bank/trigonometri/14`, `/bank/impor/pts-matematika` | The question bank, an item by topic and number, and an import reviewed next to its original PDF. |
| `harapan.nakafa.com/insight` | Insight. |
| `harapan.nakafa.com/connectors`, `/connectors/classroom` | Connectors. A teacher sees only their own connections. |
| `harapan.nakafa.com/perangkat` | Where a person types the code that the CLI shows (device authorization). |
| `harapan.nakafa.com/kartu` | Where a student enters the code of a login card (ADR 0009). It works on the school host only. |
| `harapan.nakafa.com/orang-tua` | Where a parent asks for a sign-in code by email and enters it (ADR 0009). It works on the school host only. |
| `harapan.nakafa.com/api/v1`, `harapan.nakafa.com/mcp` | The school REST API and the school MCP server. They use OAuth 2.0 client credentials. |
| `harapan.nakafa.com/settings` | Organisation settings, periods, class groups, billing, and the AI quota. |
| `harapan.nakafa.com/chat` | Nina in the school. A school thread does not read personal memory (K3). |

### Addresses outside the school host

| Address | Purpose | Status |
| --- | --- | --- |
| `nakafa.com/id/notifications` | One inbox. In a school, a panel on the right filters by school, and no second address exists. Push carries only an id and a general title. | Planned, changed |
| `nakafa.com/id/user/settings/memory` | Personal Nina memory. It never appears inside a school. | Live |
| `nakafa.com/id/user/settings` | Account settings | Live |
| `nakafa.com/id/user/settings/learning` | Role and curriculum preferences | Live |
| `nakafa.com/id` | Back to Nakafa learning | Live |
| `api.nakafa.com/v1` | Public REST. No key, public data only. It never accepts a school path. | Live |
| `mcp.nakafa.com/mcp` | Public MCP. No key, Nakafa content only. The name repeats in the host and the path, and it stays so that agents keep working. | Live |
| `nakafa.com/id/school/{slug}/...` | The old School. Retired with K11, with no redirect. | Deleted from the web app in #1051 |

These are the addresses of the `us` cell. An account's own surfaces, the inbox
and the account settings, are served by the cell that holds the account, under
that cell's domain at the same paths, and a school shell links to the ones of
its own cell, so an account of another cell never lands on a `nakafa.com` page
that cannot see its session. Personal Nina memory and Nakafa learning exist only
in the `us` cell, so a shell of another cell shows no link to them.

The school REST and MCP addresses are separate from the public ones. The public
addresses stay keyless. The change to ADR 0006 that makes this split is made in
its own change, before any school code that depends on it lands.

### Data cells

- The `us` cell is live. The Convex region, `aws-us-east-1`, appears in no
  repository file, so this record cannot check it. Indonesian schools stay in
  this cell, because Convex has no Indonesian region (K5). The owner asked on 30
  September 2026 that these regions stay as they are.
- The `eu` cell is planned. It runs on Convex `aws-eu-west-1` in Dublin. It is
  created when the first school in the European Union signs, with its own budget
  (K5).
- Each cell runs its own `www` project and its own Convex deployment. A cell's
  project has its own `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`,
  and its deployment has its own `SITE_URL` and cookie domain. The `us` project
  serves `nakafa.com` and its school hosts, and a later cell's project serves that
  cell's domain. A request reaches its cell by the domain it names, so the proxy
  never routes across cells and no resolver keyed by host exists. The change that
  creates a cell adds the test that an `/api/auth` request on a cell's host
  reaches only that cell's site.
- A school is placed in one cell when it is created. A move to another cell is
  never automatic, and its host moves to the other cell's domain with it. The
  cell is shown only in the settings. A move runs in the order of the next
  section.
- An account has one home cell, and it signs in and writes only there: every
  mutation checks its session against the Better Auth rows of its own deployment
  (ADR 0009). A person with schools in two cells holds one account in each,
  signed in with the same email or Google identity.
- A browser sends a cookie to every host under the domain the cookie names, so
  each cell's hosts live under a registrable domain of their own and its session
  cookie names that domain: `nakafa.com` for `us`, and for `eu` a domain that
  the change creating the cell chooses and registers. A session of one cell is
  then never sent to a host of another, and both live in one browser. A host
  belongs to the cell whose project serves its domain.
- Signed Aksara content is copied to every cell. A teacher's questions stay in the
  school's own cell.
- Email is sent from the cell's own domain. What an email may hold is decided in
  ADR 0027: links and general sentences, and never a grade, a student's name, the
  text of a message, or an exam token. The one code an email carries is the
  parent's six-digit sign-in code (ADR 0009). It expires after five minutes,
  rests as a keyed hash, and is useless without the code entry page of the school
  host (`/orang-tua`). Push carries only a notification id and a general title.

### Moving a school between cells

A move runs in this order:

1. An operator suspends the tenant from the start of the export to the cutover.
   A suspended tenant refuses every member write (ADR 0011), so no member
   changes the data while it is copied. The system transitions of ADR 0012
   (Decisions, rule 1) still run in it, and the table below says why none of them
   leaves a wrong row in the target.
2. The export reads every table the tenant owns, the tenant's journal entries
   (ADR 0016), and its stored files.
3. The import writes them into the target cell. It gives every row a new ID there
   and rewrites each reference to it, except the references to accounts, which
   stay in their home cell: every Person arrives unclaimed, every accepted invite
   arrives revoked as after a release (ADR 0011), and the school invites its
   members again. The import also writes every operator Person suspended and every
   grant of one ended. Before the tenant becomes active in the target cell, the
   expiry sweep of ADR 0011 (Time) runs for it there.
4. At a dated cutover the move reads the tenant's journal entries that the
   source wrote after the export, rewrites their references as the import does,
   and writes them into the target, so no journal entry exists only in the
   source. Then the host switches to the target cell's domain, and the tenant
   becomes active again in the target cell.
5. The source rows are deleted through a reviewed batched deletion, run dry and
   then for real until every count is zero, the pattern that ADR 0011 uses to
   retire the old School. Nothing of the school stays in the source cell: not its
   Persons' names, nor the email addresses of its invites, nor its journal.

| Transition during the copy | Why the target stays correct |
| --- | --- |
| A visit end | A visit belongs to the operators of its cell (ADR 0011), so the import ends every operator grant and suspends every operator Person (step 3). |
| A grant expiry | The target ends every grant and invite whose time has passed before the tenant becomes active there (step 3). |
| An account release | Accounts stay in their home cell, so every Person arrives unclaimed (step 3). |
| An invite expiry | Every accepted invite arrives revoked and the target ends every invite whose time has passed before the tenant becomes active (step 3). |
| The close or the reconciliation of an attempt | The source writes them while the tenant is suspended, and the export and the journal entries copied at cutover carry them (steps 2 and 4); the target's sweep closes any attempt whose deadline passed in between (step 3). |
| Any journal entry of these | Copied with the rest at cutover (step 4). |
| The operator's reactivation of the tenant | Only the move reactivates the tenant, and only in the target cell (step 4). The source tenant stays suspended until step 5 deletes its rows. |

## Consequences

- A school address is short, and it has no language prefix. The same link opens
  the school in any language, because the language comes from the cookie.
- One sign-in serves every school host of a cell. A school host and
  `nakafa.com` share their cookies.
- A person with schools in two cells signs in once per cell.
- A school that moves cells needs an export, an import, a dated cutover, and a
  deletion of the source rows. Nothing moves on its own, and its members claim
  their Persons again with accounts of the target cell.
- A school page that the proxy cannot read is answered as it was before the proxy
  decided it: a missing school shows the not-found page with a 200 status, because
  the layout cannot change the status once the shell is sent.
- The eu cell adds a second place where data lives, a second `www` project, and a
  second budget. Its cost starts with the first European school that signs.
- Data location is limited by the providers. Resend stores account data in the
  United States even when it sends from Ireland. The location of Convex logs and
  backups is not confirmed in writing, and the privacy text must not claim more.

## Rejected Alternatives

- A locale prefix in school addresses. The language is in the cookie, so the
  address stays the same in every language.
- Personal data in an address, such as a student's name. An address is shared and
  logged, so it never carries personal data.
- Creating the eu cell now. K5 defers it until the first European school signs.
- Reading the database in the proxy to find a school. The host names the school,
  so the proxy reads the database only to decide the status of a page (Hosts).
- A session cookie of its own name for each cell under `.nakafa.com`. The
  browser sends every `.nakafa.com` cookie to every host under it, so the names
  keep the sessions apart but still send one cell's session to the other cell's
  hosts.
- One account across cells through a federated session. It would keep the
  identity of a person in the `eu` cell inside the `us` cell, which is what a
  cell exists to prevent.
- One `www` project for every cell, with a resolver that picks the deployment by
  host. The auth handler (`apps/www/src/lib/auth/forward.server.ts`) takes both
  `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`, the session token
  read in the same file takes the site URL, and the Convex provider
  (`apps/www/src/components/providers/app.tsx`) takes the query URL, besides the
  readers of signed content and try-outs. A resolver would have to replace every
  one of them, and one miss would send a session cookie to the wrong cell's
  deployment.

## Implementation Status

| Part | Status |
| --- | --- |
| The routes of the old School and `readSchoolAuthRedirect` in `apps/www/proxy.ts` | Deleted from the web app in #1051 and its backend in #1037 (K11) |
| Host rewrite for school subdomains | Live |
| Shared sign-in cookie across the school hosts of the `us` cell (ADR 0009) | Live |
| Shared sign-in cookie on a local run (`SITE_URL` on `localhost`) | Chromium sends a `Domain=localhost` cookie to `localhost` and not to `school.localhost`, so a sign-in on a school host of a local run keeps its cookies on that host alone (`hostOwnSchoolCookies` in `packages/backend/confect/auth/host.ts`), and the auth proxy hands Better Auth the browser's host (`apps/www/src/lib/auth/relay.ts`), because a local `next start` builds the request URL from its own address. Sharing one sign-in across school hosts is proven only on a real domain (`nakafa.com`, `local.nakafa.com`) |
| School URL tree, root (`/`, Beranda) | Live |
| The proxy decides the 404 of a school page (Hosts) | Live |
| School URL tree, every other address | Planned |
| `us` data cell | Live |
| `eu` data cell, with its own `www` project and Convex deployment | Planned, created by K5 |
