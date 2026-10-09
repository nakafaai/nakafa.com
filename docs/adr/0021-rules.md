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
| `strictEffectProvide` | 1,576 | The rule expects a disable comment at every real entry point. Each Convex function, route handler, script main, and test provides its layer at its own entry point (412 files), and this repository has no disable comments. `multipleEffectProvide` is an error |
| `schemaSync` | 531 | 486 are test fixtures, where no Effect runner may run, and the rest sit in a synchronous render, a module-level constant, or a plain helper, where the Result form would only spell the same throw differently. `schemaSyncInEffect` is an error, so a synchronous codec inside an Effect is rejected |
| `processEnv` | 89 | Next.js inlines only a literal `process.env.NAME` read into the browser bundle and defines `NEXT_RUNTIME` per compile, so the environment contract modules pass literal reads to `readEnvironment`. The source rule `env` judges every other read |
| `nodeBuiltinImport` | 22 | Framework configuration needs a Node path, and one test server must be a Node `http.Server`. The source rule `node-module` judges the file, path, and process modules |
| `unstableApiUsage`, `experimentalApiUsage`, `apiStabilityLeak` | | Effect moves as one exact cohort that is reviewed at every upgrade, so an unstable Effect module in a signature is not a leak here |

### Source rules for raw TypeScript forms

| Rule | Reports | Never reports, by construction |
| --- | --- | --- |
| `switch` | every `switch` statement | nothing |
| `assertion` | `x as T`, `<T>x`, `x!` | `as const`; `satisfies`; definite assignment (`let x!: T`); import and export aliases; framework configuration |
| `throw` | a raw `throw` in product code | tests; framework configuration; React modules, where a hook throws for its error boundary; a `ConvexError` thrown in a Convex handler, as set out below; a throw inside a browser page function |
| `new-promise` | `new Promise(...)` and `Promise.withResolvers()` on the global `Promise`, also through a global object such as `globalThis.Promise` | tests; framework configuration; a browser page function; a local class or binding named `Promise` |

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

A test file is named `*.test.ts`, `*.test.tsx`, or `test.<name>.ts`, such as
`test.setup.ts` or `test.helpers.ts`, which only tests load. Any other module
that supports tests, such as `apps/www/test/fixtures.ts`, is product code.

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
either name makes the throw an ordinary throw. Parentheses, an assertion, or
`satisfies` around the options object or around a page function do not change
what the engine reads.

A browser page function is a function that Playwright serializes into the page.
It is a function written inline in `evaluate`, `addInitScript`, or a sibling
call of a Playwright module, or a top-level function or variable that a
Playwright module passes to such a call by name. A callback inside such a
function is in the page too, and a nested function with the same name is
ordinary code. The page keeps its platform globals, native syntax, shapes, and
throws, but `switch` statements and assertions are still reported there.

### A detached process service

`node-module` reports every load of Node's file, path, and process modules, also
through `require`, `createRequire`, a dynamic import, and
`process.getBuiltinModule`. It has one construction: the import of `spawn` from
`node:child_process` in a detached process service. All of these hold:

- The module imports `Context` and `Layer` from `effect`, declares a top-level
  class that extends `Context.Service<Self, Shape>()("Id")`, and builds that
  class's layer with `Layer.succeed`, `Layer.effect`, or `Layer.sync`.
- The import declaration binds `spawn` under that name, and nothing else at run
  time.
- The module calls `spawn`, and the last argument of every call is an object
  literal with `detached: true`: each child leads a process group of its own.

Effect's spawner owns termination (4.0.2, `NodeChildProcessSpawner.ts`, lines
549 to 568). When the scope closes it signals the child's process group, also
after the child ended by itself with code zero, as long as the handle is
referenced. When the child exits with another code it signals the group at
once. `unref` turns the signals at scope close off, but it also removes the
child from the event loop, so the parent no longer stays alive for it. No
option leaves termination to the caller. So a service cannot both never signal
a group whose leader already ended and keep the parent alive while it waits. It
starts its child with Node's API behind its own seam. nakafa.com has no such
module. Aksara's CLI has one, and aksara #421 pins its lifetime properties with
tests.

Every other load of the process module is still reported in such a module, and
so are the file and path modules. A child that is not detached has no group to
own, so Effect's `ChildProcess` starts it. When the spawner offers a way to own
termination, the construction goes away.

### Promise syntax

`async` and `await` are a rule only in the domain folders. Most of that code
sits where a framework owns the Promise: Next.js pages and routes, React
transitions, Playwright tests, `convex-test` callbacks, and Vitest mocks.

A Confect workflow handler keeps its native promise syntax, because the workflow
engine owns when its steps start.

`new Promise(...)` and `Promise.withResolvers()` are judged everywhere except
tests and framework configuration, by `new-promise`. The rule counts only while
`Promise` is the global binding, read by name or through a global object.

### Data shapes written inline

`data-type` also reports an object type written inline where a data shape is
declared: in the type of a variable, in a return type, in the target of a type
predicate, in the target of `satisfies`, and inside the named arguments of a
parameter (an array element, a record value, a union member, a nested member).

The object type that IS a parameter's type is not reported. It names the
arguments of the function, as React props name the inputs of a component, so it
is no data shape. This also holds when an intersection joins it to another
type and inside `Partial`, `Readonly`, or `Required`. Two pilot sweeps measured
the other reading: for about 108 such places they added 65 Schema constants and
43 run-time imports that only gave a type, and one rebuilt a Convex document
schema that Confect already provides. Of 528 inline object types measured, 94
were data shapes.

An inline object type is not reported, by construction, when:

- one of its members holds a value that no Schema describes as data: a
  function, a React or MDX value, an AI SDK message part, an Effect runtime
  handle, a platform object such as `Request` or `Promise`, a three.js object,
  or a syntax-tree node of ESTree or TypeScript;
- an intersection joins it to such a value, as in `ResponseInit & { url?: string }`;
- one of its members names a type parameter in scope. The caller chooses that
  type, so no single `typeof X.Type` names the shape, as for a generic
  interface;
- it is the selector of `Extract` or `Exclude`;
- it is the props of a React component, a type argument of a call, or the
  constraint of a type parameter.

The fix has an order. First remove an annotation that only restates what the
value already says (`as const` keeps a literal type). Then derive from the
owner that exists: a Schema's `.Type`, `Parameters` or `ReturnType` of the
function that consumes or produces the value, `FunctionArgs` of a Convex
reference, a type that Next.js generates. A new Schema is for a real contract:
an exported shape, a shape that two places use, or the row type of an authored
table. A browser module never gains a run-time import only to name a type.

### Module size

A hand-written module has at most 500 lines. The check reports a longer one
with its count, tests included, and a module that a tool generated is not
judged. The limit is on physical lines, so a long comment counts: a module
that needs that much explanation holds more than one capability.

### Vercel deployment policy

Each app's `vercel.ts` sets `git.deploymentEnabled` to exactly
`{ "**": false, main: true }`, and the check reports any other form. The four
files repeat the policy on purpose: each Vercel project reads only its own
file, and the Python app cannot import a shared value. The check, not an
import, keeps them equal.

## Consequences

- `packages/typescript-config/base.json` lists every rule the installed plugin
  defines, as `error`, or as `off` for a rule in the table above. It holds the
  only `plugins` array of the repository: a `plugins` array replaces the one it
  extends, so a second array would have to repeat the whole block. Every other
  configuration, the Next.js one included, inherits it. Next.js does not need
  a plugin entry of its own: measured on Next.js 16.4, its type generation, the
  start of its dev server, and the configuration step of its build leave the
  app's configuration unchanged without one.
- The source check reads the plugin's own rule list and rejects a rule that has
  no decision, a name the plugin no longer defines, any other severity, and a
  second `plugins` array anywhere. So a plugin upgrade that adds a rule fails
  the check until the rule is decided.
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
