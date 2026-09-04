# Backend scripts

These scripts verify signed content releases and durable customer state.
Package scripts in `packages/backend/package.json` are the command source of
truth.

## Signed content ownership

Aksara is the authored source and signed publisher for article, material, Page,
question, learning-program, Quran, and try-out content. Nakafa accepts verified
signed releases and owns their runtime read models plus durable learner state.

Aksara releases are the only content publication input. Nakafa does not own a
filesystem publication, repair, reset, or fallback path.

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

## Signed runtime validation

```sh
pnpm --filter @repo/backend runtime:ci fingerprint
```

`runtime:ci` requires an explicit mode. The validation, export, and import modes
preserve the current signed runtime workflow. `produce` stores one encrypted
archive for an active runtime selection, and `download` restores that exact
archive. These modes never publish or repair authored content.

## Customer verification

```sh
pnpm --filter @repo/backend customers:verify
pnpm --filter @repo/backend customers:verify:prod
```

These commands verify user, customer, and subscription cohesion without
changing content ownership.

`customers/verify.ts` is a read-only operational integrity check. It does not
change customer, subscription, or content state.
