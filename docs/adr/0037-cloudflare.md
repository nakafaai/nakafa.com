# ADR 0037: Nakafa Runs On Cloudflare Workers Free Through Alchemy

## Status

Accepted on 24 October 2026. It supersedes the Vercel hosting, delivery, and
deployment decisions in ADR 0007, ADR 0008, ADR 0021 (the Vercel deployment
policy), and ADR 0029 (the Vercel bridges). Each of those ADRs carries a note
that points here.

## Context

Nakafa served its web app, public API, MCP endpoint, and CAS service from Vercel.
Vercel's usage charges grew with page views and ISR writes, while the same
content is read by every visitor. Convex is the only database and stays the
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
     Access for the two owner accounts. Workers.dev is off.
   - any other stage: only the workers.dev URL, with no custom domain.
3. **Exact routes beat the wildcard.** Cloudflare sends a request to the most
   specific route. The School wildcard never shadows another Worker's host,
   because each such host has its own exact route. Routes win over custom
   domains, so the API, MCP, CAS, and staging hosts use routes, not custom domains.
4. **Edge Workers keep the contract.** The API and MCP Workers forward their
   declared paths to the Convex site with the edge secret. They strip browser
   credentials and name the release in `x-nakafa-release-sha`. The path table and
   the header rules live in `packages/backend/agent`, and the Vercel routes are gone.
5. **Deploy-only CI.** `.github/workflows/deploy.yml` runs on a push to `main`, on
   an Aksara release dispatch, and on a manual run for `staging` or `prod`. The job
   runs in the GitHub environment of its stage, and a loader step exports that
   environment's secrets and variables to the job. It deploys Convex with
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

## Consequences

- No Nakafa service runs on Vercel. `apps/cas` is a Python Durable Object behind a TypeScript front Worker, and `cas.nakafa.com` is a route of the production zone.
- The production identity is the deploy stage. Each Worker binds the stage that
  its stack deploys as `NAKAFA_DEPLOY_STAGE`. The production checks in
  `packages/backend/content`, the runtime check in `apps/www/src/runtime.ts`, and
  the server error reporting in `packages/analytics` read it. `VERCEL_ENV` is no
  longer read.
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
  (`apps/cas/pyproject.toml`). Its results matched the Vercel engine's on the test
  corpus. The size bound applies to the canonical request, as the Vercel engine's
  did. The front reads at most 64 KiB of the raw body, so a compact body above that
  limit is refused even when its canonical form is smaller; the Vercel engine
  accepted such a body when its canonical form fit.
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

Each number comes from one of three places: a CPython run on the owner's Mac, one
process per case with a time limit; a probe on Workers Free in a `cas-probe` stage,
which was destroyed afterwards; or the owner's ops notes, which this section marks.
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

### Probe history

Probe 1 (commit 667d981b3e) and probe 2 (commit 3f4a147b87) are from the owner's
ops notes. Their pass-one logs were not kept, so their figures come from the
builder's notes. Probe 1 had no front budget: the 1,015 corpus calls (203 requests,
five rounds) returned 750 with 200 and 265 with 422, with no 1102 or
exceeded-resource outcome. A 59-digit semiprime returned 503 after 43 seconds, and
calls routed to the same pool then timed out at 90 seconds for at least eight
minutes. Probe 2 had a 20-second front budget and the canonical size bound: the
same corpus returned the same 750 and 265, with a client p95 of 1.9 seconds and no
call over 9 seconds. The same semiprime returned 503 at 20 seconds, and one small
call sent alongside it got the same 503 at 20 seconds. The engine's one exception
invocation used 32.5 seconds of CPU, and the calls after it and a 24-call burst all
returned 200.

Three statements of the earlier round 2 record are corrected here.

- The first call on a fresh object is not measured as 6 to 16 seconds. Probe 3's
  first 48 calls, all small, had a p95 of 2.2 seconds and a maximum of 3.7 seconds.
  The 17.3-second and 7.7-second figures of probes 1 and 2 are the slowest
  round-one corpus calls, not cold starts.
- The warm p95 of 2.1 seconds is not set by one request. Of the 812 warm calls,
  about 41 took at least 2.1 seconds, and corpus index 51 contributed at most four
  of them, one per warm round. The tail belongs to the integrate family, whose
  corpus indices 42 to 60 cost 0.3 to 2 seconds of CPython in the round 2 review.
  Index 51 (the integral of `a + x^x`) costs 4 to 5 seconds of Pyodide CPU.
- The round 2 corpus bar, zero failures, passed at the client, but one engine
  exception at 20:05:25 (567 ms of CPU, round one) was absorbed by the front's
  retry. The engine recorded no error text, so its cause is open.

### Probe 3 (round 2, decision 41; commit 9957fced29)

| Bar | Result |
| --- | --- |
| 0 corpus failures | pass at the client; one engine exception absorbed by the retry |
| Beyond every bound answers 422 under 1 s | pass (0.15 to 0.45 s) |
| Burst of 24 concurrent calls, all 200 | pass |
| No hung object 20 minutes later | pass (160 of 160 at 200) |
| Warm p95 under 1.5 s | fail (2.1 s) |
| Cold start p95 under 2 s | fail (2.2 s over 48 calls) |
| In-bound heavy cases under 2 s | fail (two 503 at 50 s, the 7-digit and 30-digit `combination`) |

Probe 3's observability counts are approximate, because the query reports
`statistics.abr_level 1`. The front's CPU median was 2 ms and its P99 11 ms, with
no exception outcome. The 11 ms P99 is above the Free limit of 10 ms, and no
invocation failed, so the sampled P99 does not decide the question. Round 3 asks
the raw events instead.

### Probe 4 (round 3, decision 46; commit b7741ea6b7)

The probe replayed the corpus that `scripts/cpu_budget.py` collects from the
final test suite, 214 bodies after the 10 bodies that the new bound tests send on
purpose, and 82 cases: 36 beyond-bound inputs (B) and 46 inputs that must stay in
bounds (H). A B input must answer 422 in under one second. An H input must answer
200 in under twenty seconds.

Round 3 keeps the round 2 checks and adds decision 46's bars. The probe stopped at
the failed corpus bar, as the lane's rule requires: the probe stage was destroyed,
and no further probe was run on this head.

| Bar | Result |
| --- | --- |
| 36 beyond-bound inputs answer 422 under 1 s | pass: 0.13 to 0.24 s |
| 46 in-bound inputs answer 200 under 20 s | pass: slowest 7.9 s |
| Corpus: no failure in 1,070 calls | **fail**: one 503 in round 4 (index 91), an engine exception |
| Cold start p95 at most 4 s (decision 46 c) | pass: 3.3 s over 48 calls |
| Warm p95 at most 2.5 s (decision 46 c) | pass: 1.8 s over 855 calls |
| Burst of 24 concurrent calls, all 200 | pass |
| 160 calls 20 minutes after the heavy calls, all 200 | pass: 160 of 160 |
| Probe deployed, measured, and destroyed | pass: see Destroy below |

The 36 beyond-bound inputs (B) include the round 2 inputs that stay refused and
the round 2 heavy inputs that the bounds now refuse. All 36 answered 422 in 0.13 to
0.24 seconds. The 46 in-bound inputs (H) all answered 200. The slowest were:

| In-bound input | Seconds on Workers |
| --- | --- |
| `H21`: definite `1/(x^6+1)` on [0, 1] | 7.9 |
| `H14`: one unknown of degree 70 with 38 parameters | 7.1 |
| `H16`: `(x+y+z+w)^20` expansion, 1,771 terms | 5.1 |
| `H10`: symbolic 3-by-3 `eigenvectors` | 4.4 |
| `H02`: `exp(exp(x))` series, order 8 | 3.5 |
| `H_W18`: 200-token rational integral | 3.1 |
| `H22`: definite `1/(a x^4 + b x^2 + c)` | 2.8 |

The margin under the 20-second deadline is about 2.5 times for `H21`, so it is
the first case to watch if the Workers runtime changes its speed.

The corpus replay sent 1,070 calls (214 bodies, five rounds). Warm calls, rounds 2
to 5 (855 calls): p50 0.17 s, p95 1.80 s, p99 4.73 s, maximum 10.41 s (round 5,
index 59). Round one (214 calls): p95 1.83 s. The first 48 calls on fresh objects:
p50 0.20 s, p95 3.26 s, maximum 3.86 s. The burst of 24: p50 0.24 s, p95 1.55 s,
maximum 2.52 s. The 160 calls after 1,197 seconds: p50 0.15 s, p95 1.57 s, maximum
3.73 s, all 200.

Telemetry is approximate: the aggregate queries report `statistics.abr_level 1`,
and the raw events query returns at most 50 events per request, so the raw sample
covers only 152 of the front's invocations. Front Worker, aggregate: 1,330
invocations, CPU median 2 ms, P99 9 ms, maximum 16 ms, wall P99 4.6 s, and 1,334
outcomes, all `ok`. Front Worker, raw events: 152 invocations in four time chunks,
CPU median 2 ms, P99 9 ms, maximum 14 ms, all `ok`. Engine Worker, aggregate: 1,322
invocations, CPU median 10 ms, P99 4.16 s, maximum 8.74 s, and 1,328 outcomes: 1,327
`ok` and one `exception`.

Probe 3 reported a front P99 of 11 ms. Probe 4 measures 9 ms by both methods, which
is under the 10 ms Free limit. The 14 to 16 ms maxima completed with outcome `ok`, so
the telemetry does not show the limit that applies to one invocation. The margin
at P99 is one millisecond, and the front's CPU fit stays a measured margin, not a
proof.

The deploy exited 0 ("Done: 2 succeeded (69.8s)"), and the bearer key did not appear
in the deploy log. The stage was destroyed with exit 0 ("Done: 2 succeeded (5.0s)").
Afterwards the inventory lists only `alchemy-state-store` and its Durable Object
namespace, and the front's workers.dev host answers 404.

The one failed call is corpus index 91, round 4: `solve` of `x^x * (ln(x) + 1) = 0`.
CPython answers 200 with status `inconclusive` in 0.05 s. On Workers the engine
raised one exception (outcome `exception`, one invocation) at 22:14:28.713 UTC, and
the front answered 503 "Math calculation could not complete." in 0.66 s. The front
did not retry, because the failure was not marked retryable, so the round 2 retry
had hidden this failure. The exception text was not recorded, and its cause is
open. Probe 3 recorded one engine exception in corpus round one (567 ms of CPU) and
absorbed it with its retry. That is consistent with the same failure, but probe 3
did not record which body raised it.

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
