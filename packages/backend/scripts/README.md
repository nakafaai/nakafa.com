# Backend scripts

These scripts verify signed content releases, durable customer state, and one
real Nina turn. Package scripts in `packages/backend/package.json` are the
command source of truth.

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
Each runtime signs with a new key, and other builds share the web app's fetch
cache (`apps/www/.next/cache/fetch-cache`). Responses signed by another key can
never verify, so every acceptance build starts without that cache and cleanup
removes it. A cache that resolves outside the checkout is refused instead.
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

## Nina release gate

```sh
pnpm --filter @repo/backend nina:gate
```

This command runs one real Nina turn through the Convex AI gateway, on the
deployment that `CONVEX_DEPLOYMENT` names, and prints a table of what the turn
used. That is the dev deployment in `packages/backend/.env.local`. It refuses
production and refuses to run with no deployment named, and the Convex CLI it
starts gets exactly the deployment it checked, so a `.env` file cannot choose
another. It signs in a synthetic learner, asks one question, reads the stored
turn, and removes the chat and starts the deletion of the learner. It exits with
0 when the turn passes and with 1 when it does not, and it prints no message
text.

[ADR 0001](../../../docs/adr/0001-nina-engagement-architecture.md) says when to
run it and what it proves.
