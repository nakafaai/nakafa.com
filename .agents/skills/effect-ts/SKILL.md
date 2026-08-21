---
name: effect-ts
description: Effect v4 implementation and review workflow for Nakafa. Use for TypeScript that imports effect, @effect/vitest, @effect/tsgo, or a remaining v4 ecosystem package.
---

# Effect v4 in Nakafa

Use retrieval-led reasoning. This repository deliberately targets one exact Effect v4 cohort and does not retain v3 compatibility code.

## Required sources

Before writing or reviewing Effect code:

1. Read the root and nearest package `AGENTS.md` files.
2. Read `repos/effect/.agents/AGENTS.md` completely.
3. Confirm `pnpm effect:source:check` passes.
4. Inspect the matching implementation, tests, type tests, and JSDoc under `repos/effect/packages/effect`.
5. Inspect the installed package source when behavior involves `@effect/vitest`, `@effect/tsgo`, or another separate package.
6. Use the official v4 migration guide for renamed or removed APIs: <https://github.com/Effect-TS/effect/blob/main/MIGRATION.md>.

Do not use examples for Effect v3 or another prerelease. Do not guess API shape from memory.

## Package rules

- Keep `effect`, `@effect/vitest`, and every remaining Effect ecosystem package on one exact version.
- Core functionality formerly published through `@effect/platform`, `@effect/rpc`, and similar packages now belongs to `effect`.
- Use core exports such as `effect/Schema`, `effect/Cause`, or the top-level `effect` entrypoint for stable modules.
- Use `effect/unstable/*` only where the capability still lives in the v4 unstable module system.
- Keep provider and runtime packages such as `@effect/platform-node` only when their implementation is required.
- Never add a standalone `@effect/language-service` dependency. The tsconfig plugin string remains `@effect/language-service` because `@effect/tsgo` reads it.

## Services and layers

- Define real dependency seams with `Context.Service`.
- Keep the service Interface separate from its live Implementation unless the owning Module intentionally provides both.
- Construct implementations with `Layer.succeed`, `Layer.effect`, or a scoped Layer as required by the resource lifetime.
- Provide dependencies at composition roots.
- Do not add service abstractions for pure helpers, one caller, or values that do not need substitution.

```ts
import { Context, Effect, Layer } from "effect"

interface ClockService {
  readonly now: Effect.Effect<number>
}

class Clock extends Context.Service<Clock, ClockService>()("Clock") {}

const ClockLive = Layer.succeed(Clock, {
  now: Effect.sync(() => Date.now())
})
```

## Programs and failures

- Use `Effect.fn("domain.operation")` for exported fallible or effectful operations.
- Keep generators flat and name meaningful stages.
- Model expected failures with specific `Schema.TaggedError` classes.
- Handle known errors with `catchTag` or `catchTags`.
- Preserve the full Cause at outer diagnostic boundaries instead of flattening defects into generic errors.
- Use `Effect.try`, `Effect.tryPromise`, `Effect.promise`, and resource-safe constructors for external work.
- Keep pure deterministic transformations pure.
- Run Effects only at framework, CLI, script, event, or explicit test boundaries.

## Schemas

- Derive public types from their runtime Schema.
- Use `Schema.optionalKey` when a generated JSON object property may be absent but must not encode JavaScript `undefined`.
- Use `Schema.optional` only when both absence and `undefined` are meaningful in the TypeScript contract.
- Validate model-facing JSON Schema output against actual v4 output, including references and composition keywords.
- Do not preserve v3 parser errors, v3 class helpers, or manual duplicate unions.

## Testing

The repository shared adapter is `@repo/testing/effect`, backed by the matching `@effect/vitest` cohort.

- Use `it.effect` for Effect programs with test services and a Scope.
- Use `it.live` only when the test intentionally needs live services.
- Use `it.layer` or the exported `layer` helper when several tests share a Layer.
- Keep pure tests as normal Vitest tests.
- Assert tagged failures and their domain fields directly. Do not assert Effect v3 FiberFailure display strings.
- Make scheduling explicit with Effect primitives such as `Deferred`, `TestClock`, or `Effect.yieldNow`. Do not depend on incidental fiber ordering.

## TypeScript and diagnostics

- Keep `@effect/tsgo` pinned in the root toolchain.
- Keep `effect-tsgo patch --typescript-package @typescript/native` in the root `prepare` script.
- Use the patched native TypeScript 7 compiler for repository typechecks.
- Keep TypeScript 6 only at documented JavaScript compiler API boundaries.
- Do not run plain tsgo and effect-tsgo as parallel editor servers.
- Zed uses its official `typescript-ls` server. Repository and CI diagnostics come from the patched native compiler.

## Verification

Run the smallest relevant checks first, then the repository gates. A complete migration must prove:

- one exact Effect v4 cohort in the dependency graph;
- no v3 packages, consolidated package imports, or removed v3 APIs in authored code, tests, configs, docs, skills, or scripts;
- only the required tsconfig plugin string mentions `@effect/language-service`;
- `pnpm effect:source:check` passes;
- the temporary floating-Effect fixture produces the expected diagnostic and is removed;
- affected typechecks, tests, lint, boundaries, and build pass.
