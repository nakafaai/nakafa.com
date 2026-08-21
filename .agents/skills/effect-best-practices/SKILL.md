---
name: effect-best-practices
description: Review Nakafa Effect v4 code for package, service, schema, error, runtime, scheduling, and testing correctness.
---

# Effect v4 review

Read `../effect-ts/SKILL.md` completely before using this checklist. Treat the exact installed source and `repos/effect` as authoritative.

## Architecture

- The Module owns one clear capability and a small public Interface.
- `Context.Service` represents a real dependency seam, not a wrapper around a pure function.
- Layers compose at ownership boundaries without compatibility facades or duplicate implementations.
- Effects remain composed until an explicit framework, CLI, event, or test boundary.
- Expected failures remain specific tagged values in the error channel.

## v4 correctness

- No `Effect.Service`, class-style `Context.Tag`, standalone `@effect/platform`, standalone `@effect/language-service`, or another v3-only dependency remains.
- Cause handling follows the v4 flattened representation and matching source APIs.
- Package versions belong to the exact shared v4 cohort.
- Unstable imports are limited to capabilities that v4 still exposes under `effect/unstable/*`.
- Schema optionality reflects the encoded contract, especially for generated JSON Schema.

## Concurrency and resources

- Scheduling assumptions are explicit and tested with Effect primitives.
- Resources use Scope and release paths that are exercised by tests.
- Interruptions do not leave fibers, readers, timers, or subscriptions active.
- Tests never depend on incidental scheduler order or v3 FiberFailure strings.

## Tooling

- Effect tests use `@repo/testing/effect` where the test body is effectful.
- Typechecks use the Effect-patched native TypeScript 7 compiler.
- The `@effect/language-service` text appears only as the tsconfig plugin name or an explicit dependency-policy rejection fixture.
- `pnpm effect:source:check`, targeted tests, workspace typechecks, and the relevant full gates pass.
