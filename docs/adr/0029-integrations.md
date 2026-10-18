# ADR 0029: Integrations Are Projections Of The Access Catalog, Served Through Effect HttpApi

## Status

Accepted on 13 October 2026 with the owner's approval of the School blueprint,
revision 6 (decisions K1 to K20). Planned. The school REST API, the school MCP
server, the CLI login, webhooks, and the standards adapters are program wave C.
Removing `hono` from the lock is program wave A. The public REST API, the public
MCP server, and the public CLI are live and do not change. ADR 0006 owns the
namespace of the school API and ADR 0026 owns its host. Implementation Status
lists each part.

## Context

A school needs to use Nakafa without opening the app: to bring a roster in, to
take grades and events out, to open a class from its learning system, and to let
an assistant read a class. Three surfaces exist today, and they share one rule:
no credential and no school data.

- Public REST at `api.nakafa.com/v1`. Its routes are hand-written
  `HttpRouter.route` calls in `packages/backend/confect/routes/agent`, its
  readers are in `packages/backend/agent`, and its OpenAPI 3.1.1 document is
  built by hand in `packages/backend/agent/openapi`.
- Public MCP at `mcp.nakafa.com/mcp`. It runs on Effect's `McpServer` at protocol
  2026-07-28 (`packages/backend/agent/mcp/server.ts`).
- `@nakafa/cli` 0.1.1 (`packages/cli`). It is public and read only, and it
  needs no account or key.

The Vercel bridges of the public API (`apps/api/vercel.ts`, `apps/mcp/vercel.ts`)
delete the `authorization` and `cookie` request headers before a request reaches
Convex (`createAgentEdgeRoutes` in `packages/backend/agent/route.ts`). None of
the three surfaces can carry a school's credential.

The HTTP layer is a Confect router. `packages/backend/convex/http.ts`
re-exports `packages/backend/confect/http.ts`, which calls `HttpRouter.make` of
`@confect/server` on a merged layer of route layers. `@confect/server` 10.1.0,
the version this repository pins, documents in `src/HttpRouter.ts` that the layer
may be built from `effect/http-api`: `HttpApiBuilder.layer(api)` registers the
endpoints of an `HttpApi`, and its handlers may require the Confect services.
No Nakafa code uses `effect/http-api` today (`git grep` on main at
`f8a5610808`).

## Decision

### Every surface is a projection of the access catalog

Each object and action is declared once, in the access catalog (ADR 0012). The
school REST API, the school MCP server, the CLI, webhooks, and exports are
written against it.

- An endpoint, a tool, a webhook, or an export names an action of a declared
  kind, and its handler gets the subject through that kind's authority. `decide`
  is the only place a permission is decided. No surface keeps a permission table
  or a scope list of its own.
- Every school call is decided. A write goes through an internal mutation that
  resolves the caller and decides again in its own transaction (ADR 0012, Convex
  actions), so a client revoked between two calls stops at the write. That
  mutation shares its code with the function of the web app. It writes the
  journal entry in the same transaction (ADR 0016), with the client or the person
  as the actor. The actor union of the tenant entry takes a member for an
  integration client in the change that adds the first client write.

| Surface | Address | Credential | Status |
| --- | --- | --- | --- |
| Public REST | `api.nakafa.com/v1` | None | Live |
| Public MCP | `mcp.nakafa.com/mcp` | None | Live |
| Public CLI | `@nakafa/cli` 0.1.1 | None | Live, read only |
| School REST | `harapan.nakafa.com/api/v1` | A bearer token | Planned |
| School MCP | `harapan.nakafa.com/mcp` | A bearer token | Planned |
| School CLI | `nakafa login harapan.nakafa.com` | Device authorization | Planned |
| Webhooks | The receiver's address | An HMAC signature | Planned |
| Exports | CSV and XLSX files | The caller's token or session | Planned |

The public addresses stay keyless and never accept a school path (ADR 0006,
ADR 0026). An export is made by a reader behind `decide`, so it holds exactly
what its caller may read. The XLSX library is the one chosen with the Dapodik
import, and the Dapodik export itself belongs to Records (ADR 0033), and the import
stays with the connectors (ADR 0015).

### REST: one `HttpApi`

One `HttpApi` definition in `confect/integrations` declares the groups, endpoints,
and schemas of the school API. Everything else comes from it.

- `HttpApiBuilder.layer` mounts the routes on the Confect router beside the
  public ones, and a middleware with the bearer scheme (`HttpApiSecurity.bearer`
  and `HttpApiMiddleware`) checks the token and provides the caller to every
  handler, so no handler runs without one.
- `OpenApi` writes the OpenAPI 3.1 document from the definition,
  `HttpApiClient` derives the typed client that the CLI and the tests use, and
  `HttpApiTest` runs the handlers in memory. The document, the CLI, the tests,
  and the documentation therefore share one source and cannot drift. The
  definition imports no Convex or server code, so the CLI can bundle it.
- Effect's security schemes are `http` (bearer), `apiKey`, and `basic`
  (`HttpApiSecurity`). The document declares the bearer scheme and names the
  token endpoint in its description.
- The document is served under `/api/v1` without a token, because it describes
  the contract and holds no school data.
- A handler reaches the data through the Confect runners, as the public routes
  do. A write is one mutation call, so the change, its journal entry, and its
  idempotency record commit together.
- Errors are RFC 9457 problem details, as in the public API
  (`packages/backend/confect/routes/agent/response.ts`).
- `/api/v1` is a compatibility namespace like the public `/v1`: a breaking change
  gets a new namespace and its own decision (ADR 0006).

### Calling the school API: clients, devices, and tokens

| Caller | Flow | Holds | Acts as |
| --- | --- | --- | --- |
| An integration, an app | OAuth 2.0 client credentials (RFC 6749 section 4.4) | A client ID and a secret. The secret is random, shown once, and stored only as a hash in `integrationClients`. | The client. It holds the Integration role over its tenant or one unit, limited to the actions on its list (ADR 0012). |
| The CLI | Device authorization (RFC 8628) | A token on the device | The Person who approved it, with that Person's grants, limited to the actions the CLI needs |

- A token is short-lived and is bound to the resource it was issued for
  (RFC 8707). `/api/v1` accepts only a token issued for it, and `/mcp` only one
  issued for it, as the MCP specification requires of a server. A token travels
  in the `Authorization` header and never in a query string.
- A client's action list can name only actions that the catalog opens to the
  Integration role. The tenant of a call comes from the client or the person
  behind the token and never from a parameter the caller chooses (ADR 0012).
- An Owner or an Admin creates and revokes clients and webhooks. Revoking a
  client ends its tokens and its webhooks. A client secret hash and a webhook
  secret are kept only while the client or the webhook is active, so revoking one
  deletes its secret.
- A person approves a device at `harapan.nakafa.com/perangkat` after signing in
  (ADR 0026). The CLI token is scoped to the school API. It is not a session.
- A token issued for the school API is never accepted as a Convex session, and a
  session is never accepted as an API token.

Better Auth already offers the parts of an authorization server, as its pages say
(read 13 October 2026). `@better-auth/oauth-provider` offers `client_credentials`
for machine access, resources under RFC 8707, introspection, revocation, and a
device grant. Its device authorization plugin implements RFC 8628, but in its
standalone form it returns a Better Auth session token, which would give the CLI
the power of a session. This repository pins `better-auth` 1.6.33 and the
registry's latest is 1.7.7. `@better-auth/oauth-provider` has a 1.6.33 release
that asks for `better-auth` ^1.6.33 (npm registry, 13 October 2026). So the
change that builds the token endpoint reads the source of that release, and not
only the pages, before it relies on a feature. It adopts the plugins if they meet
these conditions, and otherwise it writes the endpoint and records here why:

- The tenant of a client stays owned by `confect/tenancy` (ADR 0011 keeps tenancy
  out of Better Auth's schema), so a client row held by Better Auth carries only
  a reference to its tenant.
- A client secret is stored as a hash.
- An access token is short-lived and bound to one resource. It is revoked at
  once, or its lifetime is no longer than the revocation delay Nakafa accepts.
- A CLI token carries the actions the CLI needs and is not a session.

### The school host forwards to its own cell

The school host belongs to one data cell, with its own web project and its own
Convex deployment (ADR 0026). The public bridge cannot serve the school API,
because it deletes the credential. The web project of the cell forwards
`/api/v1` and `/mcp` to the Convex site URL of the same cell, and does the same
for any OAuth endpoint that lives on the school host. The forward must:

- keep the `Authorization` header and drop `cookie`: the school API takes a
  token and never a session cookie;
- never reach the origin of another cell;
- add no edge secret. The Convex origin is public, because its URL is in
  `NEXT_PUBLIC_CONVEX_SITE_URL`, so the route verifies the token itself and
  trusts nothing the forward adds. It derives the resource a token must name
  from the tenant of the token, and not from a header.

The change chooses how the forward is built (a rewrite in the proxy or in
`next.config.ts`, or a route handler with its reason documented at the seam) and
measures its cost.

### MCP

The school MCP server is a second use of the `McpServer` seam of the public one,
at the same protocol version. It is an OAuth resource server in the sense of the
MCP authorization specification, version 2026-07-28, read 13 October 2026: it
publishes protected resource metadata (RFC 9728), answers 401 with a
`WWW-Authenticate` header that points to it, and accepts only tokens issued for
it. The metadata needs no token, because a client reads it before it has one.
Each tool is a projection of an action. It calls the same services as REST
and goes through `decide`. The public MCP definitions
(`packages/backend/agent/mcp`) stay public and read only, and no school tool is
registered on them. The school route keeps the guards of the public route in
front of the engine (ADR 0006): the origin check, the body cap, the rate limit,
and the refusals of malformed requests. The token replaces the edge secret.

### The CLI

`@nakafa/cli` keeps its public commands without a login (`search`, `get`,
`taxonomy`, `quran`, and `mcp`) and its exit statuses 2, 3, and 4
(`packages/cli/README.md`). The school commands are new. `nakafa login <host>`
starts device authorization against a school host. The school commands then call
the REST API through the typed client of the school `HttpApi`. The token stays on
the device and is never printed.

### Webhooks

| Part | Rule |
| --- | --- |
| Source | The journal. Each webhook has its own cursor over the published changes (ADR 0016), kept the way the notify consumer keeps its cursor (`journalCursors`, ADR 0027), so there is no second cursor table. |
| Payload | The published change and its subject reference: IDs, enums, and reason codes. It holds no names, emails, or text, because the journal holds none. A receiver that needs more reads it through the REST API with its own token. |
| Client | A webhook is made for one integration client. A change is delivered only when that client could read its subject, and the check runs at delivery (ADR 0016). |
| Signature | HMAC-SHA256 over the timestamp, a dot, and the body |
| Secret | Sealed with the school key (ADR 0030) and not hashed, because the server must sign with it |
| Replay | A receiver rejects a timestamp older than 5 minutes (target) |
| Retries | Up to 8 attempts in 24 hours, with growing delays (target) |
| Delivery log | One row for each attempt, in `integrationDeliveries` |
| Idempotency | Every attempt of a change carries the same event ID |
| Receiver address | HTTPS only. A public address only. No redirect is followed. The judgment of addresses is the one of the research scrape guard (`judgeAddress` in `packages/backend/confect/nina/research/url.ts`, which `tools/safety.ts` in the same research folder calls), shared and not copied. |
| Deadline | Each attempt has a deadline that covers the body, and the response is read up to a size cap (ADR 0020). |

The receiver address rule keeps a webhook from being used to reach Nakafa's own
network.

### API hygiene

| Rule | What | Number |
| --- | --- | --- |
| Idempotency | Every POST of the REST API carries `Idempotency-Key`. The token endpoint is not part of it. A repeat with the same key and request returns the first result. The same key with another request gets 422, a repeat still running gets 409, and a missing key gets 400. The record is written by the mutation that makes the change, and a scheduled sweep deletes it, because queries do not read the clock (ADR 0011). | Kept 24 hours (target) |
| Pagination | By cursor, not by page number | 100 rows a page (target) |
| Rate limit | For each client, through the rate-limit component, with the remaining quota in response headers. A refusal is 429 with `Retry-After`, as in the public API. | 600 requests a minute (target, not measured) |
| Documentation | OpenAPI generated from the definition of the routes | One source |
| Embed | A one-time token in an iframe, with `frame-ancestors` for each school, built from the school's list of domains | Waits for that list (see below) |

The statuses for `Idempotency-Key` follow the IETF draft
`draft-ietf-httpapi-idempotency-key-header-07`. That draft has expired and is not
a standard (read 13 October 2026), so this ADR owns the behavior. The public API
today allows 120 requests a minute with a burst of 30 for each client address
(`packages/backend/confect/routes/agent/quota.impl.ts`). Embed needs the list of
web domains that may frame a school page. The tenant record holds none: its one
list of domains is the email domains that a claim admits
(`packages/backend/confect/tenancy/schema.ts` and `policy.ts`). ADR 0011 plans
the school's own domains for later, so embed waits for them.

### Standards are adapters at one seam

An inbound standard forms the roster and the classes. An outbound standard
carries grades. No standard reaches around `decide`.

| Standard | Direction | What Nakafa does | Owner |
| --- | --- | --- | --- |
| OneRoster 1.2 | Roster in, results out | CSV import first, then the REST service for rosters and results | This ADR. The CSV import follows the file import rules of ADR 0015. |
| LTI 1.3 Advantage | Launch, deep linking, grades, members | Nakafa is the tool and the school's learning system is the platform | This ADR |
| QTI 3.0 | Items in and out | A codec over the response contract and the item model | This ADR and ADR 0031 |
| CASE 1.1 | Competencies | Competencies as framework items, linked to the curriculum | Later |
| CLR 2.0 and Open Badges 3.0 | Records and badges out | Across countries, a later step | Later |
| xAPI and Caliper | Analytics out | Only when a learning record store asks. The version is not chosen. | Later |
| Google Classroom | Roster in | Read-only connector | ADR 0015 |
| Microsoft Graph Education | Roster in, assignment grades out | After Google. The school's administrator gives consent. | Later |
| Clever and ClassLink | Roster in | Through OneRoster | Later |
| Microsoft Entra ID and SAML | School identity | After Google | ADR 0009 |
| VIDIS | Identity | Germany. The protocol is not named yet. | ADR 0032 |

Nakafa follows these specifications and claims no 1EdTech certification.
1EdTech lists products that passed its certification, and a claim waits until a
product passes. The license terms for implementers are read before any code is
written. 1EdTech's QTI page states none (read 13 October 2026).

**LTI.** A launch is a login that the platform starts and a signed `id_token`,
under the 1EdTech Security Framework (OAuth 2.0 and JSON Web Tokens). Deep
Linking 2.0 lets a teacher pick Nakafa content inside the learning system.
Assignment and Grade Services 2.0 posts grades, and only grades that a teacher
released. Names and Role Provisioning Services 2.0 is a roster source like
OneRoster. Each school registers its own platform, as school data. A platform
user is identified by the platform's issuer and subject and never by email. How a
launch becomes a session and finds its Person is left to the LTI change. The
launch ends in the Better Auth session of ADR 0009 like every other sign-in path,
and a launch that matches no Person shows the school's sign-in page.

**OneRoster.** The CSV import reads academic sessions, orgs, users, courses,
classes, and enrollments, and keeps the source's `sourcedId` as the identity of
each row, never the email. The REST service and the results that go out come
later. OneRoster 1.2 has Rostering, Gradebook, and Resource services, and CSV
and REST bindings (1EdTech, read 13 October 2026). The blueprint names the
direction of the results but not which side calls, so the first district that
asks decides it.

**QTI.** The codec imports and exports items. QTI is an interchange format, and
the item model of ADR 0031 stays the storage model. The codec reads and writes
that model and nothing else.

- The version is QTI 3.0. The QTI page of 1EdTech dates its Final Release
  Specification 11 May 2022, while the overview and the information model give 1
  May 2022 as their date of issue. The same page lists the information model and
  the XSD binding as 3.0.1, and it lists no 3.1.
- The codec maps the interactions of ADR 0031 for which QTI 3 has a standard form.
  It refuses the others on import and on export with a named reason, and it never
  maps one to a lookalike. An item that QTI 3 offers only as a portable custom
  interaction is refused, and so is an interaction outside the catalog of
  ADR 0031.
- Scoring rules map to the standard response processing (`match_correct` and
  `map_response`) and to `qti-mapping`. A rubric maps to a `qti-rubric-block` with
  `use="scoring"` and `view="scorer"`, because QTI leaves the scoring of extended
  text to a human.
- A shared stimulus is its own resource in the package and the item refers to it
  with `qti-assessment-stimulus-ref`, which matches the Stimulus of ADR 0031.
- Export writes MathML rendered from the stored LaTeX (ADR 0031). Import accepts a
  formula only if it converts to LaTeX without loss, and refuses the item
  otherwise. Nothing is stored half converted.
- The import shows what it refused or did not import before anything is applied,
  in the side-by-side review of ADR 0028. Alternative text of figures is kept.
- Effect has no XML module (`repos/effect/packages/effect/src/encoding` holds
  Base64, Base64Url, Hex, Ini, Ndjson, SchemaBinary, Sse, Toml, and Yaml). The
  codec uses an XML library chosen with its install, after the license, release
  age, and advisory checks, and wrapped once. The research found no QTI package
  published by 1EdTech on npm. Third-party QTI packages exist, one under GPL-3.0
  and one under MIT that says it is not certified, and neither is chosen here.

### Hono and the peers of `convex-helpers`

The HTTP layer is the Confect router with Effect `HttpApi`. Hono is not part of
it. No tracked source file or manifest outside `repos/` imports or declares
`hono` or `zod` (`git grep` on main at `f8a5610808`).

What `pnpm-lock.yaml` holds:

- `hono@4.13.13` is in the lock only as the resolved optional peer of
  `convex-helpers@0.1.128` (`peerDependencies` `hono ^4.0.5`, optional; the
  package exports `server/hono`). The lock names `hono` on 45 lines: two entries
  of its own, one optional dependency of the `convex-helpers` snapshot, the
  `(hono@4.13.13)` suffix of resolution keys and references on 34 lines, and
  eight lines that declare it as an optional peer (the peer declaration of
  `convex-helpers`, two lines, and six `transitivePeerDependencies` lists).
- `zod` is a required peer of `ai@7.0.136` and of the `@ai-sdk` packages
  (`@ai-sdk/provider-utils` and `@ai-sdk/gateway`), and an optional peer of
  `better-call@1.4.0` and of `convex-helpers`. The plan keeps `ai` as the
  dependency of the Agent component, so `zod` stays while `ai` stays, and no
  check names it.
- `convex-helpers` is a peer of `@convex-dev/agent`, `@convex-dev/resend`,
  `@convex-dev/workflow`, and `@convex-dev/workpool`. It is a dependency of
  `@convex-dev/aggregate`, of `@convex-dev/better-auth`, and of
  `@convex-dev/batch-worker` 0.3.3 and 0.3.5, which `aggregate` and
  `@convex-dev/rate-limiter` 0.4.1 each install as a component inside their own
  (`src/component/convex.config.ts`). `packages/backend/package.json` declares
  it too, and an override in `pnpm-workspace.yaml` pins 0.1.128 for every one of
  them. 0.1.128 is its latest release (npm registry, 13 October 2026).

A probe on 13 October 2026 used a scratch copy of the workspace manifests and
pnpm 11.28.5, the pinned version, in lock-only mode, and it ran three ways.

- With the existing lock, `pnpm install --lockfile-only` changes nothing and
  `pnpm dedupe --lockfile-only` changes other packages, so `hono` stays.
- Without a lock, the resolution holds no `hono` package. Eight lines still name
  it, the declarations above.
- Removing from the existing lock the two `hono@4.13.13` entries, the optional
  dependency of the `convex-helpers` snapshot, and the 34 suffixes gave a lock
  with the same eight lines. `pnpm install --frozen-lockfile --lockfile-only`
  accepts it, `pnpm install --lockfile-only` leaves it as it is, and
  `pnpm install --lockfile-only --fix-lockfile`, which resolves again, does not
  bring `hono` back.

So the lock carries `hono` over, and nothing requires it.

The decision:

- Wave A removes the resolved `hono` from `pnpm-lock.yaml`, which leaves the eight
  declaration lines, and proves the result with `pnpm install --frozen-lockfile`.
  No import changes.
- A check fails when `pnpm-lock.yaml` resolves `hono`, that is, when a
  `hono@<version>` key stands in `packages` or `snapshots`. It does not match
  the bare word, because the eight declaration lines stay in a lock without
  `hono`. The dependency validator (`scripts/dependencies/validate.ts`) reads
  manifests and `pnpm-workspace.yaml` today and not the lock, so the check is new
  there and has its own test. It names `hono` only.
- `convex-helpers` and the files that import it stay as they are. The plan said
  to upgrade or replace the package in those files. The probe shows that `hono`
  leaves without that, and the Convex components above keep the package in the
  lock anyway.

The 19 files that import `convex-helpers`:

- `packages/backend/confect/functions.ts`: `customMutation`, `customCtx`, and
  `Triggers`, which wrap every mutation.
- `packages/backend/components/betterAuth/deletion.ts`: `stream`.
- Fourteen trigger files under `packages/backend/confect/triggers`, which import
  only the `Change` type: `chats/chats.ts`, `comments/commentVotes.ts`,
  `comments/comments.ts`, `contents/views.ts`, `forums/postReactions.ts`,
  `forums/posts.ts`, `forums/reactions.ts`, `materials/groups.ts`,
  `schools/classMembers.ts`, `schools/classes.ts`, `schools/members.ts`,
  `schools/schools.ts`, `subscriptions/subscriptions.ts`, and `tryouts/scores.ts`.
  Those in `forums`, `materials`, and `schools` trigger on tables of the old
  School, which the retirement in ADR 0011 removes.
- Three test files: `packages/backend/confect/contents/metrics/apply.test.ts`
  (`getOrThrow`), `packages/backend/confect/privacy/completion.test.ts` and
  `packages/backend/test/content/verify.ts` (`parse`).

## Left to the change that builds it

- The token endpoint: Better Auth's plugins or Nakafa's own, by the conditions
  above, and whether it lives on the school host or on the apex domain of the
  cell. The metadata of the MCP server points to it either way.
- How the forward from the school host is built, and what it costs.
- How a webhook delivery connects to the address it checked, because a name can
  resolve to another address between the check and the connection.
- How an LTI launch becomes a session and finds its Person.
- The XML library of the QTI codec.
- Embed.
- Whether the public routes move to an `HttpApi` definition. This ADR changes
  nothing there. The plan says a copy in `confect/routes/agent` is moved or
  deleted. The two folders hold different layers (the readers and the OpenAPI
  document in `packages/backend/agent`, the Convex routes in
  `packages/backend/confect/routes/agent`), and no copy was found.

## Consequences

- A school integrates without the web app, and no surface has a permission table
  of its own. A new action reaches a surface by naming it in an endpoint, a tool,
  or a webhook, and no surface can exceed what `decide` allows.
- Every call is an HTTP action. Convex limits concurrent actions and HTTP actions
  together (64 on S16 and 512 on S256, its limits page, 13 October 2026), so the
  rate limit of each client also protects the exam traffic that shares the
  deployment.
- The school OpenAPI document is generated, so it cannot drift from the routes.
  The public document is still built by hand.
- A webhook carries no names, emails, or text by construction. Its IDs mean
  something only to a receiver that reads them through the REST API with a token.
- `hono` leaves the lock, and `zod` stays.
- Client secrets are hashes, so a leaked database does not leak a credential.
  The cost is that a lost secret is replaced and not recovered.

## Rejected Alternatives

- Hono for the school routes. `convex-helpers` has a Hono integration, but it
  would add a second HTTP framework beside Effect's router.
- A scope list of its own for the API. It would be a second permission table.
- Static API keys. They live long. Client credentials give short tokens and keep
  only a hash.
- The public bridge for school routes. It deletes the credential.
- A school path on `api.nakafa.com`. The public API never accepts one
  (ADR 0026).
- Hashing the webhook secret. The server must sign with it, so it is sealed.
- A hand-written OpenAPI document for the school API. The public one drifts
  from its routes by hand, and the school one comes from the definition.
- Replacing `convex-helpers` to remove `hono`. The decision on `convex-helpers`
  above gives the reason.

## Implementation Status

| Part | Status |
| --- | --- |
| Public REST `api.nakafa.com/v1` and the OpenAPI document | Live |
| Public MCP `mcp.nakafa.com/mcp` | Live |
| `@nakafa/cli` 0.1.1 | Live, public and read only |
| `effect/http-api` in Nakafa code | Not used yet |
| `integrationClients` and the client registry (the amendment of 14 October 2026) | Built, with no route yet |
| `confect/integrations` (the `HttpApi` definition), `integrationDeliveries` | Planned, program wave C |
| School REST, school MCP, and the CLI login | Planned, program wave C |
| Webhooks and exports | Planned, program wave C |
| LTI, the OneRoster REST service, and the QTI codec | Planned, program wave C |
| The OneRoster CSV import, which uses the file import checks of ADR 0015 | Planned, program wave C |
| `hono@4.13.13` in `pnpm-lock.yaml` | Present. Removal and its check are planned, program wave A. |

## Amendment: Decided on 14 October 2026

These decisions settle the open questions of the school API, and they bind every
slice that follows. The client registry and the decision for a client are built
first. The token endpoint, the bearer middleware, and the routes come later.

1. **Token engine.** `@better-auth/oauth-provider` at the version that matches
   the installed `better-auth`, since both move together. It serves the client
   credentials grant with resource indicators (RFC 8707), introspection, and
   revocation. The registry slice does not add it. The token endpoint slice
   adds it after the package-upgrades lane settles the Better Auth version.
2. **Token format.** A JWT signed with Better Auth's JWT plugin keys, with the
   audience set to the school's API resource (`https://<school host>/api/v1`),
   never `convex`. Convex then never accepts an integration token as a session
   identity.
3. **Location.** The token endpoint and the protected resource metadata live on
   the school host. The cell's Convex site receives them the way it receives
   `/api/v1` and `/mcp` (ADR 0026).
4. **Principal.** The HTTP layer verifies the bearer token and passes a verified
   client principal to internal functions only. No public function takes it.
   `confect/auth/session.ts` stays the one identity policy for people. `decide`
   judges a client principal (`ClientPrincipal` in `confect/access/principal.ts`),
   and `Member` stays a person principal.
5. **Grants.** An `integrationClients` row per client holds its tenant, its scope
   (the tenant, or one unit), its name, an explicit action list, the SHA-256
   digest of its secret (never the secret), its status (`active` or `revoked`),
   and its times. A client holds no `tenantGrants` row, and
   `confect/access/grant.ts` keeps refusing the integration role for people.
6. **First actions.** Roster reads only: `period.view`, `cohort.view`, and
   `person.view` (names and statuses as `PersonView` shows them, with no email).
   The placements of a period are the next read. Invites stay out of the school
   API.
7. **REST shape (next slice).** Flat paths `/periods`, `/cohorts?period=`,
   `/people?status=`, and `/placements?period=`. An opaque cursor. At most 100
   rows a page, clamped in the handler. A rate limit of 600 requests a minute per
   client through `agentRateLimiter`, with its own bucket.

### What the registry slice built

- The `integrationClients` table (`confect/tables/integrationClients.ts`), whose
  validator is `integrationClientValidator` in `confect/integrations/schema.ts`,
  indexed by tenant. The secret digest is `null` when no secret applies, and
  the revocation time is `null` until a client is revoked. Revoking a client
  replaces its digest with `null`, so a revoked client keeps no secret.
- The `integration` kind (`confect/integrations/kinds.ts`). `integration.manage`
  creates a client on the scope it covers (the tenant for a tenant-wide client,
  the unit for a unit client), rotates it, and revokes it. `integration.view`
  lists the clients and reads a client for revocation. Both are opened to the
  Admin, and the Owner holds them through the Owner rule. Its audited changes
  are `integration.created`, `integration.rotated`, and `integration.revoked`.
  They hold IDs and enums only: no name and no secret.
- `integrations/clients:create`, `:rotate`, `:revoke`, and the paginated query
  `:list`. `create` returns the secret once. `list` never returns a digest.
  `create` refuses an action list that names an action the catalog does not open
  to the Integration role, with `ActionClosed`, before it draws a secret.
- The catalog opens the three roster reads to the Integration role, through
  `planReaders` and `person.view` in `confect/tenancy/kinds.ts`. A client's
  action list names only actions that a rule opens to that role
  (`opensTo` in `confect/access/catalog.ts`). The `Action` union leaves out
  entries that declare no action, because Confect cannot compile an empty union
  into a validator.
- `decide` takes the subject's tenant with the subject, so a principal of another
  tenant is refused as `resource`, whichever principal it is. A client of another
  school than the subject's is refused as `resource` too, because a
  `ClientPrincipal` checks its pair only when it is decoded. A client is decided
  by three things: the rule must open the action to the Integration role, the
  action list must name the action, and the scope must cover the subject. The
  usual conditions come first, so a revoked client, a write in a suspended
  tenant, and a write on a locked subject are each refused as `condition`. A
  person's roles and relations never admit a client.

### Not built yet

- The token endpoint, the bearer middleware that turns a token into a client
  principal, and the HTTP routes. Until then no code builds a `ClientPrincipal`
  outside the tests.
- The check of a presented secret. A client secret is a bearer token drawn by
  `issueToken` in `@repo/utilities/token`, the one owner of Nakafa's bearer
  tokens that the chat share link uses too, and the token endpoint checks a
  presented secret with its `matchesToken`, which compares digests in constant
  time.
- Ending the webhooks of a revoked client. Webhooks do not exist yet.

## References

- `@confect/server` 10.1.0, `src/HttpRouter.ts`, and the Confect page on the HTTP
  API (confect.dev/server/http-api).
- Effect 4.0.2, `repos/effect/packages/effect/src/http-api`: `HttpApi`,
  `HttpApiBuilder`, `HttpApiClient`, `HttpApiMiddleware`, `HttpApiSecurity`,
  `HttpApiTest`, and `OpenApi` (OpenAPI 3.1.0).
- RFC 6749 (client credentials), RFC 6750 (bearer tokens), RFC 7009
  (revocation), RFC 8628 (device authorization), RFC 8707 (resource indicators),
  RFC 9457 (problem details), and RFC 9728 (protected resource metadata).
- Model Context Protocol, authorization, version 2026-07-28
  (modelcontextprotocol.io/specification/latest/basic/authorization).
- Better Auth, the OAuth provider and device authorization plugin pages
  (better-auth.com/docs/plugins).
- IETF `draft-ietf-httpapi-idempotency-key-header-07`.
- 1EdTech pages for OneRoster, LTI, and QTI (1edtech.org/standards).
- `pnpm-lock.yaml` and `scripts/dependencies` on main at `f8a5610808`, and the
  npm registry on 13 October 2026.
- ADR 0006, 0009, 0011, 0012, 0015, 0016, 0020, 0026, 0027, 0028, 0030, and
  0031.
