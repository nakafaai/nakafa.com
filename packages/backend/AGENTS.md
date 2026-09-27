<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Use the enabled official Convex plugin for generic workflows and read the
generated guideline above for installed API facts. Nakafa's repository guides
still own Effect, auth, pnpm, architecture, and deployment policy. Do not
install standalone repository or package-local Convex skill copies.

<!-- convex-ai-end -->

## Main Dev Deployment

Develop directly against the main dev deployment selected in
`packages/backend/.env.local` (`CONVEX_DEPLOYMENT`). It lives in the same
Nakafa project as production, so keep the two cohesive: same functions and
schema as `main`, verified signed content only, no throwaway experiments left
behind. The normal loop is the repository's pnpm CLI:

```sh
pnpm --dir packages/backend setup
```

Run `pnpm --dir packages/backend codegen` before a Convex binding refresh. Confect
owns the authored contract generation; Convex owns `convex/_generated`, including
the static client API. `pnpm acceptance:prepare` and `pnpm acceptance:build`
refresh these bindings against the owned local backend. CI verifies the result
before building consumers. Use the repository's pnpm CLI
and never print secrets. Never copy `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`,
or generated Convex URL values out of this checkout. Production deploys through
Vercel's Git integration after a protected merge to `main`; the configured
production build deploys Convex before building the web app. Never deploy
production from a dev command. Reach for an
isolated expiring Agent Mode deployment whenever it is the better tool for
the job, such as risky schema or function changes, destructive rehearsals, or
parallel work that must not disturb the main dev loop. No explicit request
needed.

Run one-off inspection and diagnostic queries against the dev or an Agent Mode
deployment, never production. An ad-hoc query is an unbounded read until it is
bounded, so give it `.take()`, pagination, or `maximumBytesRead` before it
touches a real dataset.

## Nakafa Convex Architecture Rules

Confect v10 owns the backend contract, registration, schema, middleware, and
cron generation. Author application code in `confect/`. `confect/_generated/`
and `convex/` are generated, except the Convex-managed `convex.config.ts`,
`tsconfig.json`, and generated AI guidance. Never edit generated functions,
IDs, document registries, validators, or references by hand.

- `confect/tables/<table>.ts` owns each `Table.make` definition and its indexes.
- `<capability>.spec.ts` declares `GroupSpec` and `FunctionSpec`. Keep value
  imports limited to contracts, schema definitions, and pure domain constants.
  A client contract must not initialize SDK clients, read secrets, import a
  database implementation, or start an Effect runtime.
- `<capability>.impl.ts` provides named `Effect.fn` handlers through
  `FunctionImpl` and `GroupImpl`. Compose effects inside domain capabilities;
  the Confect registration owns execution at the Convex boundary.
- Use generated IDs, document types, references, and context services from
  `confect/_generated/`. Use `DatabaseReader` and `DatabaseWriter` for decoded
  domain values. SDK component factories may use Confect's plain Convex
  provenance when the SDK owns the registration or callback contract.
- Apply the atomic middleware to mutations that require the application
  triggers. It provides the same wrapped database to the Convex context and
  both Confect database services. Keep dependent writes in one transaction.
- Keep schemas lossless. Confect patching decodes and replaces a whole
  document, so overlapping object unions may discard valid fields. Give
  alternatives exclusive domain discriminants and verify retained data
  round trips before changing a stored contract.

Use the installed Confect v10 source and matching documentation:

- https://confect.dev/v10/concepts/project-structure
- https://confect.dev/v10/concepts/file-naming-conventions
- https://confect.dev/v10/server/plain-convex-functions

Prefer one clear capability token per folder or filename. CamelCase domain
terms such as `assistantResponses` are acceptable when they name an
established concept. `.spec.ts` and `.impl.ts` are Confect-owned conventions.
Import the owning module directly; do not add facade modules or re-exports.

Start authentication and app-user resolution from
`confect/auth/session.ts`; do not add a second identity policy.

The root development command runs Confect generation and Convex watching
through Turborepo. Setup, deployment, typechecking, tests, and production
acceptance generate contracts before consuming them. CI rejects generated
output that differs from the committed source.

Do not leave one-off migration, backfill, repair, maintenance, dead, redundant,
or legacy code/data paths behind. After verifying dev and prod data, delete the
obsolete Convex function and its tests before considering the work complete.

History retention and compaction decide which stored releases must stay
reachable, so they read small stored reachability facts (release identity, base
identity, origin, renderer identity, and snapshot transitions) written beside
each release. They never parse or decode the signed content contract, because a
contract generation change must not be able to strand the cleaner that retires
old history. Content readers stay strict, and an unprovable reachability fact
protects all stored history instead of risking deletion.

Every public Convex function used by a deployed client is a rollout contract.
Renames and removals use expand, switch, observe, contract: deploy the successor
while the predecessor remains, switch every consumer, verify the predecessor
has no readers for an explicit migration-owned observation window, then remove
it and every temporary migration artifact. A promoted web deployment is not
proof that older browser clients stopped calling the predecessor. Temporary
compatibility needs an owner, exit criterion, and cleanup change.

## Type And Convex Source Of Truth

Convex is the typed transactional source for app state and graph read models.
Aksara signed snapshots are the exclusive authored input for every content
scope. `packages/contents` contains no authored source and is never a Convex
publication input. Do not make the Aksara corpus path layout the app-state
identity.

Domain Effect schemas own backend value sets. Derive types from those schemas
and Confect generated documents and references. Convex generated types describe
the encoded wire and component boundary; Confect types describe decoded domain
values. Do not duplicate unions for locales, route kinds, content kinds, or
graph identity fields, and do not cast stored strings into SDK-branded IDs.

Every Convex function needs validators and the narrowest public/internal
visibility that fits. Use indexed, paginated, or `.take()` bounded reads for
production paths, keep writes transactional in mutations, reserve actions for
external side effects, and never rely on client-side auth-only filtering.
