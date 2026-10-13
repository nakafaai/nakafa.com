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
import, and the Dapodik export itself stays with `confect/connectors`
(ADR 0015).

### REST: one `HttpApi`

One `HttpApi` definition in `confect/integration` declares the groups, endpoints,
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
  client ends its tokens and its webhooks.
- A person approves a device at `harapan.nakafa.com/perangkat` after signing in
  (ADR 0026). The CLI token is scoped to the school API. It is not a session.
- A token issued for the school API is never accepted as a Convex session, and a
  session is never accepted as an API token.

Better Auth already offers the parts of an authorization server, as its pages say
(read 13 October 2026). `@better-auth/oauth-provider` offers `client_credentials`
for machine access, resources under RFC 8707, introspection, revocation, and a
device grant. Its device authorization plugin implements RFC 8628, but in its
standalone form it returns a Better Auth session token, which would give the CLI
the power of a session. So the change that builds the token endpoint reads those
plugins first. It adopts them if they meet these conditions, and otherwise it
writes the endpoint and records here why:

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
it. Each tool is a projection of an action. It calls the same services as REST
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
| Source | The journal. Each webhook has its own cursor over the published changes (ADR 0016). |
| Payload | The published change and its subject reference: IDs, enums, and reason codes. It holds no names, emails, or text, because the journal holds none. A receiver that needs more reads it through the REST API with its own token. |
| Client | A webhook is made for one integration client. A change is delivered only when that client could read its subject, and the check runs at delivery (ADR 0016). |
| Signature | HMAC-SHA256 over the timestamp, a dot, and the body |
| Secret | Sealed with the school key (ADR 0030) and not hashed, because the server must sign with it |
| Replay | A receiver rejects a timestamp older than 5 minutes (target) |
| Retries | Up to 8 attempts in 24 hours, with growing delays (target) |
| Delivery log | One row for each attempt, in `integrationDeliveries` |
| Idempotency | Every attempt of a change carries the same event ID |
| Receiver address | HTTPS only. A public address only. No redirect is followed. The judgment of addresses is the one of the research scrape guard (`packages/backend/confect/nina/research/tools/safety.ts` and `url.ts`), shared and not copied. |
| Deadline | Each attempt has a deadline that covers the body, and the response is read up to a size cap (ADR 0020). |

The receiver address rule keeps a webhook from being used to reach Nakafa's own
network.

### API hygiene

| Rule | What | Number |
| --- | --- | --- |
| Idempotency | Every POST carries `Idempotency-Key`. A repeat with the same key and request returns the first result. The same key with another request gets 422, a repeat still running gets 409, and a missing key gets 400. The record is written by the mutation that makes the change, and a scheduled sweep deletes it, because queries do not read the clock (ADR 0011). | Kept 24 hours (target) |
| Pagination | By cursor, not by page number | 100 rows a page (target) |
| Rate limit | For each client, through the rate-limit component, with the remaining quota in response headers. A refusal is 429 with `Retry-After`, as in the public API. | 600 requests a minute (target, not measured) |
| Documentation | OpenAPI generated from the definition of the routes | One source |
| Embed | A one-time token in an iframe, with `frame-ancestors` for each school, built from the school's list of domains | Not decided here |

The statuses for `Idempotency-Key` follow the IETF draft
`draft-ietf-httpapi-idempotency-key-header-07`. That draft has expired and is not
a standard (read 13 October 2026), so this ADR owns the behavior. The public API
today allows 120 requests a minute with a burst of 30 for each client address
(`packages/backend/confect/routes/agent/quota.impl.ts`). Embed needs a list of the
school's domains, which the tenant record does not hold
(`packages/backend/confect/tenancy/schema.ts`), so it waits for the school's own
domains (ADR 0011).

### Standards are adapters at one seam

An inbound standard forms the roster and the classes. An outbound standard
carries grades. No standard reaches around `decide`.

| Standard | Direction | What Nakafa does | Owner |
| --- | --- | --- | --- |
| OneRoster 1.2 | Roster in, results out | CSV import first, then the REST service for rosters and results | ADR 0015 for the import, this ADR for the rest |
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

- The version is QTI 3.0, a Final Release of 11 May 2022. Its information model
  and XML binding documents are labelled 3.0.1. 1EdTech lists no 3.1.
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
  package exports `server/hono`). It appears as two entries of its own, as one
  optional dependency of the `convex-helpers` snapshot, and in the resolution
  keys and references on 34 lines.
- `zod` is a required peer of `ai@7.0.136` and the `@ai-sdk` packages, and of
  `better-call@1.4.0`. It stays while they stay, so no check names it.
- `convex-helpers` is a peer of `@convex-dev/agent`, `@convex-dev/resend`,
  `@convex-dev/workflow`, and `@convex-dev/workpool`, and 0.1.128 is its latest
  release (npm registry, 13 October 2026). It stays in the lock, so replacing it
  in the files that import it would not remove `hono`, and no newer release
  exists to upgrade to.

A probe on 13 October 2026 used a scratch copy of the workspace manifests and
pnpm 11.28.5, the pinned version, in lock-only mode. Without the existing lock,
the resolution holds no `hono` at all. With the existing lock, `pnpm install`
keeps `hono`. Removing from the existing lock the two `hono@4.13.13` entries, the
`(hono@4.13.13)` suffixes, and the optional dependency of the `convex-helpers`
snapshot gave a lock that `pnpm install --frozen-lockfile --lockfile-only`
accepts and that a plain `pnpm install --lockfile-only` leaves as it is. So the
lock carries `hono` over, and nothing requires it.

The decision:

- Wave A removes `hono` from `pnpm-lock.yaml` and proves the result with
  `pnpm install --frozen-lockfile`. No import changes.
- A check fails when `pnpm-lock.yaml` holds `hono`. The dependency validator
  (`scripts/dependencies/validate.ts`) reads manifests and `pnpm-workspace.yaml`
  today and not the lock, so the check is new there and has its own test. It
  names `hono` only.
- The plan said to upgrade or replace `convex-helpers` in the 19 files that import
  it. The probe shows `hono` leaves without that, and the package stays anyway,
  so the files stay as they are.

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
  Seven of them (`forums` and `schools`) trigger on tables of the old School,
  which the retirement in ADR 0011 removes.
- Three test files: `packages/backend/confect/contents/metrics/apply.test.ts`
  (`getOrThrow`), `packages/backend/confect/privacy/completion.test.ts` and
  `packages/backend/test/content/verify.ts` (`parse`).

## Left to the change that builds it

- The token endpoint: Better Auth's plugins or Nakafa's own, by the conditions
  above, and whether it lives on the school host or on the apex domain of the
  cell. The metadata of the MCP server points to it either way.
- How the forward from the school host is built, and what it costs.
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
- A webhook carries no personal data by construction.
- `hono` leaves the lock, and `zod` stays. The importing code does not change.
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
- Replacing `convex-helpers` to remove `hono`. The package stays in the lock for
  four components, and `hono` is not needed for it.

## Implementation Status

| Part | Status |
| --- | --- |
| Public REST `api.nakafa.com/v1` and the OpenAPI document | Live |
| Public MCP `mcp.nakafa.com/mcp` | Live |
| `@nakafa/cli` 0.1.1 | Live, public and read only |
| `effect/http-api` in Nakafa code | Not used yet |
| `confect/integration`, `integrationClients`, `integrationDeliveries` | Planned, program wave C |
| School REST, school MCP, and the CLI login | Planned, program wave C |
| Webhooks and exports | Planned, program wave C |
| LTI, the OneRoster REST service, and the QTI codec | Planned, program wave C |
| `hono@4.13.13` in `pnpm-lock.yaml` | Present. Removal and its check are planned, program wave A. |

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
- ADR 0006, 0009, 0011, 0012, 0015, 0016, 0020, 0026, 0028, 0030, and 0031.
