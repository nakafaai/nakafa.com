# Nakafa Codebase Agent Guide

Build for longevity. Favor readable, skimmable, well-verified code over speed or cleverness.

## Evidence And Scope

- Read repository code, package manifests, configuration, generated files, installed source, and current official documentation before changing behavior.
- This file is the repository baseline. Read `packages/backend/AGENTS.md` before any Convex work and `packages/backend/convex/_generated/ai/guidelines.md` before editing Convex code.
- Use the enabled official Convex and Vercel plugin skills for generic ecosystem guidance. Use globally installed upstream skills when their scope matches. Do not add repository-local skill copies or generate new app-local `AGENTS.md` or `CLAUDE.md` files. The existing Convex-managed backend files are the only package-local exception.
- Skim recent `git log` before structural work so old patterns are not reintroduced.
- Read the touched package's `package.json`, configuration, and nearby implementation before editing. Follow current local patterns unless evidence supports changing them.

## Stack And Ownership

- Package manager: `pnpm@11.23.0`
- Runtime: Node `24.x` through pnpm `devEngines.runtime`
- Monorepo: Turborepo
- Frontend: Next.js 16, React 19, TypeScript 7 CLI with TypeScript 6 API compatibility
- Backend: Convex
- Lint and format: Biome through Ultracite
- Tests: Vitest
- Apps: `apps/www`, `apps/api`, `apps/mcp`, `apps/email`
- Main packages: `packages/backend`, `packages/design-system`, `packages/contents`, `packages/ai`, `packages/testing`
- Same-app imports use `@/*`; cross-package imports use `@repo/*`.
- `packages/testing` owns shared Vitest defaults by runtime. Node workspaces use `@repo/testing/node`, React workspaces use `@repo/testing/react`, and each workspace keeps only local aliases, setup, projects, and coverage policy.
- `packages/utilities` owns generic cross-domain primitives only. Keep content contracts, roles, taxonomy, Convex values, AI vocabulary, UI copy, and product helpers in their domain-owning package.
- Aksara exclusively owns authored content and signed publication for every content scope. For authored content work, open the Aksara repository and use its repository-local `nakafa-content` skill. `packages/contents` owns only live Nakafa product, formatting, route-context, learner, and agent contracts. Never copy that skill into Nakafa or global storage, and never add a second authored source, filesystem copy, or local publication writer.

## Architecture, TypeScript, And Imports

- Keep changes cohesive and complete. Remove dead, redundant, obsolete, repair-only, and legacy paths after proving they are unused in every relevant environment.
- Prefer direct control flow, early returns, and small domain-owned modules. Avoid wrapper chains, compatibility facades, catch-all utility folders, and abstractions that do not reduce complexity.
- Hand-written `.ts` and `.tsx` modules should target 300 LOC or less. A new or touched hand-written file over 500 LOC blocks readiness unless it is generated, vendor data, source corpus, or intentionally dense curriculum data where splitting reduces locality. Record any exception.
- For touched files over 500 LOC, identify the Module, Interface, Implementation, Seam, Depth, Leverage, and Locality before editing. Decompose by real capability, not by moving the same mapping or filtering into shallow files.
- Apply the deletion test: deleting a proposed module should concentrate meaningful complexity, not merely relocate it.
- Name new folders and files with one concise domain word per path segment whenever the toolchain permits it. Avoid hyphenated phrases, repeated parent wording, and names that restate the containing capability.
- Do not create new `index.ts` barrels, hand-written facade modules, pass-through re-exports, generic `utils` or `helpers`, or imports whose only purpose is re-exporting. Generated or externally mandated package entrypoints require an explicit exception.
- TypeScript is strict. Prefer derived and inferred types, fix the source design when inference is unclear, avoid `any`, narrow real `unknown` values quickly, and avoid assertions or workaround casts.
- Runtime contracts own public types. Derive from Effect Schema, Convex validators, and generated Convex types. Never duplicate domain unions, value sets, schemas, validators, constants, or UI options.
- The root exposes the Effect-patched native TypeScript 7 compiler as `tsc`. The `typescript` package remains the TypeScript 6 compatibility API for Next.js, Ultracite, and language-service consumers. `packages/backend` owns its package-local native compiler because Convex resolves it directly. Verify with `pnpm exec tsc --version`; use `pnpm exec tsc6 --version` only for compatibility diagnostics.
- Formatting is owned by Ultracite. Use spaces, double quotes, `import type`, and clear external, workspace, then app-local import groups. Run `pnpm format` instead of hand-formatting.
- New or touched app TypeScript modules use direct `@/` imports for same-app modules, including colocated modules and tests. Across workspaces use `@repo/*`. Prefer direct owning-file imports over new barrels.
- Keep Tailwind class strings inside styling utilities or component boundaries. Use `cva` or existing variant helpers for reusable or variant-driven styling.

## Effect V4 Standard

- This is an Effect-native TypeScript codebase. New or touched effectful domain capabilities start with Schema contracts, branded values where identity matters, tagged errors, small named `Effect.fn` programs, and `Context.Service` plus `Layer` only for real dependency seams.
- Effectful work includes filesystem IO, network calls, database and client calls, dynamic imports, asynchronous orchestration, shared caches, environment reads, logging, schema failures, and expected domain failures. Model and compose these operations directly instead of wrapping raw TypeScript later.
- Public module interfaces expose schema-derived contracts and Effect-native operations for fallible, effectful, cross-source, or cross-module work. Source registries decode typed rows; projections compose them without silent filtering, fallback strings, or duplicated maps.
- Model expected failures with specific `Schema.TaggedError` or `Data.TaggedError` types. Do not use `null`, generic `Error`, raw throws, parser exceptions, or silent fallbacks for expected domain failures.
- Use `Effect.fn("domain.operation")` for exported effectful functions and service methods. Use `Effect.try`, `Effect.tryPromise`, `Effect.acquireRelease`, `Effect.sync`, `Predicate.*`, `Option`, `Config.*`, and Effect logging at their proper seams.
- Handle known errors with `catchTag` or `catchTags`. Avoid `catchAll` unless an outer boundary intentionally preserves the complete cause.
- `Effect.runPromise`, `Effect.runSync`, and `Effect.runPromiseExit` belong only at framework, CLI, script-main, test, or browser event boundaries. Services, domain modules, projections, and helper chains compose Effects without running them.
- Private pure helpers are allowed only for small deterministic transformations after validation when they cannot fail, perform IO, access dependencies, mutate shared state, or define a public source of truth.
- Name shared modules by domain capability, such as `lib/analytics`, `lib/content`, or `lib/checkout`. Do not create `lib/effect` catch-alls.
- In `packages/ai`, keep provider calls, tool execution, search, scraping, repair, and orchestration explicit in Effect. Keep provider configuration in config boundaries, make source scoping language-neutral, reflect actual provider calls in UI data, and back final output with retrieved evidence, deterministic math, or a stated limitation.
- Do not start a non-fast-path Effect runtime inside a statically prerendered Server Component before Next.js has request or uncached data. Use the framework Promise boundary for request-less static work and document the exception with `https://nextjs.org/docs/messages/next-prerender-current-time`.
- After touching app effectful code, scan touched paths for raw `try/catch`. After touching domain source or projections, scan for assertions, broad records, `any`, generic errors, raw throws, runners, and silent source fallbacks. Explain every retained framework exception.
- Tests for Effect-domain seams assert typed failure behavior as well as success.

### Vendored Effect Reference

- `repos/effect` is a read-only Git subtree pinned to the installed `effect` version. Before writing or reviewing Effect code, read `repos/effect/LLMS.md` and `repos/effect/.agents/AGENTS.md`, then inspect relevant implementation, tests, type-level tests, modules, and API design.
- Prefer matching vendored source over memory, declarations, or examples from another major version. Never edit, import from, build, lint, or test `repos/effect` as Nakafa application code.
- `pnpm effect:source:check` verifies version parity. After committing an Effect dependency update, run `pnpm effect:source:update` to create the matching linear reference update commit.
- Follow the official source-vendoring guidance at `https://www.effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive`.

## React And Next.js

- Before React composition work, use the globally installed upstream `vercel-composition-patterns` skill. Use the official Vercel React, Next.js, and shadcn plugin skills when their focused guidance applies.
- Before Next.js work, find the installed version-matched documentation with `find . -path '*/node_modules/next/dist/docs' -type d -print`. Installed docs and source are authoritative for APIs, file conventions, and deprecations.
- Follow existing React 19 patterns. Use function components, add `"use client"` only when needed, keep hooks at the top level, derive values instead of adding effects, and check Mantine Hooks before creating a custom hook.
- Keep server and client boundaries explicit and minimal. Use semantic HTML, accessible component APIs, and Next.js primitives such as `<Image>` where appropriate.
- New or touched route UI reuses established Nakafa and design-system surfaces. Route migrations may change data or URL shape but must not introduce bespoke shells, cards, hover treatments, or list styling when an existing component owns the pattern.
- With Cache Components, keep static content in prerendering. Do not hide current-time errors behind a dynamic boundary.
- Use `io()` from `next/cache` before synchronous request-time work that should stream or participate in partial prefetching. Use `connection()` only when rendering must wait for a real request. Existing asynchronous data access already provides a suspension point unless synchronous work starts first.
- Keep `experimental.instantInsights.validationLevel` at `"warning"`. Do not add redundant `instant = true` exports. Use `instant = false` only for a route deliberately allowed to block navigation.
- Keep the shared App Shell as the default prefetch. Use `<Link prefetch={true}>` only when URL-dependent cached content justifies one server invocation per link. For grids and long lists, prefetch on user intent.
- Keep truthful stable UI outside `Suspense`. When no truthful fallback exists, use `fallback={null}`. Never invent skeletons or fake content solely to satisfy navigation validation.
- Keep the real root layout in `[locale]`, use `next/root-params` only on the server, and prefer next-intl server APIs such as `getLocale()` over manually threading locale through Server Components.

## Convex

- `packages/backend/AGENTS.md` owns Convex architecture, deployment isolation, auth, validator, migration, and source-of-truth rules. Do not duplicate them here.
- Prefer direct Convex queries and mutations for app data. Add Next.js Server Actions or Route Handlers only for real framework boundaries such as cookies, headers, cache invalidation, or non-Convex integrations, and document that reason at the seam.
- Treat every public Convex function used by a deployed client as a rollout contract. Use the expand, switch, observe, contract sequence defined in the backend guide. A promoted web deployment does not prove older clients stopped calling a predecessor.

## Testing And Content

- Vitest is the standard test runner. Keep `*.test.ts` beside the real owning `.ts` module. Do not add orphan concept tests, `*.test.tsx`, renamed React tests, or nested test folders.
- Do not create a test merely because a `.ts` file exists, to mirror implementation details, or to satisfy coverage. Every test must prove meaningful behavior, a regression, or a failure contract at the owning public seam. Delete tests whose only value is restating configuration or exercising trivial branches. Maintain 100% statement, branch, function, and line coverage without lowering thresholds or excluding behavior. Keep declarative files with no executable behavior outside the coverage surface instead of manufacturing a test.
- Import test APIs from `@effect/vitest`. Use the shared configured `vi` global for mocks because Vitest hoists mock calls before re-export bindings initialize. Do not import `vi`. Keep `vitest` installed only because `@effect/vitest`, the CLI runner, coverage, and `vitest/config` require it. Raw `vitest` imports are forbidden in authored TypeScript.
- Do not add React component tests that mock children to verify static markup. Move testable behavior into an owning `.ts` domain seam and verify rendered behavior through production-mode Browser or E2E acceptance.
- Keep tests behavior-oriented, focused, and free of `.only` or `.skip`. Run the nearest test first, then the relevant workspace suite when risk warrants it. Preserve every workspace's configured per-file 100% coverage gate.
- Use `pnpm run doctor --verbose --scope changed --base main --include-untracked` for changed React code and `pnpm run doctor --verbose --scope full` for a whole-codebase audit. Do not use the deprecated `--diff` alias or plain `npx react-doctor@latest`.
- Authored content follows the audited Aksara locale equivalent without fallback. Preserve reviewed facts, pedagogy, exercises, renderer contracts, and the language being assessed.
- Learner-facing response labels arrive as rich Markdown strings from Aksara. Render plain text and prose mixed with math through the canonical design-system Markdown surface. In these strings, use no-space `$$...$$` for inline math and a fenced `math` block for display math. Do not add text-versus-math unions, response-content ASTs, or a second label renderer.
- Lesson headings begin at `h2` and descend to `h3`. Exercise answers render below an app-owned `h3`, so authored answer sections begin at `h4` and may use `h5` for real nesting.
- Use `InlineMath` and `BlockMath` for math, `MathContainer` for consecutive blocks when needed, and explicit `NumberLine` or `LineEquation` imports. Keep blank lines between prose and math blocks.
- Authored MDX lives only in Aksara. Nakafa renderer work must preserve Aksara publication contracts.

## Commands And Verification

- Root commands: `pnpm dev`, `pnpm dev:web`, `pnpm dev:all`, `pnpm start`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm security:audit`, `pnpm analyze`, and `pnpm boundaries`.
- Prefer `pnpm start` after a build. Use `pnpm dev` only for hot reload, development-mode diagnostics, devtools, or Convex live development.
- There is no root typecheck. Run `pnpm --filter <workspace> typecheck` for every changed workspace.
- Run one test with `pnpm --filter <workspace> exec vitest run <relative-test-path>` and a workspace suite with `pnpm --filter <workspace> test`.
- Run the smallest useful verification first, then expand based on risk. Format changed files, run `pnpm lint`, run affected tests and typechecks, and run `pnpm build` for build-critical changes.
- Run `pnpm security:audit` after dependency or lockfile changes. Report any verification that could not run.

## Vercel Cost And Deployment Policy

- Vercel Preview deployments are prohibited for all Nakafa projects. Never call a Vercel deploy connector or CLI for a feature branch or pull request, and never require a Preview URL as a gate.
- Verify feature work with local production builds and starts, exact-head GitHub CI, Browser or Playwright, and isolated Convex Agent Mode deployments where needed.
- Production deploys only after a protected merge to `main` through the existing Git integration. Keep Vercel branch configuration restricted to `main`.
- Do not enable external Turborepo Remote Cache for the signed `www` production build until every server-side environment input and signed-content generation input is included in the task hash.
- Cancel any accidental Preview immediately and remove every task-owned Preview artifact during cleanup.

## Git And Release Readiness

- Never overwrite or revert user changes. Never use destructive Git commands without explicit authorization.
- Do not commit unless the user asks. Before creating a pull request, format, run the relevant local checks, inspect the complete diff, and use a ready pull request only when it is reviewable.
- Production readiness requires the exact pull-request head, all required checks, reviews, mergeability, protected-branch policy, and cleanup evidence. Green results from another commit are not proof.
- Never blindly trust automated review findings. Trace each claim through the current code and authoritative sources before changing anything.
