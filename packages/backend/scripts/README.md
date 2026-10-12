# Backend scripts

These scripts verify signed content releases and durable customer state, and
test the embedding model of knowledge search. Package scripts in
`packages/backend/package.json` are the command source of truth.

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

## Knowledge search model test

```sh
pnpm --filter @repo/backend knowledge:compare
pnpm --filter @repo/backend knowledge:compare --model=qwen/qwen3-embedding-8b --locale=id
```

The test decides which embedding model knowledge search uses. It runs against
the deployment that `packages/backend/.env.local` names, which must run the
current functions and hold the section index of its active release (the build
is `contents/sections/build:run`, started by hand with no arguments). The test
calls the internal function `contents/sections/compare:rank` through the
any-type endpoint `/api/run` of Convex's HTTP API, with the admin credential
that the checkout holds.

For every embedding model of the gateway and every language, the deployment
embeds the stored sections of that language and each question of
`knowledge/questions/`, and the test prints how many questions had their right
section within the top five, how many were left out because their label no
longer fits the index, how many sections the model refused (`refused`), and how
long a question took to embed. The sections are embedded as the build embeds
them: a section whose text a model refuses is left out of the ranking and
counted, and a question about it counts as missed, because a build with that
model would leave the section out of the index. A model that refuses every text
of a batch is not scored, and its run fails with the refusal. The questions are
labeled with the Aksara corpus; a lesson that was edited since leaves its
questions out, with the reason. `--model` and `--locale` narrow the test to one
model or one language. Each run is one request that the runtime of Node ends
after five minutes. The test changes no stored section: the vectors of a
candidate model are made for the run and kept nowhere.
