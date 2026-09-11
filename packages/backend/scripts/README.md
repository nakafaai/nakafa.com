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

Develop directly against the main dev deployment selected in
`packages/backend/.env.local`. From the repository root:

```sh
pnpm --dir packages/backend exec convex dev --once
```

See [`../AGENTS.md`](../AGENTS.md) for deployment policy. Never print secrets
or copy Convex deployment identity out of this checkout.

## Signed acceptance publication

```sh
pnpm acceptance:prepare
pnpm acceptance:build
pnpm acceptance:start
```

The [root README](../../../README.md) describes the pinned Aksara fixture.
Preparation publishes a fixed, independently signed corpus into a new native
local database. Build and start reopen that owned database. After stopping its
services, `pnpm acceptance:clean` removes the exact task-owned reservation.
These commands never read production tables or use production credentials.

## Customer verification

```sh
pnpm --filter @repo/backend customers:verify
pnpm --filter @repo/backend customers:verify:prod
```

These commands verify user, customer, and subscription cohesion without
changing content ownership.

`customers/verify.ts` is a read-only operational integrity check. It does not
change customer, subscription, or content state.
