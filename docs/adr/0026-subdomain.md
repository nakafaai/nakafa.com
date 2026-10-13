# ADR 0026: School Hosts, One URL Tree, And Data Cells

## Status

Accepted on 13 October 2026 with owner decisions K5, K11, and K15. The owner
approved decisions K1 to K20 on that day. The host rewrite for school subdomains
and the URL tree are planned. The eu data cell is planned, and it is created when the first
school in the European Union signs (K5). The old School routes are retired with
K11 and get no redirect.

## Context

Today the School lives under the locale path `/[locale]/school/[slug]`. Its
routes are in `apps/www/app/[locale]/(app)/school`. The proxy in
`apps/www/proxy.ts` handles School sign-in redirects through
`readSchoolAuthRedirect`, and it does not route school hosts.

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
  cookie. Sign-in sets the cookie, and changing the language in the account menu
  sets it again.
- One sign-in covers `nakafa.com` and every school host of the `us` cell,
  through the cross-subdomain cookies that ADR 0011 describes.
- The proxy reads only the host and the cookie. The map from host to school is
  configuration, so a request never reads the database to find its school.
- School pages are private and not indexed (ADR 0011).
- An address never holds personal data, so a student's name never enters a URL.
- A school member or an account under 18 has no public profile (K15). Each school
  uses its own host.

### URL tree of the school workspace

Every address below is planned.

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
| `.../exams/pts-matematika/review` | Answers that wait for a teacher. |
| `harapan.nakafa.com/people` | Everyone in the school. Admins invite people. Teachers manage their class members from this list. |
| `harapan.nakafa.com/reports/2026-2027-1/x-1` | A report card, by period, then class group. A teacher reaches a report card only through the homeroom relation (ADR 0012). |
| `harapan.nakafa.com/bank`, `/bank/trigonometri/14`, `/bank/impor/pts-matematika` | The question bank, an item by topic and number, and an import reviewed next to its original PDF. |
| `harapan.nakafa.com/insight` | Insight. |
| `harapan.nakafa.com/connectors`, `/connectors/classroom` | Connectors. A teacher sees only their own connections. |
| `harapan.nakafa.com/perangkat` | Where a person types the code that the CLI shows (device authorization). |
| `harapan.nakafa.com/api/v1`, `harapan.nakafa.com/mcp` | The school REST API and the school MCP server. They use OAuth 2.0 client credentials. |
| `harapan.nakafa.com/settings` | Organisation settings, periods, class groups, billing, and the AI quota. |
| `harapan.nakafa.com/chat` | Nina in the school. A school thread does not read personal memory (K3). |

### Addresses outside the school host

| Address | Purpose | Status |
| --- | --- | --- |
| `nakafa.com/id/notifications` | One inbox. In a school, a panel on the right filters by school, and no second address exists. Push carries only an id and a general title. | Planned, changed |
| `nakafa.com/id/user/settings/memory` | Personal Nina memory. It never appears inside a school. | Live |
| `nakafa.com/id/user/settings` | Account settings | Live |
| `nakafa.com/id` | Back to Nakafa learning | Live |
| `api.nakafa.com/v1` | Public REST. No key, public data only. It never accepts a school path. | Live |
| `mcp.nakafa.com/mcp` | Public MCP. No key, Nakafa content only. The name repeats in the host and the path, and it stays so that agents keep working. | Live |
| `nakafa.com/id/school/{slug}/...` | The old School. Retired with K11, with no redirect. | Live, retired with K11 |

The school REST and MCP addresses are separate from the public ones. The public
addresses stay keyless. The change to ADR 0006 that makes this split is made in
its own change, before any school code that depends on it lands.

### Data cells

- The `us` cell is live. Vercel runs `www` in `iad1` (`apps/www/vercel.ts`).
  The Convex region, `aws-us-east-1`, appears in no repository file, so this
  record cannot check it. Indonesian schools stay in this cell, because neither
  Convex nor Vercel has an Indonesian region (K5). The owner asked on 30 September
  2026 that these regions stay as they are.
- The `eu` cell is planned. It runs on Convex `aws-eu-west-1` in Dublin, and on
  Vercel `dub1` only if measured latency calls for it. It is created when the
  first school in the European Union signs, with its own budget (K5).
- A school is placed in one cell when it is created. Moving it to another cell is
  an export and an import, never an automatic move, and its host moves to the
  other cell's domain with it. The cell is shown only in the settings.
- An account has one home cell, and it signs in and writes only there: every
  mutation checks its session against the Better Auth rows of its own deployment
  (ADR 0009). A person with schools in two cells holds one account in each,
  signed in with the same email or Google identity.
- A browser sends a cookie to every host under the domain the cookie names, so
  each cell's hosts live under a registrable domain of their own and its session
  cookie names that domain: `nakafa.com` for `us`, and for `eu` a domain that
  the change creating the cell chooses and registers. A session of one cell is
  then never sent to a host of another, and both live in one browser. The map
  from host to cell follows from the domain.
- Signed Aksara content is copied to every cell. A teacher's questions stay in the
  school's own cell.
- Email is sent from the cell's own domain and carries only links. Push carries
  only a notification id and a general title.
- The map from host to cell is configuration that the proxy reads without the
  database. Its target is under 1 ms, measured at the edge.

## Consequences

- A school address is short, and it has no language prefix. The same link opens
  the school in any language, because the language comes from the cookie.
- One sign-in serves every school host of a cell. A school host and
  `nakafa.com` share their cookies.
- A person with schools in two cells signs in once per cell.
- A school that moves cells needs an export and an import. Nothing moves on its
  own.
- The eu cell adds a second place where data lives and a second budget. Its cost
  starts with the first European school that signs.
- Data location is limited by the providers. Resend stores account data in the
  United States even when it sends from Ireland. The location of Convex logs and
  backups is not confirmed in writing, and the privacy text must not claim more.

## Rejected Alternatives

- A locale prefix in school addresses. The language is in the cookie, so the
  address stays the same in every language.
- Personal data in an address, such as a student's name. An address is shared and
  logged, so it never carries personal data.
- Creating the eu cell now. K5 defers it until the first European school signs.
- Reading the database in the proxy to find a school. The proxy reads only the
  host and the cookie.
- A session cookie of its own name for each cell under `.nakafa.com`. The
  browser sends every `.nakafa.com` cookie to every host under it, so the names
  keep the sessions apart but still send one cell's session to the other cell's
  hosts.
- One account across cells through a federated session. It would keep the
  identity of a person in the `eu` cell inside the `us` cell, which is what a
  cell exists to prevent.

## Implementation Status

| Part | Status |
| --- | --- |
| `apps/www/app/[locale]/(app)/school` and `readSchoolAuthRedirect` in `apps/www/proxy.ts` | Live today, retired with K11 |
| Host rewrite for school subdomains | Planned |
| School URL tree | Planned |
| `us` data cell | Live |
| `eu` data cell | Planned, created by K5 |
| Host-to-cell map | Planned |
