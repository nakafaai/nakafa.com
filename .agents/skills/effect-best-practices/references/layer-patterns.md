# Layer Patterns

## Contents

- [Dependency requirements](#dependency-requirements)
- [Infrastructure layers](#infrastructure-layers)
- [Flat composition](#layermergeall-over-nested-provides)
- [Sequential composition](#layerprovidemerge-for-sequential-composition)
- [Deduplication](#layer-deduplication-benefits)
- [TypeScript performance](#typescript-lsp-performance)
- [Configuration](#layerconfig-pattern)
- [Naming](#layer-naming-conventions)
- [Config-dependent layers](#layerunwrapeffect-for-config-dependent-layers)
- [Scoped layers](#scoped-layers)
- [Testing](#testing-layer-composition)
- [Constructors](#layereffect-vs-layersucceed)
- [Lazy layers](#lazy-layers)

## Dependency Requirements

Use `Context.Tag` plus `Layer` as the stable Effect 3.22 default. Keep each
service contract separate from its implementations. A consuming layer exposes
dependencies in its `RIn` type, and the composition root chooses the
implementations once.

### Correct Pattern

```typescript
export class OrderService extends Context.Tag("OrderService")<
    OrderService,
    {
        readonly place: (input: PlaceOrderInput) => Effect.Effect<Order, PlaceOrderError>
    }
>() {}

export const OrderServiceLive = Layer.effect(
    OrderService,
    Effect.gen(function* () {
        const users = yield* UserService
        const products = yield* ProductService
        const inventory = yield* InventoryService
        const payments = yield* PaymentService

        const place = makePlaceOrder({ users, products, inventory, payments })
        return OrderService.of({ place })
    }),
)

const OrderDependenciesLive = Layer.mergeAll(
    UserServiceLive,
    ProductServiceLive,
    InventoryServiceLive,
    PaymentServiceLive,
)

const AppLive = Layer.mergeAll(
    OrderServiceLive.pipe(Layer.provide(OrderDependenciesLive)),
    NotificationServiceLive,
    AnalyticsServiceLive,
)
```

Do not rebuild this dependency graph with repeated `Effect.provide` calls at
each usage site.

## Infrastructure Layers

Dependency ownership does not change because a requirement is infrastructure.
Database, cache, and HTTP services may be supplied once at the application
boundary, but the layer that consumes them must still expose those requirements
in its `RIn` type. Tests can then replace the same requirements without hidden
wiring.

```typescript
import { PgClient } from "@effect/sql-pg"

const DatabaseLive = PgClient.layer({
    host: Config.string("DB_HOST"),
    port: Config.integer("DB_PORT"),
    database: Config.string("DB_NAME"),
    username: Config.string("DB_USER"),
    password: Config.redacted("DB_PASSWORD"),
})

export class UserRepo extends Context.Tag("UserRepo")<
    UserRepo,
    {
        readonly findById: (id: UserId) => Effect.Effect<Option.Option<User>, SqlError>
    }
>() {}

// UserRepoLive declares PgClient as an input requirement through Layer's RIn.
const UserRepoLive = Layer.effect(
    UserRepo,
    Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        const findById = Effect.fn("UserRepo.findById")(function* (id: UserId) {
            // Query and decode through the repository's schemas.
            return yield* loadUser(sql, id)
        })

        return UserRepo.of({ findById })
    }),
)

const AppLive = Layer.mergeAll(
    OrderServiceLive,
    UserRepoLive,
).pipe(
    Layer.provide(DatabaseLive),
)
```

## Layer.mergeAll Over Nested Provides

**Use `Layer.mergeAll`** for composing layers at the same level:

```typescript
// CORRECT - Flat composition
const ServicesLive = Layer.mergeAll(
    UserServiceLive,
    OrderServiceLive,
    ProductServiceLive,
    NotificationServiceLive,
)

const InfrastructureLive = Layer.mergeAll(
    DatabaseLive,
    RedisLive,
    HttpClientLive,
)

const AppLive = ServicesLive.pipe(
    Layer.provide(InfrastructureLive),
)
```

```typescript
// WRONG - Deeply nested, hard to read
const AppLive = UserServiceLive.pipe(
    Layer.provide(
        OrderServiceLive.pipe(
            Layer.provide(
                ProductServiceLive.pipe(
                    Layer.provide(DatabaseLive),
                ),
            ),
        ),
    ),
)
```

## Layer.provideMerge for Sequential Composition

**Use `Layer.provideMerge`** when chaining layers that need incremental composition. Unlike `Layer.provide`, `provideMerge` merges the output into the current layer, producing flatter types.

```typescript
// CORRECT - Layer.provideMerge chains for incremental composition
const MainLive = DatabaseLive.pipe(
    Layer.provideMerge(ProxyConfigServiceLive),
    Layer.provideMerge(LoggerLive),
    Layer.provideMerge(CacheLive),
    Layer.provideMerge(TracerLive),
)

// WRONG - Multiple Layer.provide calls create nested types
const MainLive = DatabaseLive.pipe(
    Layer.provide(ProxyConfigServiceLive),
    Layer.provide(LoggerLive),  // Each provide creates deeper nesting
    Layer.provide(CacheLive),
)
```

**Key difference:** `Layer.provide(A, B)` provides B to A but outputs only A's services. `Layer.provideMerge(A, B)` provides B to A and outputs both A's and B's services merged together.

## Layer Deduplication Benefits

Layers automatically memoize construction - the same service is instantiated only once regardless of how many times it appears in the dependency graph.

```typescript
// Both UserRepo and OrderRepo depend on DatabaseLive
const RepoLive = Layer.mergeAll(
    UserRepoLive,   // requires DatabaseLive
    OrderRepoLive,  // requires DatabaseLive
)

// With Layer.mergeAll, DatabaseLive is constructed ONCE
const AppLive = RepoLive.pipe(
    Layer.provide(DatabaseLive), // Single instance shared
)
```

Use the composed layer rather than separately providing each repository:

```typescript
const program = myEffect.pipe(
    Effect.provide(AppLive), // Single composed layer
)
```

## TypeScript LSP Performance

Deeply nested `Layer.provide` chains create complex recursive types that slow down the TypeScript Language Server.

```typescript
// PROBLEMATIC - Deep nesting causes slow LSP
const AppLive = Layer1.pipe(
    Layer.provide(Layer2.pipe(
        Layer.provide(Layer3.pipe(
            Layer.provide(Layer4.pipe(
                Layer.provide(Layer5),
            )),
        )),
    )),
)
// Type becomes: Layer<..., Layer<..., Layer<..., Layer<..., ...>>>>
```

```typescript
// BETTER - Flat composition with mergeAll produces simpler types
const InfraLive = Layer.mergeAll(Layer3, Layer4, Layer5)
const AppLive = Layer.mergeAll(Layer1, Layer2).pipe(
    Layer.provide(InfraLive),
)
// Type is flatter and LSP responds faster
```

**Recommendations:**
- Prefer `Layer.mergeAll` for layers at the same level
- Use `Layer.provideMerge` instead of chained `Layer.provide` calls
- Group related layers into intermediate compositions
- Keep nesting depth shallow (ideally 2-3 levels max)

## layerConfig Pattern

For services that need configuration at construction time, expose a
configuration-driven layer factory:

```typescript
import { Config, ConfigError, Context, Effect, Layer } from "effect"

interface EventQueueConfig {
    readonly maxRetries: number
    readonly batchSize: number
    readonly pollInterval: number
}

export class ElectricEventQueue extends Context.Tag("ElectricEventQueue")<
    ElectricEventQueue,
    {
        readonly publish: (
            events: ReadonlyArray<Event>,
        ) => Effect.Effect<void, EventQueueError>
    }
>() {}

export const makeEventQueueLive = (
    config: Config.Config.Wrap<EventQueueConfig>,
): Layer.Layer<ElectricEventQueue, ConfigError.ConfigError> =>
    Layer.unwrapEffect(
        Config.unwrap(config).pipe(
            Effect.map((value) =>
                Layer.succeed(
                    ElectricEventQueue,
                    ElectricEventQueue.of(makeElectricEventQueue(value)),
                ),
            )
        )
    )

const EventQueueLive = makeEventQueueLive({
    maxRetries: Config.integer("EVENT_QUEUE_MAX_RETRIES").pipe(
        Config.withDefault(3)
    ),
    batchSize: Config.integer("EVENT_QUEUE_BATCH_SIZE").pipe(
        Config.withDefault(100)
    ),
    pollInterval: Config.integer("EVENT_QUEUE_POLL_INTERVAL").pipe(
        Config.withDefault(1000)
    ),
})
```

This pattern:
- Separates configuration from implementation
- Returns `ConfigError` for missing/invalid config
- Allows different configs per environment
- Integrates cleanly with `Layer.mergeAll` and `Layer.provideMerge`

## Layer Naming Conventions

Use suffixes to indicate layer type:

- `ServiceLive` - Production implementation
- `ServiceTest` - Test/mock implementation
- `ServiceLayer` - Generic layer (rare)

```typescript
// Production
export const UserServiceLive = Layer.effect(
    UserService,
    makeUserService,
)

// Test with mocks
export const UserServiceTest = Layer.succeed(
    UserService,
    UserService.of({
        findById: (id) => Effect.succeed(mockUser),
        create: (input) => Effect.succeed({ id: UserId.make("test-id"), ...input }),
    })
)

// Test with in-memory state
export const UserServiceInMemory = Layer.effect(
    UserService,
    Effect.sync(() => {
        const store = new Map<string, User>()

        return UserService.of({
            findById: Effect.fn("UserService.findById")(function* (id) {
                const user = store.get(id)
                if (!user) return yield* Effect.fail(new UserNotFoundError({ userId: id }))
                return user
            }),
            create: Effect.fn("UserService.create")(function* (input) {
                const user = makeTestUser(store.size, input)
                store.set(user.id, user)
                return user
            }),
        })
    }),
)
```

## Layer.unwrapEffect for Config-Dependent Layers

When a layer needs async configuration:

```typescript
import { Config, Effect, Layer } from "effect"

// Layer that depends on config
const ApiClientLive = Layer.unwrapEffect(
    Effect.gen(function* () {
        const apiKey = yield* Config.string("API_KEY")
        const baseUrl = yield* Config.string("API_BASE_URL")
        const timeout = yield* Config.integer("API_TIMEOUT").pipe(
            Config.withDefault(5000)
        )

        return Layer.succeed(
            ApiClient,
            new ApiClientImpl({ apiKey, baseUrl, timeout })
        )
    })
)

// Layer that validates config
const ValidatedConfigLive = Layer.unwrapEffect(
    Effect.gen(function* () {
        const config = yield* Config.all({
            dbUrl: Config.string("DATABASE_URL"),
            redisUrl: Config.string("REDIS_URL"),
            port: Config.integer("PORT"),
        })

        // Validate config
        if (!config.dbUrl.startsWith("postgresql://")) {
            return yield* Effect.fail(new ConfigError({ message: "Invalid DATABASE_URL" }))
        }

        return Layer.succeed(AppConfig, config)
    })
)
```

## Scoped Layers

For resources that need cleanup:

```typescript
import { Effect, Layer, Scope } from "effect"

// Resource that needs cleanup
const DatabaseConnectionLive = Layer.scoped(
    DatabaseConnection,
    Effect.acquireRelease(
        Effect.gen(function* () {
            const pool = yield* createPool(config)
            yield* Effect.log("Database pool created")
            return pool
        }),
        (pool) =>
            Effect.gen(function* () {
                yield* pool.end()
                yield* Effect.log("Database pool closed")
            }).pipe(Effect.orDie)
    )
)

// Repository layer exposes DatabaseConnection in its RIn type.
export class UserRepo extends Context.Tag("UserRepo")<
    UserRepo,
    {
        readonly findById: (
            id: UserId,
        ) => Effect.Effect<Option.Option<User>, DatabaseError>
    }
>() {}

export const UserRepoLive = Layer.effect(
    UserRepo,
    Effect.gen(function* () {
        const db = yield* DatabaseConnection

        return UserRepo.of({
            findById: Effect.fn("UserRepo.findById")(function* (id) {
                return yield* loadUser(db, id)
            }),
        })
    }),
)
```

## Testing Layer Composition

```typescript
// test/setup.ts
import { Layer } from "effect"

export const TestLive = Layer.mergeAll(
    UserServiceTest,
    OrderServiceTest,
    ProductServiceTest,
).pipe(
    Layer.provide(InMemoryDatabaseLive),
)

// test/user.test.ts
import { Effect } from "effect"
import { TestLive } from "./setup"

describe("UserService", () => {
    it("creates users", async () => {
        const program = Effect.gen(function* () {
            const user = yield* UserService.create({
                email: "test@example.com",
                name: "Test User",
            })
            expect(user.email).toBe("test@example.com")
        })

        await Effect.runPromise(program.pipe(Effect.provide(TestLive)))
    })
})
```

## Layer.effect vs Layer.succeed

```typescript
// Layer.succeed - for static values (no effects)
const ConfigLive = Layer.succeed(AppConfig, {
    port: 3000,
    env: "development",
})

// Layer.effect - when construction needs effects
const LoggerLive = Layer.effect(
    Logger,
    Effect.gen(function* () {
        const config = yield* AppConfig
        const transport = config.env === "production"
            ? createCloudTransport()
            : createConsoleTransport()
        return new LoggerImpl(transport)
    })
)
```

## Lazy Layers

For expensive initialization that should be deferred:

```typescript
const ExpensiveServiceLive = Layer.lazy(() => {
    // This code runs only when the layer is first used
    return Layer.effect(
        ExpensiveService,
        Effect.gen(function* () {
            yield* Effect.log("Initializing expensive service...")
            const client = yield* createExpensiveClient()
            return new ExpensiveServiceImpl(client)
        })
    )
})
```
