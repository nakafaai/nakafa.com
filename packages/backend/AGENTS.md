<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Nakafa keeps one canonical Convex skill surface in root `.agents/skills`.
Do not install package-local skill copies.

<!-- convex-ai-end -->

## Parallel Worktree Deployments

Read [Convex Agent Mode](https://docs.convex.dev/cli/agent-mode) before running
Convex from a new worktree. Every concurrent task must select its own local
backend or short-lived cloud dev deployment; never develop against Nakafa's
shared personal dev deployment. Use cloud dev when the task needs environment
variables, inbound HTTP, crons, or external integrations, and create a deploy
key scoped only to that deployment. Use the repository's pnpm CLI boundary,
set required environment values without printing secrets, and give temporary
cloud deployments an expiration.

Agent Mode isolates new development only. Existing workflows and scheduled
functions remain on the deployment where they started, and shared-dev or
production data/deploy windows still require explicit read-only proof and
coordination.

Nakafa is pnpm-only. From the repository root, create and select one expiring
cloud dev deployment for a worktree with:

```sh
worktree_name=$(basename "$PWD")
pnpm --dir packages/backend exec convex deployment create \
  "dev/$USER-codex/$worktree_name" \
  --type dev \
  --select \
  --expiration "in 5 days"
pnpm --dir packages/backend exec convex deployment token create agent-token --save-env
pnpm --dir packages/backend exec convex dev --once
```

Use a local deployment instead when HTTP ingress, project environment values,
and hosted integrations are unnecessary:

```sh
pnpm --dir packages/backend exec convex deployment create local --select
pnpm --dir packages/backend exec convex dev --once
```

The deployment selection and URLs are worktree-owned. Never copy
`CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY`, or generated Convex URL values from
another worktree. Copy other ignored application environment files only when
the task needs them, byte-for-byte from the canonical checkout, without
printing secrets.

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

Do not leave one-off migration, backfill, repair, maintenance, dead, redundant,
or legacy code/data paths behind. After verifying dev and prod data, delete the
obsolete Convex function and its tests before considering the work complete.

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
