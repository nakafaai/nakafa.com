# Backend scripts

These scripts operate filesystem content projections and verify customer
state. Package scripts in `packages/backend/package.json` are the command
source of truth.

## Content ownership

Aksara is the authored source and signed publisher for the activated article,
material, learning-program, Quran, and try-out families. Nakafa accepts verified
signed releases and owns their runtime read models plus durable learner state.

The filesystem sync surface exists only for local projections that have not yet
been deleted after cutover. It cannot create, repair, or replace an Aksara
release. Never edit a local cutover copy as authored source.

## Development setup

Read [`../AGENTS.md`](../AGENTS.md) and use an isolated Agent Mode deployment.
From the repository root:

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

The selected deployment and its generated URLs belong only to that worktree.
Do not copy Convex deployment identity from another task.

## Validation and sync

Use the package scripts below for the remaining filesystem projection surface:

```sh
pnpm --filter @repo/backend sync:validate
pnpm --filter @repo/backend sync:verify
pnpm --filter @repo/backend sync
pnpm --filter @repo/backend sync:incremental
```

- `sync:validate` checks local projection input without writing Convex.
- `sync:verify` compares filesystem projections with the selected deployment.
- `sync` performs a full clean, sync, verification, and cache invalidation pass.
- `sync:incremental` uses the last successful Git revision and does not accept
  `--locale` because its state is shared across locales.

These commands are not part of signed Aksara publication. Use the Aksara
preview, release, rollback, and local runtime workflow for activated content.

Use `--locale en` or `--locale id` only with full, validate, verify, or clean
operations. Use `--sequential` only for debugging one full sync.

## Production

Production commands require an approved deployment and data window. Re-run the
read-only validation and dry-run gates immediately before any write:

```sh
pnpm --filter @repo/backend sync:validate
pnpm --filter @repo/backend sync:prod:verify
pnpm --filter @repo/backend deploy
pnpm --filter @repo/backend sync:prod
pnpm --filter @repo/backend sync:prod:verify
```

Never deploy a worktree that would remove another task's active schema or
indexes. Use the Convex CLI deletion guard and inspect the exact diff first.

## Destructive operations

Reset and clean commands are dry-run unless `--force` is present:

```sh
pnpm --filter @repo/backend sync:clean
pnpm --filter @repo/backend sync:reset
pnpm --filter @repo/backend sync:reset:analytics
```

Production variants use the `sync:prod:*` scripts. Do not run them without an
approved window, exact row-count proof, a recovery plan, and post-write
verification. `--authors` extends a full reset to authors.

The full reset deletes only rebuildable local content projections. It preserves
signed publication state, learning-program identity, views, recents, try-out
access, entitlements, attempts, progress, placements, responses, scores,
calibration runs, IRT scales, and free-attempt claims. Analytics has a separate
explicit reset command.

## Customer verification

```sh
pnpm --filter @repo/backend customers:verify
pnpm --filter @repo/backend customers:verify:prod
```

These commands verify user, customer, and subscription cohesion without
changing content ownership.

## Files

- `sync-content.ts` is the CLI boundary.
- `sync-content/` owns validation, projection, Convex calls, cleanup, and
  verification until final filesystem sync deletion.
- `customers/verify.ts` verifies customer state.
- `.sync-state.json` and `.sync-state.prod.json` are ignored incremental state.
