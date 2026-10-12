# Backend scripts

These scripts verify signed content releases and durable customer state, run
one real Nina turn, and measure Nina's judgments. Package scripts in
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

## Nina release gate

```sh
pnpm --filter @repo/backend nina:gate
```

This command runs one real Nina turn through the Convex AI gateway, on the
deployment that `CONVEX_DEPLOYMENT` names, and prints a table of what the turn
used. That is the dev deployment in `packages/backend/.env.local`. It runs only
on a dev deployment, and refuses to run with no deployment named or with a
deploy key or a deployment token set. The Convex CLI it starts gets exactly the
deployment it checked, so a `.env` file cannot choose another. It signs in a synthetic learner, asks one question, reads the stored
turn, and removes the chat and starts the deletion of the learner. It exits with
0 when the turn passes and with 1 when it does not, and it prints no message
text.

[ADR 0001](../../../docs/adr/0001-nina-engagement-architecture.md) says when to
run it and what it proves.

## Judgment measurement

```sh
pnpm --filter @repo/backend judgment:measure
pnpm --filter @repo/backend judgment:measure --together=3
```

This command sets the thresholds of Nina's judgments (`confect/nina/judgment`)
from a labelled set (`test/judgment/message.ts` and `test/judgment/note.ts`),
never from taste. It sends the set to the deployment its environment
configures, the development deployment unless it is given `--prod`, with the
same credential and variables as `customers:verify`. The deployment answers
through its internal `nina/judgment:measure` action, which asks the decision
model about every text. Each judgment is measured on the form of text and the
grouping that production asks it: `lasting` on a whole message, alone, and
`ownNote` and `private` on a note, which is the sentence the capture model
proposes with the words of the learner it quotes (`noteText`), both judgments
in one request about the notes together. For each judgment the command prints
the probabilities by label, the counts at the threshold the deployment holds,
the threshold that separates best, and the texts the held threshold judges
wrongly. A text is named by its number among the messages or the notes and
described by its language and form, and is never quoted. `--together=N` sends N
notes in one request, from 1 to 3, because the capture asks about up to three
candidates of a turn together; run it with 1 and with 3 and set a threshold
that holds for both. The command exits with 1 when the deployment could not
measure a text, and it fails, naming the judgment, when the deployment reports
no threshold for one or answers a different number of rows than the texts it
was sent. Run it again whenever a judgment's instructions or the decision model
change, and set the new thresholds in `confect/nina/judgment/catalog.ts` from
what it prints.
