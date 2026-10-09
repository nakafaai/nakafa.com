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
| `newPromise` | 30 | 28 are test doubles that must be Promises at a Promise-typed seam, and 2 run in the browser page. The source rule `new-promise` judges the rest of the code |
| `newSchemaClass` | 1,104 | `X.make(...)` builds a tagged error nine frames deeper than `new X(...)`. With the engine's limit of ten frames the stack keeps 1 application frame of 5 (measured) |
| `processEnv` | 89 | Next.js inlines only a literal `process.env.NAME` read into the browser bundle and defines `NEXT_RUNTIME` per compile, so the environment contract modules pass literal reads to `readEnvironment`. The source rule `env` judges every other read |
| `nodeBuiltinImport` | 22 | Framework configuration needs a Node path, and one test server must be a Node `http.Server`. The source rule `node-module` judges the file, path, and process modules |
| `unstableApiUsage`, `experimentalApiUsage`, `apiStabilityLeak` | | Effect moves as one exact cohort that is reviewed at every upgrade, so an unstable Effect module in a signature is not a leak here |

### Source rules for raw TypeScript forms

| Rule | Reports | Never reports, by construction |
| --- | --- | --- |
| `switch` | every `switch` statement | nothing |
| `assertion` | `x as T`, `<T>x`, `x!` | `as const`; `satisfies`; definite assignment (`let x!: T`); import and export aliases; framework configuration |
| `throw` | a raw `throw` in product code | tests; framework configuration; React modules, where a hook throws for its error boundary; a `ConvexError` thrown in a Convex handler, as set out below; a throw inside a browser page function |
| `new-promise` | `new Promise(...)` that builds the global `Promise` | tests; framework configuration; a browser page function; a local class or binding named `Promise` |

`switch` reports a `switch (typeof x)` once, as a switch, not also as a
`typeof-object` comparison.

`satisfies` is not an assertion: it checks a value and does not change its
type. Of 781 uses measured, 491 check against a Schema-derived type, 104
against a library type, 62 against a key or primitive type, 30 against a type
derived from a value, and 94 against a local type. A local type that is an
inline object type belongs to the shape rules, not to this one.

Scopes name the modules a rule inspects:

| Scope | Modules inspected |
| --- | --- |
| `every` | every authored module |
| `code` | every module except framework configuration |
| `logic` | every module except framework configuration and React modules; tests included |
| `domain` | the Confect and script folders, tests excluded |
| `product` | every module except framework configuration, React modules, and tests |
| `source` | every module except framework configuration and tests; React modules included |

### Constructions the engine recognizes

A React module is a `.tsx` file, a module that loads `react` or `react-dom` at
run time, or a module that starts with `"use client"` as its first statement.

A test file is named `*.test.ts`, `*.test.tsx`, or `test.<name>.ts`. A test
support module, such as a plain module under a `test` folder, is product code.

A framework configuration file is named `*.config.ts`, `.mts`, `.cts`, or
`.tsx`, imports the Vitest or Vercel configuration API, or has a default export
that `satisfies` a `...Config` type which a package imports, such as Convex's
`AuthConfig`. A configuration file that a product module imports is still
configuration. Of 29 configuration files measured, one is imported by product
code: `packages/backend/confect/auth.ts`, which Convex evaluates as its auth
configuration and which the Better Auth plugin must receive as the same object.

A `throw` of `ConvexError` in a Convex handler is exempt only when all of these
hold:

- The throw sits directly in the handler. Its nearest enclosing function is the
  handler, so a callback that the handler contains is a function of its own.
- The handler is the `handler` option of a call to a Convex builder: `query`,
  `mutation`, `action`, or an internal form. The module imports that builder,
  under any local name, from a module whose specifier ends with
  `/_generated/server`. A builder from another module, such as Confect's
  `@repo/backend/confect/functions`, does not count.
- The error class is `ConvexError`, imported from `convex/values` under any local
  name.

The compiler resolves the builder and the error class. A local binding with
either name makes the throw an ordinary throw.

A browser page function is a function that Playwright serializes into the page.
It is a function written inline in `evaluate`, `addInitScript`, or a sibling
call of a Playwright module, or a top-level function or variable that a
Playwright module passes to such a call by name. A callback inside such a
function is in the page too, and a nested function with the same name is
ordinary code. The page keeps its platform globals, native syntax, shapes, and
throws, but `switch` statements and assertions are still reported there.

### Promise syntax

`async` and `await` are a rule only in the domain folders. Most of that code
sits where a framework owns the Promise: Next.js pages and routes, React
transitions, Playwright tests, `convex-test` callbacks, and Vitest mocks.

A Confect workflow handler keeps its native promise syntax, because the workflow
engine owns when its steps start.

`new Promise(...)` is judged everywhere except tests and framework
configuration, by `new-promise`. The rule counts only while `Promise` is the
global binding.

## Consequences

- Both shared configurations list every rule of the plugin with its decision:
  `error`, or `off` for a rule in the table above. A rule that the
  configurations do not list is open work, not a decision. It becomes an error
  in the pull request that clears its last site.
- A new place that a framework forces is added to the source check as a
  construction, with a test for the reported and the unreported form.
- Keep `new X({...})` for Schema error classes.
- A file under a `_generated` folder and a file whose header says a tool
  generated it are not judged. Review rejects a hand-written file that claims
  either.

## Rejected Alternatives

- Per-file overrides for the compiler plugin: they are a second, hidden list of
  exceptions.
- `Schema make` for errors with a larger stack limit: the limit is a process
  setting that every runtime (Convex, the browser, Node) would need.
- An `async` rule with exemptions for every framework callback: the list of
  callbacks is longer than the code it would protect.
- Judging a configuration file as product code when a product module imports
  it: the one such file must read `process.env`, because Convex evaluates it
  before any Effect runtime exists.
