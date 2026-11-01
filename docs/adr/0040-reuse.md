# ADR 0040: A Convex Call Runs On A Module Already Evaluated

## Status

Accepted on 1 November 2026.

## Context

Every Convex call evaluated its whole module first. One hour of production on 31 October, 507 executions of application queries and mutations, spent these milliseconds of JavaScript per call:

| p10 | Median | p90 |
| --- | --- | --- |
| 150 | 233 | 300 |

`notifications/consume:sweep` reads no document and spent 236 ms. A component with its own small bundle, `lib:ensureRefreshLoop`, spent 5 ms. The floor comes from evaluating the module, not from any work a function does.

Each way of making that evaluation smaller was measured first, with the options of the Convex bundler, in CPU milliseconds per evaluation:

| Way | `notifications/consume` | `exams/sittings` | Why it does not close the gap |
| --- | --- | --- | --- |
| Today | 76 | 118 | The bundler sets `keepNames`, which is about a third of this and has no setting in `convex.json`. |
| No table imports anything | 52 to 24 without `keepNames` | 102 to 91 without `keepNames` | This is a ceiling. A table's fields must be imported to be declared, and the 22 best modules to remove free only 120 of 766 KB, most of them holding real fields. |
| Lazy registration | No change | 11.7 of it, 7.5 from `paper` alone | Registration compiles inside Confect, which no patch may change, and only one group pays for it. |
| `import()` in a handler | | 145 to 126 for the editor code | Convex refuses it. `RequestScope` opens queries and mutations with dynamic imports off, and only actions have them. |

The cost is spread over about 830 modules. No module costs more than 0.6 ms at the top level, and no single module holds more than 22 others in the graph, so no cut in our code removes the floor.

Convex has a way around evaluation. A module whose namespace exports `experimental_reuseContext` as `true` keeps its JavaScript context after a successful call, and the isolate scheduler sends the module's next call to the isolate that holds it. The handler then runs on a module already evaluated. Convex's source says this about it: state leaks from call to call, and reuse is not guaranteed.

Measured on a real local Convex backend under the same load, with the real backend pushed to a private instance:

| Function | Reuse off, user ms | Reuse on, user ms |
| --- | --- | --- |
| `notifications/consume:sweep` | 137 | 9 |
| `exams/sittings/timers:sweep` | 273 | 10 |
| `auth/queries:getCurrentUser` | | 1.5 |

## Decision

D1. Every module that Confect writes and the Convex runtime runs exports `experimental_reuseContext = true`. Confect has no option for it, so `scripts/reuse` adds the line, and `bun run codegen` runs it after Confect. A `"use node"` module runs in Node, where a context is never reused, and stays as it is.

D2. A module holds no state between calls, because one caller's value would reach the next caller. The `module-state` source rule rejects a top-level `let` or `var` and a top-level value made by Effect's `Mutable` modules in the domain folders. Identity stays safe because Confect builds its reader, writer, auth, and scheduler layers from each call's `ctx`, and a layer's memo map lives for one run. The proof ran 160 calls of `getCurrentUser` on saved contexts, three users and an anonymous caller in turn, with a write to the caller's row before each signed-in call so that no query cache answered. Every answer carried its own caller and the value just written.

D3. Reuse is an optimization, never a contract. A failed call saves no context, a module that is not in an isolate's one saved context evaluates as it did before, and a later Convex release that drops the export only returns a call to today's cost. No code depends on a hit.

D4. Leaf table schemas and lazy registration stay undone, and a cold call keeps paying for evaluation. The table above says why: the first ceiling cannot be reached while a table declares real fields, and the second needs a change inside Confect.

## Consequences

- A call that hits a saved context skips evaluation, and only such a call gains. The scheduler can hand an idle worker to another client, which drops its saved context, so a context does not wait long for its next call. On staging the deploy's reads went from a median of 235 ms to 9 ms over 2,646 executions, while a cron that runs once a minute stayed at 240 ms.
- What gains is a burst on one module: a static build, a class in an exam, a subscription that many clients share. A lone call to a cold module costs what it cost before.
- `confect dev` rewrites the modules without the export. That is harmless, and `bun run codegen` restores it before a commit.
- A top-level cache becomes visible across callers, so the only allowed one is a constant derived from code. A `Schema` memo qualifies. A per-user value never does.
