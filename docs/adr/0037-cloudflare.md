# ADR 0037: Nakafa Runs On Cloudflare Workers Free Through Alchemy

## Status

Accepted on 24 October 2026. It supersedes the hosting, delivery, and deployment
decisions in ADR 0007, ADR 0008, ADR 0021 (the deployment policy), and ADR 0029
(the edge Workers). Each of those ADRs carries a note that points here. The Vercel
projects were deleted on 25 October 2026, when Nakafa moved to Cloudflare.

## Context

Nakafa served its web app, public API, MCP endpoint, and CAS service from Vercel.
Its usage charges grew with page views and ISR writes, while the same content is
read by every visitor. Convex is the only database and stays the
source of live data. The owner decided that the hosting must fit Cloudflare
Workers Free at any traffic, with no paid compute, and that Alchemy describes the
infrastructure as code.

Measured on 23 October 2026: Workers Free allows 100,000 Worker requests a day,
10 ms of CPU per request, 128 MB of memory, 50 subrequests, and 20,000 static
asset files per Worker version. Static asset requests are free, unlimited, and
never invoke a Worker.

## Decision

1. **Static first.** Public pages, their Markdown twins, sitemaps, and OG images
   are built into static assets. The Worker runs only what cannot be static:
   signed-in first screens, server functions that need secrets, and host routing.
2. **One stack.** `apps/www/alchemy.run.ts` is the Nakafa Alchemy stack. Its
   stage decides what is deployed:
   - `prod`: the web Worker owns `nakafa.com` as a custom domain and every School
     host through the route `*.nakafa.com/*`. The API and MCP Workers own
     `api.nakafa.com` and `mcp.nakafa.com` through exact routes. The CAS front
     owns `cas.nakafa.com` through an exact route only after its cutover ships
     (decision 7). The zone and its records come from `apps/www/deploy/dns.ts`,
     with the zone adopted.
   - `staging`: the web Worker serves `staging.nakafa.com` behind Cloudflare
     Access for the two owner accounts. Workers.dev is off. Staging runs on the
     dev deployment, which also serves local development at its `SITE_URL`, so
     the dev deployment sets `STAGING_SITE_URL`. Better Auth then answers each
     of the two sites on its own host, with its own callback URL and cookie
     domain, and a checkout may return to either site. Production names its
     session cookie for `nakafa.com`, so the browser sends it to staging and to
     local development as well; both name their cookies `nakafa-dev` instead of
     `better-auth` (`readAuthCookiePrefix`), so production's cookie never reads
     as their session. Staging has no School hosts: a host under
     `staging.nakafa.com` would need a paid certificate.
   - any other stage: only the workers.dev URL, with no custom domain.
3. **Exact routes beat the wildcard.** Cloudflare sends a request to the most
   specific route. The School wildcard never shadows another Worker's host,
   because each such host has its own exact route. Routes win over custom
   domains, so the API, MCP, CAS, and staging hosts use routes, not custom domains.
4. **Edge Workers keep the contract.** The API and MCP Workers forward their
   declared paths to the Convex site with the edge secret. They strip browser
   credentials and name the release in `x-nakafa-release-sha`. The path table and
   the header rules live in `packages/backend/agent`.
5. **Deploy-only CI.** `.github/workflows/deploy.yml` runs on a push to `main` and
   on a workflow dispatch for `staging` or `prod`; an Aksara production release
   dispatches `prod` from `main` with the deploy app's installation token. The job
   runs in the GitHub environment of its stage, and each step names the secrets and
   variables it reads, never the whole `secrets` context. It deploys Convex with
   `CONVEX_DEPLOY_KEY`, then runs `alchemy deploy --stage` with `--yes`. Production
   deploys run only from `main`. The workflow runs no tests, because verification
   runs locally on the exact head.
6. **Secrets come from one operator stack, per environment.**
   `apps/www/stacks/github.ts` is run once by an operator with local credentials.
   It writes a scoped Cloudflare token and the account id to the repository, and
   it declares two GitHub environments, `production` and `staging`. Each environment
   takes its values from its own operator file, a JSON object of names and text
   values that is never committed. Every server value is an environment secret, and
   every `VITE_` value is an environment variable, so staging never receives a
   production value. `CONVEX_DEPLOY_KEY` is the Convex deploy key of each
   environment. CI never runs that stack.
7. **CAS runs as Durable Objects, and its cutover waits for the owner.** The math
   engine in `apps/cas` is a Python Durable Object (`entry.py`, `cas/compute.py`)
   that imports SymPy at deploy time inside the runtime's entropy allowance of 30
   calls. A TypeScript front (`apps/cas/front`) checks the bearer key and forwards
   each call to one of a fixed pool of 16 engine objects. A call has one deadline
   of 20 seconds, which covers its one retry. The front retries once, on another
   object, only for a failure that the platform marks retryable: a transport
   failure or a reset object. It never retries an overloaded object or a missed
   deadline. Before SymPy builds a value, the request Schema (`cas/schema.py`) and
   the parser (`cas/work.py`) refuse a request beyond a bound with 422, and the
   operation that owns a value refuses the rest. Production routes
   `cas.nakafa.com` to the front Worker.
8. **Caching follows the release.** Every rule below is framework-neutral.
   - The content store is one memory store in each isolate, capped at 16 MiB of
     JSON text. An entry over 2 MB is not kept. It holds only what Convex
     answered, under a digest of the store version, the release, the read, and
     its arguments. Each entry lives 30 days under the tag of its release, so a
     new release has new keys and an entry is never stale. A stored `null` stays
     apart from a miss, so a found answer and a missing one are each kept for
     their release.
   - What code derives from an answer, such as a URL or Markdown, is derived after
     the read and is not stored. A change in a derivation takes effect with its
     deploy.
   - The active release pointer is the one read that is not release-keyed. Each
     isolate keeps it for 60 seconds, and the activation route expires it in the
     isolate that serves it. A store miss reads it from Convex again, and a hit
     does not. A pointer that is wrong is dropped by the first read that proves
     it: a miss that finds Convex naming another release, whether its load
     succeeded or failed, or a pinned read that names another release than its pin.
   - Public content documents carry `s-maxage=3600, stale-while-revalidate=86400`,
     so the CDN keeps a document for an hour and serves the stale copy for a day
     while it revalidates. Sitemaps and RSS feeds carry `s-maxage=86400` with the
     same stale day. The sitemap index and pages are derived on every read from
     stored answers, and each read ends with a check of the release against Convex,
     which fails on another release instead of keeping a page as missing.
   - Social images carry `s-maxage=3600, stale-while-revalidate=86400` and no CDN
     tag. An image changes only when its route changes, and a route changes only
     with a release, so the hour bounds how long a stale image can last.
   - A request without a session cookie is a visitor. The route answers it as
     signed out without a network call, so only a request with a session cookie
     reaches Convex.
9. **Every Worker has a readable name.** `workerName` in `apps/www/deploy/stage.ts`
   names each Worker `nakafa-<service>` in production and `nakafa-<service>-<stage>`
   in every other stage: `nakafa-web`, `nakafa-api`, `nakafa-mcp`, `nakafa-cas`,
   and `nakafa-cas-engine` in production, `nakafa-web-staging`, `nakafa-cas-staging`,
   and `nakafa-cas-engine-staging` in staging. Staging's Access application takes
   the name of its Worker. Staging's CAS pair serves the dev deployment, whose
   `MATH_CAS_URL` is `https://nakafa-cas-staging.nakafa.workers.dev`, so Nina's
   math tools work in staging and local development. `alchemy-state-store` is
   Alchemy's own state store, which every deploy reads, and keeps its name.
   - Alchemy plans a changed `name` as a create-first replacement. The new Worker
     cannot take over a route or custom domain that the old one holds, so the
     deploy fails before it moves any traffic. A deployed Worker is renamed in
     place instead: `PATCH /accounts/{account}/workers/workers/{id}` with the new
     name keeps the Worker id, its routes, custom domains, secrets, Durable Object
     namespaces, and the bindings that other Workers hold to them, with no gap in
     traffic (measured on 26 October 2026 on two probe Workers). Then
     `alchemy state rm <stack>/<stage>/<id>` drops each renamed row without
     touching the cloud, and the next deploy adopts each Worker by its
     `alchemy:stack`, `alchemy:stage`, and `alchemy:id` tags. A Durable Object
     namespace keeps the name it was created with; only its owning Worker changes.

## Consequences

- `apps/cas` is a Python Durable Object behind a TypeScript front Worker, and `cas.nakafa.com` is a route of the production zone.
- The production identity is the deploy stage. Each Worker binds the stage that
  its stack deploys as `NAKAFA_DEPLOY_STAGE`. The production checks in
  `packages/backend/content`, the runtime check in `apps/www/src/runtime.ts`, and
  the server error reporting in `packages/analytics` read it.
- Preview deployments are not a merge gate. Verification stays local on the exact
  head, so no previews are created for pull requests.
- A value that a reader requires must be set and non-empty. Each reader's Schema
  decides: a required value that is missing or empty fails the deploy before any
  Worker changes, and the error names the binding and never its value. An optional
  value that is unset, or empty as GitHub passes an unset secret, is neither bound
  nor written, so `OPENWEATHER_API_KEY` and the Aksara preview keys may stay unset.
- Production DNS records, the production Workers, and the nakafa.id zone with its
  redirect rule are retained (`RemovalPolicy.retain`). A stack change that drops
  one leaves the cloud object in place. A plan check in CI is not in place yet.
- The nakafa.id zone, its placeholder records, and its redirect rule are adopted,
  never recreated.
- The deploy token holds its account permissions and its zone permissions in two
  policies. Alchemy keeps the token value in its state, which is accepted: the
  state store writes every resource's state through AES-CTR (`crypto.subtle`
  in `@alchemy.run/cloudflare`, `StateStore/Store.ts`), and that key lives in the
  account Secrets Store, outside the state. The token is never written to the
  repository or to a log.
- The nakafa.id redirect ruleset owns the whole `http_request_dynamic_redirect`
  phase. The stack replaces the rule the operator created by hand with the same
  rule, which is accepted. No other rule may sit in that phase.
- Production never runs `alchemy destroy`. The workflow passes no destroy flag.
- Upgrading to a paid Workers plan needs a measured limit that is hit, recorded
  first in the goals.
- The CAS engine has no subprocess: a Python Worker cannot start one, so the
  engine runs in a Durable Object, and the platform's CPU limit replaces the
  subprocess timeout.
- The engine pins pydantic 2.10.6 instead of 2.13.5, because the Pyodide index for
  Python 3.13 ships only pydantic-core 2.27.2, which Pydantic 2.10 requires
  (`apps/cas/pyproject.toml`). The size bound applies to the canonical request.
  The front reads at most 64 KiB of the raw body, so a compact body above that
  limit is refused even when its canonical form is smaller.
- The bounds limit the work a request causes, not only the length of its text.
  `cas/schema.py` holds every bound value. `cas/work.py` reads the parsed tree
  before SymPy builds it, so `x**+71`, `10**(10**9)`, `((x+1)^70)^70`,
  `(x+y+z)^70`, and `1/(x^70+1)` answer 422 at once, where SymPy would compute
  for minutes or hit the response budget after seconds. The operations refuse
  their own values: `cas/discrete.py` the counts, `cas/probability.py` the
  binomial trials and Poisson event bounds, `cas/series.py` the summation ranges
  and transcendental orders, `cas/matrix.py` the symbolic dimension, and
  `cas/equation.py` the system work and nonlinear systems. SymPy's own output is
  parsed back with `bounded=False`, because SymPy already built it.
- A computed integer may have 30 digits, so `10^30` (31 digits) is refused, as a
  literal integer of that length already was. A polynomial's degree is the total
  degree of its expression, a quotient counts its numerator and denominator
  degrees, and a function value counts as degree zero. The degree rule is
  conservative: it adds the degrees of a quotient's numerator and denominator, so
  `apart((x^70+1)/(x^2+1))` is refused at degree 72.
- The bounds follow the corpus at about ten times its largest value where a
  measured Pyodide worst case allows it. These bounds sit lower or are measured
  differently, because a worst case would otherwise exceed the 20-second deadline:
  - the transcendental series order is 8. The corpus reaches 6, and `exp(exp(x))`
    takes 5.5 seconds of CPython at order 10 and did not finish in 120 seconds at
    order 12.
  - the symbolic matrix dimension is 3. The corpus has no symbolic matrix, and the
    4-by-4 symbolic eigenvalue, eigenvector, and eigen-analysis cases did not
    finish in 120 seconds.
  - the denominator degree is 6. The definite integral of `1/(x^10+1)` takes 7
    seconds of CPython, and `1/(x^70+1)` did not finish in 120 seconds.
  - the system work is 40, equations times distinct symbols. A nonlinear system
    is refused unless it has at most two unknowns and no symbols besides them,
    because a two-unknown nonlinear system with symbolic coefficients did not
    finish in 120 seconds, and neither did three nonlinear unknowns.
  - the Poisson event bound is 100. The corpus reaches 2 in its original bodies,
    and a symbolic rate with an upper bound of 100 takes 0.2 seconds, where 1000
    takes 17 seconds.
  The Measured section records every number behind these bounds.
- The SymPy import allowance is 30 `getentropy` calls, measured with Pyodide 0.28.3
  (the runtime pinned by workerd) on the engine's import chain. SymPy creates three
  unseeded generators at import: two in `sympy/core/random.py` and one in
  `sympy/core/symbol.py`. Each reads 2,496 bytes, which CPython requests in 256-byte
  chunks, so each generator costs 10 calls. `tests/entropy_test.py` counts the three
  generators in a fresh interpreter. The allowance is the runtime's internal context
  `_cloudflare.allow_entropy`, which workers-py uses for packages that seed at
  import (`packages/runtime-sdk/src/_workers_sdk_entropy_import_context.py` in
  `cloudflare/workers-py`, read on 24 October 2026). No Cloudflare page documents
  it for user code. The deploys and the probes accepted it.
- The caller's outer budget in `packages/math/service.ts` is 25 seconds, longer
  than the front's 20-second call deadline, so the front's 503 reaches the caller
  before the caller stops waiting.

## Measured

Each number comes from a CPython run on the owner's Mac, one process per case with
a time limit, or from a probe on Workers Free in a `cas-probe` stage, which was
destroyed afterwards.
Pyodide runs two to three times slower than CPython on the same code, by the
probe's own calibration. A CPython worst case of about 5 seconds therefore leaves
the 20-second deadline its margin.

### Worst cases behind the bounds (CPython, this Mac)

These rows are unbounded runs, measured before the bounds existed to find the
values they set. A row that ends in 422 is a request that the new bounds now refuse
before SymPy builds it, so it costs well under one second.

| Shape | CPython result |
| --- | --- |
| `exp(exp(x))` series, order 8 / 10 / 12 | 0.84 s / 5.5 s / over 120 s |
| `exp(sin(x))` series, order 8 / 12 / 14 / 15 | 0.22 s / 1.3 s / 3.4 to 4.6 s / 12.1 s |
| `exp(sin(x))` series, order 20 | over 150 s |
| Symbolic 3-by-3 `eigen_analysis` / `eigenvectors` / `eigenvalues` | 0.42 s / 0.35 s / 0.11 s |
| Symbolic 4-by-4 `eigen_analysis` / `eigenvectors` / `eigenvalues` | over 120 s each |
| Symbolic 4-by-4 `rref` / `det` / `inverse` | 1.9 s / 0.06 s / 0.15 s |
| Symbolic 5-by-5 `det` / `inverse` | 2.0 s / 2.3 s |
| Linear system, 2 equations, 8 symbols (work 16) | 0.02 s |
| Linear system, 3 equations, 15 symbols (work 45) | 0.04 s |
| Linear system, 4 equations, 24 symbols (work 96) | 0.75 s |
| Linear system, 5 equations, 35 symbols (work 175) | over 170 s (round 2 record) |
| Nonlinear, 2 unknowns, 7 symbols (work 14) | over 120 s |
| Nonlinear, 3 unknowns, 9 parameters (work 36) | over 120 s |
| Nonlinear, 2 unknowns, 30 symbols in a simple structure (work 60) | 0.11 s, now refused for having parameters |
| One unknown of degree 70 with 38 parameters (work 39) | 2.2 s |
| Definite `1/(x^k+1)` on [0, 1], k = 4 / 6 / 8 / 10 / 12 | 1.5 s / 1.6 s / 4.3 s / 7.0 s / 6.0 s |
| Definite `1/(x^70+1)` on [0, 1] | over 120 s |
| `((x+1)^70)^70` expansion | 6.9 s, then 422 for the response size |
| `((x+1)^70+1)^70` expansion | over 110 s |
| `(x+y+z)^70` expansion | 1.6 s, then 422 for the response size |
| `(x+y+z+w)^20` expansion (1,771 terms) | 1.3 s |
| `(x+y+z+w)^30` expansion | 4.0 s, then 422 for the response size |
| `(x+1)^70 * (x+2)^70` expansion (degree 140) | 0.4 s |
| Poisson cumulative, rate 4, upper 1,000 / 1,000,000 | 0.6 s / over 120 s |
| Poisson cumulative, symbolic rate, upper 1,000 / 100 | 17.2 s, then 422 / 0.2 s |
| `10**(10**7)` evaluation (round 2 bypass) | 10.7 s, then 422 for the digit limit |
| `combination(10^6, 5*10^5)` (round 2 review's measurement, not rerun) | 63.9 s, then 422 |

### Corpus replay on Workers (round 3, decision 46; commit b7741ea6b7)

The replay sent 1,070 calls over 214 bodies. Of its 82 cases, 36 are beyond-bound
inputs that must answer 422 in under one second, and 46 are in-bound inputs that
must answer 200 in under twenty seconds. Every bar passed except the corpus bar: one call,
index 91, `solve` of `x^x * (ln(x) + 1) = 0`, answered 503 after one engine
exception on Workers. The probe stopped at that bar, its stage was destroyed, and
no further probe ran on that head. The slowest in-bound input, `H21` (definite
`1/(x^6+1)` on [0, 1]), took 7.9 seconds, about 2.5 times under the 20-second
deadline, so it is the first case to watch if the Workers runtime changes its
speed.

The front Worker's CPU P99 measured 9 ms in the probe telemetry, under the
10 ms limit of Workers Free. The 14 to 16 ms maxima completed with outcome `ok`,
so the telemetry does not show the limit that applies to one invocation. The
margin at P99 is one millisecond: a measured margin, not a proof.

### Index 91 failure and its fix

The cause, read on 25 October 2026 from Workers Logs, is that the solve asks
SymPy whether `x^x` is nonzero. SymPy's `satisfiable()` probes the optional
package `pycosat` through `import_module`, and the probe reaches the zip importer
of `/lib/python313.zip`. In a Durable Object restored from the deploy-time memory
snapshot that archive can no longer be read, so the probe fails with `OSError`
instead of `ImportError`, and SymPy cannot fall back to its own algorithm. The
local replays missed it, because under Node.js and CPython the probe fails with
`ImportError`, as SymPy expects.

The fix refuses every optional package that the vendored SymPy probes and the
engine does not vendor, with `ModuleNotFoundError`. A finder at the front of
`sys.meta_path`, which `entry.py` installs before SymPy is imported, does the
refusing (`apps/cas/cas/backends.py`). `tests/backends_test.py` derives the list
from the SymPy source, so an upgrade that adds a probe fails there. The test
verifies the fix; no Workers probe has run it yet.

## Sources

- Alchemy Cloudflare custom domains, routes, and Access documentation, read from
  the installed `@alchemy.run/cloudflare` 2.0.0-beta.84 source.
- Cloudflare Workers Free limits, measured 23 October 2026.
- Cloudflare Durable Objects error handling: `.retryable` allows a retry on a new
  stub, and `.overloaded` means the operation should not be retried. Read on 25
  October 2026 from `developers.cloudflare.com/durable-objects`.
- SymPy 1.14.0 (`sympy/core/random.py` lines 29 and 40, `sympy/core/symbol.py`
  line 487) for the three unseeded generators. The engine vendors SymPy 1.14.0 and
  mpmath 1.3.0 from PyPI (`apps/cas/pyproject.toml`).
- `cloudflare/workers-py`, `packages/runtime-sdk/src/_workers_sdk_entropy_import_context.py`,
  read on 24 October 2026, for the entropy allowance.
