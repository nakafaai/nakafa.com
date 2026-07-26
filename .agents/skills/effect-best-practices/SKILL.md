---
name: effect-best-practices
description: Enforces Effect-TS patterns for services, errors, layers, and atoms. Use when writing code with Context.Tag, Effect.Service, Schema.TaggedError, Layer composition, or effect-atom React components.
---

# Effect-TS Best Practices

This skill enforces opinionated, consistent patterns for Effect-TS codebases. These patterns optimize for type safety, testability, observability, and maintainability.

## Version And Source Gate

- Run the repository's Effect source/version check before relying on an API.
- For Effect 3.22, `Context.Tag` plus `Layer` is the documented stable service pattern.
- `Effect.Service` is marked experimental in the pinned 3.22 source. Use it only when the
  repository deliberately adopts it and the module genuinely owns a default implementation.
- Do not turn `Context.Tag` versus `Effect.Service` into a business-versus-infrastructure rule.

## Effect Language Server (Required)

**The Effect Language Server is essential for Effect development.** It catches errors at edit-time that TypeScript alone cannot detect, provides Effect-specific refactors, and improves developer productivity.

### Setup

1. Install:
```bash
npm install @effect/language-service --save-dev
```

2. Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

3. Configure your editor to use workspace TypeScript:
   - **VSCode**: F1 → "TypeScript: Select TypeScript Version" → "Use Workspace Version"
   - **JetBrains**: Settings → Languages & Frameworks → TypeScript → Use workspace version
   - **Zed**: Use the repository-pinned `vtsls` configuration in `.zed/settings.json`.
     Nakafa intentionally resolves the JavaScript TypeScript 6 API for the Effect language
     plugin while its `tsc` command uses native TypeScript 7. The Zed `tsgo` extension uses
     Microsoft's upstream native server; it does not automatically substitute the
     Effect-enhanced `@effect/tsgo` fork.

### TypeScript 7 and `@effect/tsgo`

The installed `@effect/language-service` README directs TypeScript 7 projects to
`@effect/tsgo`. That fork supports Effect 3 and Effect 4, but its official project still
labels it alpha and says it targets Effect 4 primarily. Do not replace this repository's
stable editor path or CI compiler with it automatically. Re-evaluate it as an explicit
toolchain migration after its release status, executable packaging, editor integration,
and full repository gates are verified.

The plugin adds Effect-specific diagnostics, quick info, completions, and
refactors. For CI enforcement, run `npx effect-language-service patch`. See
`references/language-server.md` for configuration options and CLI tools.

## Quick Reference: Critical Rules

| Category | DO | DON'T |
|----------|-----|-------|
| Services | `Context.Tag` plus an owning `Layer` | Unversioned `Effect.Service` mandates |
| Dependencies | Compose requirements once at the layer root | Re-providing dependencies at usage sites |
| Layers | `Layer.mergeAll` for flat composition | Deeply nested `Layer.provide` chains |
| Layer Chaining | `Layer.provideMerge` for incremental composition | Multiple `Layer.provide` (creates nested types) |
| Errors | `Schema.TaggedError` with `message` field | Plain classes or generic Error |
| Error Specificity | `UserNotFoundError`, `SessionExpiredError` | Generic `NotFoundError`, `BadRequestError` |
| Error Handling | `catchTag`/`catchTags` | `catchAll` or `mapError` |
| IDs | `Schema.UUID.pipe(Schema.brand("@App/EntityId"))` | Plain `string` for entity IDs |
| Functions | `Effect.fn("Service.method")` | Anonymous generators |
| Logging | `Effect.log` with structured data | `console.log` |
| Config | `Config.*` with validation | `process.env` directly |
| Options | `Option.match` with both cases | `Option.getOrThrow` |
| Nullability | `Option<T>` in domain types | `null`/`undefined` |
| Atoms | `Atom.make` outside components | Creating atoms inside render |
| Atom State | `Atom.keepAlive` for global state | Forgetting keepAlive for persistent state |
| Atom Updates | `useAtomSet` in React components | `Atom.update` imperatively from React |
| Atom Cleanup | `get.addFinalizer()` for side effects | Missing cleanup for event listeners |
| Atom Results | `Result.builder` with `onErrorTag` | Ignoring loading/error states |

## Service Definition Pattern

Use `Context.Tag` plus `Layer` as the stable default. The tag owns the contract and the
layer owns one implementation, so callers can substitute implementations without importing
a module-selected default.

```typescript
import { Context, Effect, Layer, Option } from "effect"

export class UserService extends Context.Tag("UserService")<
    UserService,
    {
        readonly register: (
            input: CreateUserInput,
        ) => Effect.Effect<User, EmailAlreadyRegisteredError | UserCreateError>
    }
>() {}

export const UserServiceLive = Layer.effect(
    UserService,
    Effect.gen(function* () {
        const repo = yield* UserRepo

        const register = Effect.fn("UserService.register")(function* (
            input: CreateUserInput,
        ) {
            const existing = yield* repo.findByEmail(input.email)
            if (Option.isSome(existing)) {
                return yield* new EmailAlreadyRegisteredError({
                    email: input.email,
                    message: "Email is already registered",
                })
            }
            return yield* repo.create(input)
        })

        return UserService.of({ register })
    }),
)
```

`Effect.Service` may remove boilerplate when the same module genuinely owns a canonical
default implementation and the repository deliberately opts into its experimental 3.22 API.
When it is used, declare its default-layer dependencies in `dependencies`.

See `references/service-patterns.md` for detailed patterns.

## Error Definition Pattern

**Always use `Schema.TaggedError`** for errors. This makes them serializable (required for RPC) and provides consistent structure.

```typescript
import { Schema } from "effect"
import { HttpApiSchema } from "@effect/platform"

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
    "UserNotFoundError",
    {
        userId: UserId,
        message: Schema.String,
    },
    HttpApiSchema.annotations({ status: 404 }),
) {}

export class UserCreateError extends Schema.TaggedError<UserCreateError>()(
    "UserCreateError",
    {
        message: Schema.String,
        cause: Schema.optional(Schema.String),
    },
    HttpApiSchema.annotations({ status: 400 }),
) {}
```

**Error handling - use `catchTag`/`catchTags`:**

```typescript
// CORRECT - preserves type information
yield* repo.findById(id).pipe(
    Effect.catchTag("DatabaseError", (err) =>
        Effect.fail(new UserNotFoundError({ userId: id, message: "Lookup failed" }))
    ),
    Effect.catchTag("ConnectionError", (err) =>
        Effect.fail(new ServiceUnavailableError({ message: "Database unreachable" }))
    ),
)

// CORRECT - multiple tags at once
yield* effect.pipe(
    Effect.catchTags({
        DatabaseError: (err) => Effect.fail(new UserNotFoundError({ userId: id, message: err.message })),
        ValidationError: (err) => Effect.fail(new InvalidEmailError({ email: input.email, message: err.message })),
    }),
)
```

### Prefer Explicit Over Generic Errors

**Every distinct failure reason deserves its own error type.** Don't collapse multiple failure modes into generic HTTP errors.

```typescript
// WRONG - Generic errors lose information
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
    "NotFoundError",
    { message: Schema.String },
    HttpApiSchema.annotations({ status: 404 }),
) {}

// Then mapping everything to it:
Effect.catchTags({
    UserNotFoundError: (err) => Effect.fail(new NotFoundError({ message: "Not found" })),
    ChannelNotFoundError: (err) => Effect.fail(new NotFoundError({ message: "Not found" })),
    MessageNotFoundError: (err) => Effect.fail(new NotFoundError({ message: "Not found" })),
})
// Frontend gets useless: { _tag: "NotFoundError", message: "Not found" }
// Which resource? User? Channel? Message? Can't tell!
```

```typescript
// CORRECT - Explicit domain errors with rich context
export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
    "UserNotFoundError",
    { userId: UserId, message: Schema.String },
    HttpApiSchema.annotations({ status: 404 }),
) {}

export class ChannelNotFoundError extends Schema.TaggedError<ChannelNotFoundError>()(
    "ChannelNotFoundError",
    { channelId: ChannelId, message: Schema.String },
    HttpApiSchema.annotations({ status: 404 }),
) {}

export class SessionExpiredError extends Schema.TaggedError<SessionExpiredError>()(
    "SessionExpiredError",
    { sessionId: SessionId, expiredAt: Schema.DateTimeUtc, message: Schema.String },
    HttpApiSchema.annotations({ status: 401 }),
) {}

// Frontend can now show specific UI:
// - UserNotFoundError → "User doesn't exist"
// - ChannelNotFoundError → "Channel was deleted"
// - SessionExpiredError → "Your session expired. Please log in again."
```

See `references/error-patterns.md` for error remapping and retry patterns.

## Schema & Branded Types Pattern

**Brand all entity IDs** for type safety across service boundaries:

```typescript
import { Schema } from "effect"

// Entity IDs - always branded
export const UserId = Schema.UUID.pipe(Schema.brand("@App/UserId"))
export type UserId = Schema.Schema.Type<typeof UserId>

export const OrganizationId = Schema.UUID.pipe(Schema.brand("@App/OrganizationId"))
export type OrganizationId = Schema.Schema.Type<typeof OrganizationId>

// Domain types - use Schema.Struct
export const User = Schema.Struct({
    id: UserId,
    email: Schema.String,
    name: Schema.String,
    organizationId: OrganizationId,
    createdAt: Schema.DateTimeUtc,
})
export type User = Schema.Schema.Type<typeof User>

// Input types for mutations
export const CreateUserInput = Schema.Struct({
    email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
    name: Schema.String.pipe(Schema.minLength(1)),
    organizationId: OrganizationId,
})
export type CreateUserInput = Schema.Schema.Type<typeof CreateUserInput>
```

**When NOT to brand:**
- Simple strings that don't cross service boundaries (URLs, file paths)
- Primitive config values

See `references/schema-patterns.md` for transforms and advanced patterns.

## Function Pattern with Effect.fn

**Always use `Effect.fn`** for service methods. This provides automatic tracing with proper span names:

```typescript
// CORRECT - Effect.fn with descriptive name
const findById = Effect.fn("UserService.findById")(function* (id: UserId) {
    yield* Effect.annotateCurrentSpan("userId", id)
    const user = yield* repo.findById(id)
    return user
})

// CORRECT - Effect.fn with multiple parameters
const transfer = Effect.fn("AccountService.transfer")(
    function* (fromId: AccountId, toId: AccountId, amount: number) {
        yield* Effect.annotateCurrentSpan("fromId", fromId)
        yield* Effect.annotateCurrentSpan("toId", toId)
        yield* Effect.annotateCurrentSpan("amount", amount)
        // ...
    }
)
```

## Layer Composition

Compose dependency layers once at the application boundary, not repeatedly at usage sites:

```typescript
const AppLive = Layer.mergeAll(
    UserServiceLive.pipe(Layer.provide(UserRepoLive)),
    OrderServiceLive.pipe(Layer.provide(OrderRepoLive)),
    NotificationServiceLive,
)
```

**Layer composition patterns:**

```typescript
// Use Layer.mergeAll for flat composition of same-level layers
const RepoLive = Layer.mergeAll(
    UserRepoLive,
    OrderRepoLive,
    ProductRepoLive,
)

// Use Layer.provideMerge for incremental chaining (flatter types than Layer.provide)
const MainLive = DatabaseLive.pipe(
    Layer.provideMerge(ConfigServiceLive),
    Layer.provideMerge(LoggerLive),
    Layer.provideMerge(CacheLive),
)
```

**Why layers over `Effect.provide`:**
- **Deduplication**: Layers memoize construction - same service instantiated once. `Effect.provide` creates new instances each call.
- **TypeScript performance**: Deep `Layer.provide` nesting creates complex recursive types that slow the LSP. `Layer.mergeAll` and `Layer.provideMerge` produce flatter types.
- **Resource management**: Scoped layers properly share and clean up resources.

See `references/layer-patterns.md` for testing layers, config-dependent layers, and the `layerConfig` pattern.

## Option Handling

**Never use `Option.getOrThrow`**. Always handle both cases explicitly:

```typescript
// CORRECT - explicit handling
yield* Option.match(maybeUser, {
    onNone: () => Effect.fail(new UserNotFoundError({ userId, message: "Not found" })),
    onSome: (user) => Effect.succeed(user),
})

// CORRECT - with getOrElse for defaults
const name = Option.getOrElse(maybeName, () => "Anonymous")

// CORRECT - Option.map for transformations
const upperName = Option.map(maybeName, (n) => n.toUpperCase())
```

## Effect Atom (Frontend State)

Effect Atom provides reactive state management for React with Effect integration.

### Basic Atoms

```typescript
import { Atom } from "@effect-atom/atom-react"

// Define atoms OUTSIDE components
const countAtom = Atom.make(0)

// Use keepAlive for global state that should persist
const userPrefsAtom = Atom.make({ theme: "dark" }).pipe(Atom.keepAlive)

// Atom families for per-entity state
const modalAtomFamily = Atom.family((type: string) =>
    Atom.make({ isOpen: false }).pipe(Atom.keepAlive)
)
```

### React Integration

```typescript
import { useAtomValue, useAtomSet, useAtom, useAtomMount } from "@effect-atom/atom-react"

function Counter() {
    const count = useAtomValue(countAtom)           // Read only
    const setCount = useAtomSet(countAtom)          // Write only
    const [value, setValue] = useAtom(countAtom)    // Read + write

    return <button onClick={() => setCount((c) => c + 1)}>{count}</button>
}

// Mount side-effect atoms without reading value
function App() {
    useAtomMount(keyboardShortcutsAtom)
    return <>{children}</>
}
```

### Handling Results with Result.builder

**Use `Result.builder`** for rendering effectful atom results. It provides chainable error handling with `onErrorTag`:

```typescript
import { Result } from "@effect-atom/atom-react"

function UserProfile() {
    const userResult = useAtomValue(userAtom) // Result<User, Error>

    return Result.builder(userResult)
        .onInitial(() => <div>Loading...</div>)
        .onErrorTag("NotFoundError", () => <div>User not found</div>)
        .onError((error) => <div>Error: {error.message}</div>)
        .onSuccess((user) => <div>Hello, {user.name}</div>)
        .render()
}
```

### Atoms with Side Effects

```typescript
const scrollYAtom = Atom.make((get) => {
    const onScroll = () => get.setSelf(window.scrollY)

    window.addEventListener("scroll", onScroll)
    get.addFinalizer(() => window.removeEventListener("scroll", onScroll)) // REQUIRED

    return window.scrollY
}).pipe(Atom.keepAlive)
```

### React Mutations

For mutation atoms, derive loading state from `result.waiting` instead of `useState`:

```typescript
const [result, mutate] = useAtom(deleteMutation, { mode: "promise" })
const isLoading = result.waiting // Updates automatically, no useState/finally needed
```

**Dialog ownership:** Move mutation logic into dialog components. Dialog owns the mutation hook, loading state, and toasts. Parent provides data props and an `onSuccess` callback.

**Cache invalidation:** Use `reactivityKeys` on both mutation and query atoms to auto-invalidate queries after mutations — replaces manual `refresh()` calls.

See `references/effect-atom-patterns.md` for complete patterns including families, localStorage, mutations, and anti-patterns.

## Anti-Patterns (Forbidden)

These patterns are **never acceptable**:

```typescript
// FORBIDDEN - runSync/runPromise inside services
const result = Effect.runSync(someEffect) // Never do this

// FORBIDDEN - throw inside Effect.gen
yield* Effect.gen(function* () {
    if (bad) throw new Error("No!") // Use Effect.fail instead
})

// FORBIDDEN - catchAll losing type info
yield* effect.pipe(Effect.catchAll(() => Effect.fail(new GenericError())))

// FORBIDDEN - console.log
console.log("debug") // Use Effect.log

// FORBIDDEN - process.env directly
const key = process.env.API_KEY // Use Config.string("API_KEY")

// FORBIDDEN - null/undefined in domain types
type User = { name: string | null } // Use Option<string>
```

See `references/anti-patterns.md` for the complete list with rationale.

## Observability

```typescript
// Structured logging
yield* Effect.log("Processing order", { orderId, userId, amount })

// Metrics
const orderCounter = Metric.counter("orders_processed")
yield* Metric.increment(orderCounter)

// Config with validation
const config = Config.all({
    port: Config.integer("PORT").pipe(Config.withDefault(3000)),
    apiKey: Config.redacted("API_KEY"),
    maxRetries: Config.integer("MAX_RETRIES").pipe(
        Config.validate({ message: "Must be positive", validation: (n) => n > 0 })
    ),
})
```

See `references/observability-patterns.md` for metrics and tracing patterns.

## Reference Files

For detailed patterns, consult these reference files in the `references/` directory:

- `language-server.md` - Effect Language Service setup, diagnostics, refactors, CLI tools
- `service-patterns.md` - Service contracts, implementation ownership, Effect.fn
- `error-patterns.md` - Schema.TaggedError, error remapping, retry patterns
- `schema-patterns.md` - Branded types, transforms, Schema.Class
- `layer-patterns.md` - Dependency composition, testing layers
- `rpc-cluster-patterns.md` - RpcGroup, Workflow, Activity patterns
- `effect-atom-patterns.md` - Atom, families, React hooks, Result handling
- `anti-patterns.md` - Complete list of forbidden patterns
- `observability-patterns.md` - Logging, metrics, config patterns
