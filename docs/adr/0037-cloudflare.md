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
7. **Python CAS waits for measurement.** `apps/cas` keeps its FastAPI service. Its
   CPU per request is measured by `apps/cas/scripts/cpu_budget.py` against the 10 ms
   Free limit before any Worker is written for it.

## Consequences

- Vercel stays for CAS only, until its Cloudflare replacement ships. `apps/cas`
  keeps `vercel.ts`, its `[tool.vercel]` entry, and its `@vercel/config`
  devDependency, and `cas.nakafa.com` keeps its Vercel DNS target. The Vercel
  Preview prohibition in `AGENTS.md` stays until then. Every other Vercel file,
  package, and ignore entry is removed.
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
  never recreated. `cas.nakafa.com` keeps a DNS-only record to its Vercel target
  until the CAS Worker replaces it.
- The CAS Python Durable Object moves in its own pull request, which merges after
  the Cloudflare stack. The CAS files stay as they are until then.
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
- The Python CAS Worker is not deployed yet. Its compute runs a subprocess, which a
  Python Worker cannot start, so the measurement decides the next step.

## Sources

- Alchemy Cloudflare custom domains, routes, and Access documentation, read from
  the installed `@alchemy.run/cloudflare` 2.0.0-beta.84 source.
- Cloudflare Workers Free limits, measured 23 October 2026.
