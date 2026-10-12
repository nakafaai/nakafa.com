# Backend scripts

These scripts verify signed content releases and durable customer state, run
one real Nina turn, and test the embedding model of knowledge search. Package
scripts in `packages/backend/package.json` are the command source of truth.

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

## Dev deployment scripts

The release gate and the model test of knowledge search run the Convex CLI on
the dev deployment of this checkout, through `development/cli.ts`. That module
reads `CONVEX_DEPLOYMENT` from the environment and then from
`packages/backend/.env.local`, where the CLI looks for it too. A script goes on
only when that names a dev deployment, and it refuses to run with no
deployment named, with a production deployment, or with a deploy key or a
deployment token set. The CLI gets exactly the deployment that was checked, so
a `.env` file cannot choose another, and it holds its own login, so the scripts
read no credential.

## Nina release gate

```sh
pnpm --filter @repo/backend nina:gate
```

This command runs one real Nina turn through the Convex AI gateway, on the dev
deployment, and prints a table of what the turn used. It signs in a synthetic
learner, asks one question, reads the stored turn, and removes the chat and
starts the deletion of the learner. It exits with 0 when the turn passes and
with 1 when it does not, and it prints no message text.

[ADR 0001](../../../docs/adr/0001-nina-engagement-architecture.md) says when to
run it and what it proves.

## Knowledge search model test

```sh
pnpm --filter @repo/backend knowledge:compare
pnpm --filter @repo/backend knowledge:compare --model=qwen/qwen3-embedding-8b --locale=id
```

The test decides which embedding model knowledge search uses. It runs on the
dev deployment, which must run the current functions and hold the section index
of its active release (the build is `contents/sections/build:run`, started by
hand with no arguments), and it needs no other setting. The test starts the
internal function `contents/sections/compare:rank` with `convex run`, and reads
its answer from what the CLI prints.

For every embedding model of the gateway and every language, the deployment
embeds the stored sections of that language and each question of
`knowledge/questions/`, and the test prints how many questions had their right
section within the top five, how many were left out because their label no
longer fits the index, how many sections the model refused (`refused`), and how
long a question took to embed. The sections are embedded as the build embeds
them: a section whose text a model refuses is left out of the ranking and
counted, and a question about it counts as missed, because a build with that
model would leave the section out of the index. A model that refuses every text
of a batch is not scored, and its run gives no answer. The questions are
labeled with the Aksara corpus; a lesson that was edited since leaves its
questions out, with the reason. `--model` and `--locale` narrow the test to one
model or one language. A run is one call of the function, which the CLI waits
for in one request, and Node ends a request that gets no answer after five
minutes, so a run that takes longer fails with the error of the CLI. A run that
gets no answer is printed with an `error`, and the other runs still count. The
`error` holds the facts of the failure when the gateway refused a request, which
the function answers instead of failing because the CLI drops the data of the
error it prints, says to build the index when it holds no section of the
language, and holds the start of what the CLI printed when the CLI could not run
the function, such as when the dev deployment does not have it yet. The command
exits with 1 when any run gave no answer. The test changes no stored section:
the vectors of a candidate model are made for the run and kept nowhere.
