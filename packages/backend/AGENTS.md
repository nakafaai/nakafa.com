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

## Parallel Worktree Deployments

Read [Convex Agent Mode](https://docs.convex.dev/cli/agent-mode) before running
Convex from a new worktree. Every concurrent task must select its own local
backend or short-lived cloud dev deployment; never develop against Nakafa's
shared personal dev deployment. Prefer local Agent Mode for isolated builds,
content reads, and database rehearsals. Local deployments support explicitly
configured environment values and local HTTP. Use cloud dev when the task
needs public inbound traffic, project-default environment values, or an
integration unavailable locally. Scope its deploy key to that deployment and
set an expiration. Use the repository's pnpm CLI and never print secrets.

Agent Mode isolates new development only. Existing workflows and scheduled
functions remain on the deployment where they started, and shared-dev or
production data/deploy windows still require explicit read-only proof and
coordination.

For cloud development, first resolve the actual team and project slugs. From
the repository root, create and select an expiring worktree deployment:

```sh
worktree_name=$(basename "$PWD")
pnpm --dir packages/backend exec convex deployment create \
  "$convex_team:$convex_project:dev/$USER-codex/$worktree_name" \
  --type dev \
  --select \
  --expiration "in 5 days"
pnpm --dir packages/backend exec convex deployment token create agent-token --save-env
pnpm --dir packages/backend exec convex dev --once
```

For a new isolated local worktree, initialize the backend, set the required
local environment values, then compile:

```sh
CONVEX_AGENT_MODE=anonymous pnpm --dir packages/backend exec convex init
CONVEX_AGENT_MODE=anonymous pnpm --dir packages/backend exec convex env set --from-file <local-environment-file>
CONVEX_AGENT_MODE=anonymous pnpm --dir packages/backend exec convex dev --once
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
