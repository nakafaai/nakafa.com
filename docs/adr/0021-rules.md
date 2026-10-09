# ADR 0021: Which Check Owns A Rule, And Which Compiler Rules Stay Off

## Decision

Two checks enforce the Effect-native standard, and each rule has one owner.

- The Effect compiler plugin (`packages/typescript-config`) judges every authored
  module the same way. Its only file scope is a per-file override list, which
  this repository does not use. So a compiler rule is an error everywhere, or it
  is off.
- The source check (`scripts/check`) owns every rule that must recognize a place
  by its construction: a React module, a framework configuration file, a test, a
  Convex handler, a function that runs in the browser page.

A rule moves to the source check when a framework requires the form somewhere.
It never gets an allowlist, a baseline, or a suppression.

### Compiler rules that stay off

| Rule | Sites measured | Why it stays off |
| --- | --- | --- |
| `asyncFunction` | 2,969 | Next.js requires `async` for `'use cache'` functions and Server Functions. The source rule `promise` judges the domain folders instead |
| `strictBooleanExpressions` | 2,604 | The plugin files it under style. Its fixes are plain comparisons, not Effect, across 1,051 files |
| `missingPipeableSignature` | 479 | 11 framework exports can never take a data-last form |
| `newSchemaClass` | 1,104 | `X.make(...)` builds a tagged error nine frames deeper than `new X(...)`. With the engine's limit of ten frames the stack keeps 1 application frame of 5 (measured) |
| `unstableApiUsage`, `experimentalApiUsage` | | Effect moves as one exact cohort that is reviewed at every upgrade |

### Source rules for raw TypeScript forms

| Rule | Reports | Recognized by construction, never reported |
| --- | --- | --- |
| `switch` | every `switch` statement | nothing |
| `assertion` | `x as T`, `<T>x`, `x!` | `as const`; framework configuration |
| `throw` | a raw `throw` in product code | tests; framework configuration; React modules, where a hook throws for its error boundary; `throw new ConvexError(...)` in a plain Convex handler; a function that runs in the browser page |

A React module is a `.tsx` file, a module that loads `react`, or a module that
starts with `"use client"`.

`async` and `await` are not a rule outside the domain folders. Most of that code
sits where a framework owns the Promise: Next.js pages and routes, React
transitions, Playwright tests, `convex-test` callbacks, and Vitest mocks.

## Consequences

- A compiler rule that is neither an error nor in the table above is open work,
  not a decision. It becomes an error in the pull request that clears its last
  site.
- A new place that a framework forces is added to the source check as a
  construction, with a test for the reported and the unreported form.
- Keep `new X({...})` for Schema error classes.

## Rejected Alternatives

- Per-file overrides for the compiler plugin: they are a second, hidden list of
  exceptions.
- `Schema make` for errors with a larger stack limit: the limit is a process
  setting that every runtime (Convex, the browser, Node) would need.
- An `async` rule with exemptions for every framework callback: the list of
  callbacks is longer than the code it would protect.
