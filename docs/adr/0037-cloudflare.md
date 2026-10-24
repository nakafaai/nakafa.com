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
     `api.nakafa.com` and `mcp.nakafa.com` through exact routes. The zone and its
     records come from `apps/www/deploy/dns.ts`, with the zone adopted.
   - `staging`: the web Worker serves `staging.nakafa.com` behind Cloudflare
     Access for the two owner accounts. Workers.dev is off.
   - any other stage: only the workers.dev URL, with no custom domain.
3. **Exact routes beat the wildcard.** Cloudflare sends a request to the most
   specific route. The School wildcard never shadows another Worker's host,
   because each such host has its own exact route. Routes win over custom
   domains, so the API, MCP, and staging hosts use routes, not custom domains.
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
7. **CAS runs as Durable Objects.** The math engine in `apps/cas` is a Python
   Durable Object (`entry.py`, `cas/compute.py`), and a TypeScript front on
   `cas.nakafa.com` (`apps/cas/front`) checks the bearer key and forwards each
   call to one of a fixed pool of engine objects. Each object runs one calculation
   at a time under the platform's CPU limit. The measurement that decided this
   design is recorded in the pull request that introduced it.

## Consequences

- Vercel serves `www` until its cutover, and the Vercel Preview prohibition in
  `AGENTS.md` stays until then. CAS runs on Cloudflare, and no Vercel file or
  package remains in `apps/cas`.
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
  never recreated. `cas.nakafa.com` has no record of its own: the proxied wildcard
  answers it, and the CAS front's route wins over the wildcard.
- The deploy token holds its account permissions and its zone permissions in two
  policies. Alchemy keeps the token value in its encrypted state. The owner must
  confirm this accepted risk, and the alternative is a token created outside
  Alchemy.
- Production never runs `alchemy destroy`. The workflow passes no destroy flag.
- Upgrading to a paid Workers plan needs a measured limit that is hit, recorded
  first in the goals.
- The CAS engine has no subprocess: a Python Worker cannot start one, so the
  engine runs in a Durable Object with SQLite storage, the only storage a Free
  Durable Object has.

## Sources

- Alchemy Cloudflare custom domains, routes, and Access documentation, read from
  the installed `@alchemy.run/cloudflare` 2.0.0-beta.84 source.
- Cloudflare Workers Free limits, measured 23 October 2026.
