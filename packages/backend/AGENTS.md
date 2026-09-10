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
pnpm --dir packages/backend exec convex dev --once
```

Use `convex codegen` for binding-only refreshes. Use the repository's pnpm CLI
and never print secrets. Never copy `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`,
or generated Convex URL values out of this checkout. Production deploys only
through the existing promote flow, never from a dev command. Reach for an
isolated expiring Agent Mode deployment whenever it is the better tool for
the job, such as risky schema or function changes, destructive rehearsals, or
parallel work that must not disturb the main dev loop. No explicit request
needed.

## Nakafa Convex Architecture Rules

Keep Convex route files focused on registered Convex functions. Move shared
domain implementation into capability folders using plain filenames like
`impl.ts`, `spec.ts`, or `internal.ts`; do not create prefix-suffixed files such
as `public.impl.ts` or `mutations.impl.ts`.

Use the Confect spec/impl split as structural inspiration, adapted to Convex
routing with folder-owned `spec.ts`, `impl.ts`, and `internal.ts` files instead
of prefix-suffixed filenames:

- https://confect.dev/concepts/spec-impl-model
- https://confect.dev/concepts/file-naming-conventions

Prefer one clear capability token per Convex folder or filename. CamelCase
domain terms such as `assistantResponses` are acceptable when they name one
established concept; ambiguous generic names or compound prefix/suffix
filenames are not.

Prefer direct imports from the owning module. Do not add barrel re-exports or
compatibility routes when callers can import the concrete capability directly.

Use shared validators and helpers from `convex/lib/`. Start authentication and
app-user resolution from `convex/lib/helpers/auth.ts`; do not reach for raw
`ctx.auth` patterns first.

Do not leave one-off migration, backfill, repair, maintenance, dead, redundant,
or legacy code/data paths behind. After verifying dev and prod data, delete the
obsolete Convex function and its tests before considering the work complete.

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

Domain validators and schema modules own backend value sets. Derive types from
Convex `Infer<typeof validator>`, generated `Doc<>` and `Id<>` types, or
generated function argument/return types; do not duplicate unions for locales,
route kinds, content kinds, or graph identity fields.

Every Convex function needs validators and the narrowest public/internal
visibility that fits. Use indexed, paginated, or `.take()` bounded reads for
production paths, keep writes transactional in mutations, reserve actions for
external side effects, and never rely on client-side auth-only filtering.
