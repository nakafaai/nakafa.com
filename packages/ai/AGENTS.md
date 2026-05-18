# AI Package Agent Guide

`packages/ai` is an Effect-first package. Keep agent orchestration, tool execution, provider calls, search, scraping, weather, and repair flows explicit in Effect.

## Effect Rules

- Use `Effect.fn("domain.operation")` for exported effectful functions.
- Use `Schema.TaggedError` for expected provider, validation, generation, and safety failures.
- Use `catchTag` or `catchTags` when the error type is known.
- Avoid raw `try/catch`; use `Effect.try`, `Effect.tryPromise`, or safe platform APIs like `URL.canParse`.
- Avoid raw `async` business logic. Use `Effect.runPromise` only at external framework boundaries such as AI SDK tool `execute` handlers.
- Use `Context.Tag` only for runtime-injected infrastructure adapters. Use `Effect.Service` for business services with dependencies.
- Keep provider configuration and environment access inside config/env boundary modules.
- Prefer direct imports. Do not add barrels or wrapper chains.

## Review Checklist

- Top-level specialist delegation uses compact structured input; internal agent tasks may be formatted from that input behind the tool seam.
- Search/source scoping must be language-neutral and must not rely on hardcoded user-language keywords.
- UI data parts must reflect the actual provider call and scoped source set.
- Final agent output must be backed by retrieved evidence, deterministic math, or a clear limitation.
