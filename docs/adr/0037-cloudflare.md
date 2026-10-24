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
   an Aksara release dispatch, and on a manual run for `staging` or `prod`. It
   deploys Convex with the matching deploy key, then runs `alchemy deploy --stage`
   with `--yes`. Production deploys run only from `main`. The workflow runs no
   tests, because verification runs locally on the exact head.
6. **Secrets come from one operator stack.** `apps/www/stacks/github.ts` is run
   once by an operator with local credentials. It writes a scoped Cloudflare token,
   the account id, the Convex production and staging deploy keys, and every server
   value that a Worker binds to GitHub Actions secrets, each read through an Effect
   `Config` at run time. CI never runs that stack.
7. **CAS runs as Durable Objects, and its cutover waits for the owner.** The math
   engine in `apps/cas` is a Python Durable Object (`entry.py`, `cas/compute.py`)
   that imports SymPy at deploy time inside the runtime's entropy allowance of 30
   calls. A TypeScript front (`apps/cas/front`) checks the bearer key and forwards
   each call to one of a fixed pool of 16 engine objects. The front waits at most
   25 seconds for an object. After a 503 or a missed deadline it asks one other
   object once, and it answers 503 when both fail. The request Schema refuses a
   request beyond a complexity bound with 422 before SymPy runs. The production
   route for `cas.nakafa.com` and the removal of its Vercel record wait for the
   owner's decision on the measured results under Measured.

## Consequences

- Vercel serves `www` until its cutover, and the Vercel Preview prohibition in
  `AGENTS.md` stays until then. Until the CAS cutover ships, `cas.nakafa.com`
  still answers from Vercel. This branch deletes `apps/cas/vercel.ts`, the
  FastAPI entry, and the subprocess worker, so the branch is held until the owner
  accepts the cutover.
- The production identity is the deploy stage. Each Worker binds the stage that
  its stack deploys as `NAKAFA_DEPLOY_STAGE`. The production checks in
  `packages/backend/content`, the runtime check in `apps/www/src/runtime.ts`, and
  the server error reporting in `packages/analytics` read it. `VERCEL_ENV` is no
  longer read.
- Preview deployments are not a merge gate. Verification stays local on the exact
  head, so no previews are created for pull requests.
- Every value that a Worker binds must be set. GitHub passes an unset secret as an
  empty string, so the stack refuses an empty bound value before any Worker
  changes. The error names the binding and never its value.
- Production DNS records, the production Workers, and the nakafa.id zone with its
  redirect rule are retained (`RemovalPolicy.retain`). A stack change that drops
  one leaves the cloud object in place. A plan check in CI is not in place yet.
- The nakafa.id zone, its placeholder records, and its redirect rule are adopted,
  never recreated. This branch removes the DNS-only `cas` CNAME to Vercel and
  adds the CAS front's production route. The route wins over the proxied
  wildcard for `cas.nakafa.com`. Both steps are the cutover, so they wait for the
  probe.
- The deploy token holds its account permissions and its zone permissions in two
  policies. Alchemy keeps the token value in its encrypted state. The owner must
  confirm this accepted risk, and the alternative is a token created outside
  Alchemy.
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
- The complexity bounds in `cas/schema.py` are ten times the largest value in the
  test corpus: 30 digits in one integer (corpus 3), exponent 70 (corpus 7), 200
  expression tokens (corpus 20), matrix dimension 30 (corpus 3), derivative order
  20 (corpus 2), and series order 60 (corpus 6). A request beyond a bound answers
  422 before SymPy runs. The bounds limit the length of an input, not the work it
  causes: the in-bound inputs listed under Measured round 2 exceed two seconds of
  engine CPU, so the derivation's worst-case claim does not hold for them.
- The SymPy import allowance is 30 `getentropy` calls, measured with Pyodide 0.28.3
  (the runtime pinned by workerd) on the engine's import chain. SymPy creates three
  unseeded generators at import: two in `sympy.core.random` and one in
  `sympy.core.symbol`. Each reads 2,496 bytes, which CPython requests in 256-byte
  chunks, so each generator costs 10 calls. The runtime fails the import when the
  count is short or over.
- The caller's outer budget in `packages/math/service.ts` is 25 seconds, equal to
  the front's deadline. A retry after a missed deadline therefore starts after the
  caller has stopped waiting, so only the 503 path is retried in time. That
  service's comment still names a 20-second engine limit.
- Measured on Workers Free in two probe stages, each removed afterwards. The engine
  uploads about 33.3 MB uncompressed, under the 64 MiB limit. SymPy loads on the
  first request, because a Worker may not draw randomness while it starts, so the
  first call on a fresh object takes 6 to 16 seconds and about 7 seconds of CPU.
  Probe 1 (commit 667d981b3e, no front budget): the 1,015 corpus calls (203 requests,
  five rounds) returned 750 with 200 and 265 with 422, with no 1102 or
  exceeded-resource outcome. A 59-digit semiprime returned 503 after 43 seconds, and
  calls routed to the same pool then timed out at 90 seconds for at least eight
  minutes.
  Probe 2 (commit 3f4a147b87, a 20-second front budget and the canonical size bound):
  the same corpus returned the same 750 and 265, with a client p95 of 1.9 seconds and
  no call over 9 seconds. The same semiprime returned 503 at 20 seconds, and one
  small call sent alongside it got the same 503 at 20 seconds. The engine's
  one exception invocation used 32.5 seconds of CPU, and the calls after it and a
  24-call burst all returned 200. The front used a median of 2 ms CPU (P99 5 ms). The
  engine used a median of 6 ms CPU, and its successful invocations peaked at 7.2
  seconds of CPU.

- Measured in round 2 (commit 9957fced29, decision 41) in a third probe stage, which
  was destroyed afterwards. The corpus returned the same 750 calls with 200 and 265
  with 422, and no other status. Client wall time over the corpus was 0.19 s p50,
  2.1 s p95 and 15.8 s max. The seven requests beyond a bound answered 422 in 0.15 to
  0.45 seconds. A burst of 24 concurrent calls returned 24 times 200. 160 calls made
  20 minutes after the heavy calls all returned 200. A 30-digit semiprime answered 200
  in 1.1 seconds. The 7-digit `combination(10^6, 5*10^5)` and the 30-digit
  `combination(10^29, 5*10^14)` each returned 503 after 50 seconds, which is two
  25-second attempts. The probe misses two bars: the warm p95 is 2.1 seconds against
  1.5, and the first 48 calls on fresh objects reached 3.7 seconds against 2. The
  corpus integral of `a + x^x` on [0, 1] costs about 4 to 5 seconds of CPU in
  Pyodide, so the warm p95 is set by the corpus itself.
- Inside the bounds, Pyodide 0.28.3 (one process per case, 90-second limit) finished
  these in more than two seconds of CPU or did not finish: a 7-digit `combination`
  (69 seconds; the 6-digit case takes 0.6 seconds), a 30-digit `combination` with
  k = 5*10^14 (over 90 seconds), a binomial CDF with n = 10^6 (over 90 seconds), a
  harmonic summation to 10^9 (over 90 seconds), a 30 by 30 symbolic determinant (over
  90 seconds), `series(exp(sin(x)))` to order 60 (over 90 seconds),
  `series(log(1+x)/(1+x^2))` to order 60 (6.3 seconds), and a 200-token rational
  integral (2.7 seconds). Every other measured in-bound family finished in 1.2 seconds
  or less. Workers telemetry for the probe (approximate counts): the engine's CPU
  median was 9 ms, its P99 4.1 seconds and its max 32.5 seconds. Seven engine
  invocations ended with outcome `exception`. Four stopped at the platform CPU limit
  near 32 seconds of CPU, which are the four attempts of the two heavy calls, so the
  limit ended that work and the objects kept answering. One used 0.6 seconds during
  corpus round 1, and two ended within 1 ms. The events record no error text. The
  front answered 503 for the two heavy calls after both attempts, and no corpus or
  late-check call got a 503, so its retry absorbed the other failures. The front's
  CPU median was 2 ms and its P99 11 ms, with no exception. The probe data is in the owner's ops notes
  (`cas-probe-3.json`).

## Sources

- Alchemy Cloudflare custom domains, routes, and Access documentation, read from
  the installed `@alchemy.run/cloudflare` 2.0.0-beta.84 source.
- Cloudflare Workers Free limits, measured 23 October 2026.
