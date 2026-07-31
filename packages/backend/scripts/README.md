# Backend scripts

These scripts operate filesystem content projections and verify customer
state. Package scripts in `packages/backend/package.json` are the command
source of truth.

## Content ownership

Aksara owns the activated article, material, and learning-program scopes.
The current full and incremental orchestrators still traverse their local
copies while final repository cleanup is pending. Those writes do not own the
active Aksara runtime and must not be used to publish or repair an activated
scope.

Until their coordinated cutovers complete, Nakafa still owns:

- try-out catalogs, question prompts, answers, choices, and IRT projections;
- Quran source, search, Tafsir, and related read models.

After each remaining scope moves to Aksara, delete its sync implementation,
reset commands, tests, and documentation in the same migration.

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

Use the scope command for content that Nakafa still owns:

```sh
pnpm --filter @repo/backend exec tsx scripts/sync-content.ts quran
pnpm --filter @repo/backend exec tsx scripts/sync-content.ts tryouts
```

The broad commands below still include cutover copies and exist only until the
remaining scope cutovers and final sync deletion finish:

```sh
pnpm --filter @repo/backend sync:validate
pnpm --filter @repo/backend sync:verify
pnpm --filter @repo/backend sync
pnpm --filter @repo/backend sync:incremental
```

- `sync:validate` checks authored source without writing Convex.
- `sync:verify` compares filesystem projections with the selected deployment.
- `sync` performs a full clean, sync, verification, and cache invalidation pass.
- `sync:incremental` uses the last successful Git revision and does not accept
  `--locale` because its state is shared across locales.

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
pnpm --filter @repo/backend sync:reset:audio
pnpm --filter @repo/backend sync:reset:tryouts
```

Production variants use the `sync:prod:*` scripts. Do not run them without an
approved window, exact row-count proof, a recovery plan, and post-write
verification. `--authors` extends a full reset to authors. Try-out and audio
resets deliberately clear incremental state and must be followed by a full
sync, never an incremental sync.

`tryoutFreeAttemptClaims` is durable account state and is not reset with
try-out content.

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

Authored source paths remain under `packages/contents/question-bank`,
`packages/contents/tryout`, and the Quran source modules until their Aksara
cutovers complete.
