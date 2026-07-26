---
name: effect-ts
description: Effect-TS library usage in TypeScript — Effect.gen generators, Schema.Struct/Schema.Class definitions, Layer/Context.Tag/Service patterns, Effect.pipe pipelines, Data.TaggedError/Data.Class error types, Ref/Queue/PubSub/Deferred concurrency primitives, Match module, Config providers, Scope/Exit/Cause/Runtime patterns, or any code using Effect's typed error channel (E parameter). Trigger when writing, reviewing, debugging, or refactoring TypeScript code that uses Effect — when you see imports from `effect`, `effect/*`, or any `@effect/*` scoped package (schema, platform, sql, opentelemetry, cli, cluster, rpc, vitest). Also trigger when the user asks about Effect patterns, migration from Promises/fp-ts/neverthrow to Effect, or how to structure an Effect application. Do NOT trigger for React's useEffect, Redux side effects, or general English usage of "effect" unless the context clearly involves the Effect-TS library.
---
# Effect TypeScript Best Practices

Effect is a TypeScript library for building complex, type-safe applications with structured
error handling, dependency injection via services/layers, fiber-based concurrency, and
resource safety.

## When to Apply

- Writing or reviewing TypeScript code that imports from `effect`, `effect/*`, or `@effect/*`
- Implementing typed error handling with `Effect<Success, Error, Requirements>`
- Building services and layers for dependency injection
- Working with Schema for data validation, decoding, and transformation
- Using fiber-based concurrency (queues, semaphores, PubSub, deferred)
- Processing data with Stream and Sink
- Migrating from Promises, fp-ts, neverthrow, or ZIO to Effect

## Source and Version Discipline

- Verify the installed Effect version before prescribing APIs. Prefer the installed declarations,
  official docs at <https://effect.website/docs>, and a repository-pinned Effect source checkout.
- Treat `@effect/schema` as a legacy migration signal. Current Effect 3 code imports `Schema` from
  `"effect"` unless the installed version says otherwise.
- Do not import from, build, lint, or test a vendored Effect source checkout as application code.
  It is a read-only reference, and its exact commit must be mechanically verifiable.
- `Context.Tag` plus `Layer` is the documented service pattern. `Effect.Service` combines a tag
  and default layer for projects that adopt it, but Effect 3.22.0 marks that API experimental;
  follow the repository's architecture and verify the installed declaration before using it.
- Treat a major prerelease as a separate migration, not an automatic update. Check npm dist-tags,
  every installed `@effect/*` peer range, official migration guidance, and the repository's full
  verification surface before proposing it. A stable submodule does not make a beta runtime
  production-stable.
- This entrypoint was last reconciled on 2026-07-25 against Effect 3.22.0. Re-check current
  installed docs and declarations because Effect evolves quickly.

## How to Use

This skill is organized by domain. Read the relevant reference file for the area you're working in.

### Read First: The Paradigm

**Always read this before diving into API references**, especially when refactoring existing
code to use Effect or writing new Effect services:

| Reference | When to Read |
|-----------|-------------|
| [**Think in Effect: The Paradigm Shift**](references/getting-paradigm.md) | **Before any other reference.** Mental model shifts, refactoring recipes, anti-patterns, application architecture. Read this to understand HOW to think in Effect — the other files teach WHAT to type. |

### Core Foundations

| Reference | When to Read |
|-----------|-------------|
| [Getting Started](references/getting-started.md) | Creating the Effect type, pipelines, generators, running effects |
| [Error Management](references/error-management.md) | Typed errors, recovery, retrying, timeouts, sandboxing |
| [Core Concepts](references/core-concepts.md) | Request batching, configuration management, runtime system |

### Data & Validation

| Reference | When to Read |
|-----------|-------------|
| [Data Types](references/data-types.md) | Option, Either, Cause, Chunk, DateTime, Duration, Exit, Data |
| [Schema Basics](references/schema-basics.md) | Schema intro, basic usage, classes, constructors, effect data types |
| [Schema Advanced](references/schema-advanced.md) | Transformations, filters, annotations, error formatting, JSON Schema output |

### Architecture & Dependencies

| Reference | When to Read |
|-----------|-------------|
| [Requirements Management](references/req-management.md) | Services, Layers, dependency injection, layer memoization |
| [Resource Management](references/resource-management.md) | Scope, safe resource acquisition/release, caching |
| [State Management](references/state-management.md) | Ref, SubscriptionRef, SynchronizedRef for concurrent state |

### Concurrency & Streaming

| Reference | When to Read |
|-----------|-------------|
| [Concurrency](references/conc-concurrency.md) | Fibers, Deferred, Latch, PubSub, Queue, Semaphore |
| [Streams and Sinks](references/streams-and-sinks.md) | Creating, consuming, transforming streams; sink operations |
| [Scheduling](references/sched-scheduling.md) | Built-in schedules, cron, combinators, repetition |

### Platform & Observability

| Reference | When to Read |
|-----------|-------------|
| [Platform](references/plat-platform.md) | FileSystem, Command, Terminal, KeyValueStore, Path |
| [Observability](references/obs-observability.md) | Logging, metrics, tracing, Supervisor |
| [Testing](references/test-testing.md) | TestClock for time simulation; for service mocking and layer testing, see [Requirements Management](references/req-management.md) |

### Style, AI & Migration

| Reference | When to Read |
|-----------|-------------|
| [Code Style](references/code-style.md) | Branded types, pattern matching, dual APIs, guidelines, traits |
| [AI Integration](references/ai-integration.md) | Effect AI packages for LLM tool use and execution planning |
| [Micro](references/micro-module.md) | Lightweight Effect alternative for smaller bundles |
| [Migration Guides](references/migration-guides.md) | Coming from Promises, fp-ts, neverthrow, or ZIO |

## Quick Reference — Common Patterns

### The Effect Type
```ts
//         ┌─── Success type
//         │        ┌─── Error type
//         │        │      ┌─── Required dependencies
//         ▼        ▼      ▼
Effect<Success, Error, Requirements>
```

### Creating Effects
```ts
import { Data, Effect } from "effect"

// From sync values
const succeed = Effect.succeed(42)

class JsonParseError extends Data.TaggedError("JsonParseError")<{
  readonly cause: unknown
}> {}

class RequestError extends Data.TaggedError("RequestError")<{
  readonly cause: unknown
}> {}

// Map thrown exceptions into the typed error channel
const sync = Effect.try({
  try: () => JSON.parse(data),
  catch: (cause) => new JsonParseError({ cause })
})

// Map Promise rejection into the typed error channel
const request = Effect.tryPromise({
  try: () => fetch(url),
  catch: (cause) => new RequestError({ cause })
})

// From generators (recommended for complex flows)
const loadTodos = Effect.fn("Todos.load")(function* (id: string) {
  const user = yield* getUser(id)
  const todos = yield* getTodos(user.id)
  return { user, todos }
})

const program = loadTodos("1")
```

### Running Effects
```ts
// Run only at framework, CLI, test, or event boundaries.
Effect.runPromise(program)

// With full Exit information
Effect.runPromiseExit(program)

// Sync (throws on async)
Effect.runSync(program)
```

### Typed Errors
```ts
import { Data, Effect, Schema } from "effect"

// Prefer Schema.TaggedError for serializable/schema-derived domain contracts.
class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  id: Schema.String
}) {}

// Data.TaggedError remains appropriate for in-memory-only failures.
class Unauthorized extends Data.TaggedError("Unauthorized")<{}> {}

// Error type is tracked: Effect<User, NotFound | Unauthorized>
const getUser = (id: string) =>
  Effect.gen(function* () {
    // ...
  })
```

### Services and Layers
```ts
import { Context, Effect, Layer } from "effect"

// Define a service contract.
class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  { readonly findById: (id: string) => Effect.Effect<User, NotFound> }
>() {}

// Use in effects — adds UserRepo to the Requirements channel.
const program = Effect.gen(function* () {
  const repo = yield* UserRepo
  return yield* repo.findById("1")
})

// Provide an implementation with a Layer.
const UserRepoLive = Layer.succeed(UserRepo, {
  findById: (id) => Effect.succeed({ id, name: "Alice" })
})

// Effect.Service may combine the contract and default Layer when the repository
// explicitly adopts its experimental API and the installed version supports it.
```

### Schema Validation
```ts
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/@/))
})

type User = typeof User.Type

// Decode (parse + validate)
const decode = Schema.decodeUnknownSync(User)
const user = decode({ id: 1, name: "Alice", email: "a@b.com" })
```

### Pipelines
```ts
import { Effect, pipe } from "effect"

// Data-last (pipe style)
const result = pipe(
  getTodos,
  Effect.map((todos) => todos.filter((t) => !t.done)),
  Effect.flatMap((active) => sendNotification(active.length)),
  Effect.catchTag("NetworkError", () => Effect.succeed("offline"))
)

// Fluent (method style)
const result2 = getTodos.pipe(
  Effect.map((todos) => todos.filter((t) => !t.done)),
  Effect.flatMap((active) => sendNotification(active.length))
)
```

## Gotchas

See [gotchas.md](gotchas.md) for known failure points.
