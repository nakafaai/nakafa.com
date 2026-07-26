# Service Patterns

## Contents

- [Stable contracts](#stable-contracts-with-contexttag-and-layer)
- [Deliberate Effect.Service adoption](#deliberate-effectservice-adoption)
- [Effect.fn tracing](#effectfn-for-tracing)
- [Runtime-injected tags](#runtime-injected-contexttag-examples)
- [Single responsibility](#single-responsibility)
- [Service interfaces](#service-interface-patterns)
- [Testing](#testing-services)

## Stable Contracts With Context.Tag And Layer

Effect 3.22 documents `Context.Tag` plus `Layer` as the stable service pattern.
The pinned source marks `Effect.Service` experimental, so it is not a universal
replacement for `Context.Tag`.

Keep ownership explicit:

- The tag owns the contract.
- A layer owns one implementation.
- The application composition root chooses the implementation.
- Effect requirements keep missing dependencies visible in the type.

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

Provide requirements once when composing layers:

```typescript
const AppLive = Layer.mergeAll(
    UserServiceLive.pipe(Layer.provide(UserRepoLive)),
    OrderServiceLive.pipe(Layer.provide(OrderRepoLive)),
)
```

## Deliberate Effect.Service Adoption

`Effect.Service` may combine a tag with a module-owned default layer when all of
these conditions hold:

- The repository deliberately accepts its experimental Effect 3.22 status.
- The module genuinely owns a canonical default implementation.
- Importing the contract may intentionally expose that default.
- Alternate implementations remain easy to provide in tests and other runtimes.

When those conditions hold, declare default-layer requirements in the
`dependencies` array. Otherwise use `Context.Tag` plus a separately owned layer.

## Effect.fn for Tracing

**Always wrap service methods with `Effect.fn`**. This provides automatic tracing with meaningful span names.

### Naming Convention

Use `ServiceName.methodName` format for span names:

```typescript
const findById = Effect.fn("UserService.findById")(function* (id: UserId) {
    yield* Effect.annotateCurrentSpan("userId", id)
    // Implementation
})

const processPayment = Effect.fn("PaymentService.processPayment")(
    function* (orderId: OrderId, amount: number, currency: string) {
        yield* Effect.annotateCurrentSpan("orderId", orderId)
        yield* Effect.annotateCurrentSpan("amount", amount)
        yield* Effect.annotateCurrentSpan("currency", currency)
        // Implementation
    }
)
```

### Annotating Spans

Add important context to spans, but don't overdo it:

```typescript
// CORRECT - Important business identifiers
yield* Effect.annotateCurrentSpan("userId", userId)
yield* Effect.annotateCurrentSpan("orderId", orderId)
yield* Effect.annotateCurrentSpan("amount", amount)

// WRONG - Too much detail, noise in traces
yield* Effect.annotateCurrentSpan("userEmail", user.email)
yield* Effect.annotateCurrentSpan("userName", user.name)
yield* Effect.annotateCurrentSpan("userCreatedAt", user.createdAt)
yield* Effect.annotateCurrentSpan("step", "validating")
yield* Effect.annotateCurrentSpan("step", "processing")
yield* Effect.annotateCurrentSpan("step", "completing")
```

## Runtime-Injected Context.Tag Examples

Runtime-injected infrastructure is another clear use of the stable tag pattern:

### Cloudflare Worker Bindings

```typescript
import { Context } from "effect"

// These are provided by the runtime, not created by our code
export class KVNamespace extends Context.Tag("KVNamespace")<
    KVNamespace,
    CloudflareKVNamespace
>() {}

export class R2Bucket extends Context.Tag("R2Bucket")<
    R2Bucket,
    CloudflareR2Bucket
>() {}

// In the worker entry point
const handler = {
    fetch(request: Request, env: Env) {
        return program.pipe(
            Effect.provideService(KVNamespace, env.MY_KV),
            Effect.provideService(R2Bucket, env.MY_BUCKET),
            Effect.runPromise,
        )
    }
}
```

### Database/Redis Clients (Infrastructure)

```typescript
// Infrastructure provided at app root - acceptable as Context.Tag
// But prefer using @effect/sql or similar typed clients

import { PgClient } from "@effect/sql-pg"

// PgClient is already a Context.Tag from the library
// Just provide it at the app root
const DatabaseLive = PgClient.layer({
    host: Config.string("DB_HOST"),
    port: Config.integer("DB_PORT"),
    database: Config.string("DB_NAME"),
    // ...
})
```

## Single Responsibility

Each service should have a focused responsibility:

```typescript
// CORRECT - Focused services
export class UserService extends Context.Tag("UserService")<
    UserService,
    UserOperations
>() {}
export class AuthService extends Context.Tag("AuthService")<
    AuthService,
    AuthOperations
>() {}
export class NotificationService extends Context.Tag("NotificationService")<
    NotificationService,
    NotificationOperations
>() {}

// WRONG - God service doing everything
export class AppService extends Context.Tag("AppService")<
    AppService,
    UserOperations & AuthOperations & NotificationOperations & PaymentOperations
>() {}
```

## Service Interface Patterns

### Return Types

Services should return `Effect` types, never `Promise`:

```typescript
// CORRECT
const findById = Effect.fn("UserService.findById")(
    function* (id: UserId): Effect.Effect<User, UserNotFoundError> {
        // ...
    }
)

// WRONG - Promise in service interface
const findById = async (id: UserId): Promise<User> => {
    // ...
}
```

### Use Option for Nullable Results

```typescript
// CORRECT - findById can fail, findByIdOption returns Option
const findById = Effect.fn("UserService.findById")(
    function* (id: UserId): Effect.Effect<User, UserNotFoundError> {
        const maybeUser = yield* repo.findById(id)
        return yield* Option.match(maybeUser, {
            onNone: () => Effect.fail(new UserNotFoundError({ userId: id, message: "Not found" })),
            onSome: Effect.succeed,
        })
    }
)

const findByIdOption = Effect.fn("UserService.findByIdOption")(
    function* (id: UserId): Effect.Effect<Option<User>> {
        return yield* repo.findById(id)
    }
)
```

## Testing Services

Create test implementations using the same pattern:

```typescript
// Test implementation
export const UserServiceTest = Layer.succeed(
    UserService,
    UserService.of({
        register: (input) => Effect.succeed({ ...mockUser, ...input }),
    })
)

// Stateful test implementation with the same stable tag contract
export const UserServiceInMemory = Layer.effect(
    UserService,
    Effect.sync(() => {
        const usersByEmail = new Map<string, User>()

        const register = Effect.fn("UserService.register")(function* (
            input: CreateUserInput,
        ) {
            if (usersByEmail.has(input.email)) {
                return yield* new EmailAlreadyRegisteredError({
                    email: input.email,
                    message: "Email is already registered",
                })
            }
            const user = makeTestUser(usersByEmail.size, input)
            usersByEmail.set(user.email, user)
            return user
        })

        return UserService.of({ register })
    }),
)
```
