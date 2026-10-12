# Backend scripts

These scripts verify signed content releases and durable customer state, and
measure Nina's judgments. Package scripts in `packages/backend/package.json` are
the command source of truth.

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

## Judgment measurement

```sh
pnpm --filter @repo/backend judgment:measure
pnpm --filter @repo/backend judgment:measure --together=3
```

This command sets the thresholds of Nina's judgments (`confect/nina/judgment`)
from a labelled set of messages (`test/judgment/set.ts`), never from taste. It
sends the set to the deployment its environment configures, the development
deployment unless it is given `--prod`, with the same credential and variables
as `customers:verify`. The deployment answers through its internal
`nina/judgment:measure` action, which asks the decision model about every
message. For each judgment the command prints the probabilities by label, the
counts at the threshold the deployment holds, the threshold that separates best,
and the messages the held threshold judges wrongly. A message is named by its
number in the set and described by its language and form, and is never
quoted. `--together=N` sends N messages in one request, as the capture asks
about up to three candidates together. The command exits with 1 when the
deployment could not measure a message, and says why. Run it again whenever a
judgment's instructions or the decision model change, and set the new
thresholds in `confect/nina/judgment/catalog.ts` from what it prints.
