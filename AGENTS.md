# Nakafa Codebase Agent Guide

Build for longevity.
Favor readable, skimmable, well-verified code over speed or cleverness.

## Source Of Truth

- Use retrieval-led reasoning first. Read the repo, configs, docs, and generated files before changing code.
- No Cursor rules were found in `.cursor/rules/` or `.cursorrules` when this guide was updated.
- No Copilot instructions were found in `.github/copilot-instructions.md` when this guide was updated.
- This root `AGENTS.md` is the baseline for the repo.
- Also read any nested `AGENTS.md` files in the area you touch.
- For Convex work, `packages/backend/AGENTS.md` is mandatory.
- For Convex work, read `packages/backend/convex/_generated/ai/guidelines.md` before making changes.
- Convex AI files keep their generated guideline current, while `packages/backend/convex.json` disables package-local skill copies. Root `.agents/skills` is the one canonical repo skill surface.
- For structural work, skim recent `git log` first so you do not reintroduce old patterns.
- Verify behavior from actual code and docs, not memory.

## Stack And Layout

- Package manager: `pnpm@10.34.1`
- Runtime: Node `24.x` through pnpm `devEngines.runtime`
- Monorepo: Turborepo
- Frontend: Next.js 16, React 19, TypeScript 7 CLI with TypeScript 6 API compatibility
- Backend: Convex
- Lint/format: Biome via Ultracite
- Tests: Vitest
- Apps: `apps/www`, `apps/api`, `apps/mcp`, `apps/email`
- Main packages: `packages/backend`, `packages/design-system`, `packages/contents`, `packages/ai`, `packages/testing`
- App-local alias: `@/*`
- Cross-package alias: `@repo/*`
- Educational MDX content lives in `packages/contents/`

## Package Ownership

- `packages/utilities` is for generic cross-domain primitives only. Do not put Nakafa content-domain constants, taxonomy, schemas, MDX/content metadata, or content-specific helpers there.
- Content taxonomy constants and domain types live in `packages/contents/_types/taxonomy.ts`; callers import taxonomy constants and types directly from that module.
- Content schema modules may derive Effect schemas from taxonomy values, but they must not re-export taxonomy constants or domain types.
- `packages/contents` is the source of truth for content-domain types, taxonomy, metadata schemas, and authoring contracts. Backend/Convex may import only narrow pure modules from `packages/contents/_types` when runtime validators must share the same taxonomy.

## Effect-Native Standard

- This is an Effect-native TypeScript codebase. Effect is the decomposition and composition architecture, not a wrapper around raw TypeScript.
- Effect-native architecture gives Nakafa decomposable, composable, traceable, and type-safe behavior end to end. It prevents fragmented helper chains, duplicated maps, hidden failure paths, and source-of-truth drift.
- Every new or touched TypeScript domain capability must start from Effect-native design: Schema contracts, branded values, tagged errors, small named `Effect.fn` programs, and `Effect.Service`/`Context.Tag` plus `Layer` only where there is a real dependency seam.
- Public module Interfaces must expose schema-derived data contracts and Effect-native operations for fallible, effectful, cross-source, or cross-module work. Do not build a raw TypeScript module and sprinkle Schema decoding, `Effect.succeed`, or a boundary runner around it later.
- Source registries must decode through schemas and produce typed/branded rows. Projection modules must compose those rows through typed Effects, not raw loops with hidden failure or fallback paths.
- Missing source data, duplicate routes, invalid slugs, invalid source rows, mismatched mappings, and route collisions are expected domain failures in the Effect error channel. Model them with `Schema.TaggedError` or `Data.TaggedError`, not `null`, generic `Error`, thrown parser errors, silent filtering, or fallback strings.
- `Effect.runPromise`, `Effect.runSync`, and `Effect.runPromiseExit` are allowed only at framework, CLI, script main, test, or React/Next event boundaries. Never run an Effect inside services, domain modules, projection modules, or helper chains; compose the program instead.
- Effectful work includes filesystem IO, HTTP/network calls, database/client calls, dynamic imports, async orchestration, shared caches, environment/config reads, logging, schema decoding failures, and expected domain failures.
- App code is not exempt. In `apps/*`, Server Actions, Route Handlers, Server Components that load data, client event handlers that call mutations, scripts, dynamic imports, and analytics/logging boundaries must compose Effect programs and call a runner only at the React, Next.js, CLI, or browser event boundary.
- Do not start a non-fast-path Effect runtime inside a statically prerendered Server Component before Next.js has request data or uncached data. Installed Effect creates fibers through `unsafeRunPromiseExit()` -> `unsafeFork()` -> `FiberId.unsafeMake()`, and `fiberId` reads current time for `startTimeMillis`; Next.js Cache Components reject that during static prerender. For SSG-only MDX/content dynamic imports, use the framework Promise boundary directly and document the exception with `https://nextjs.org/docs/messages/next-prerender-current-time`.
- Private pure helpers are allowed only for tiny deterministic transformations after inputs have been decoded or validated by Schema and when they cannot fail, perform IO, access dependencies, mutate shared state, or create source-of-truth contracts.
- Pure helpers must not be exported as the primary domain API when the operation can fail, validates source data, builds public routes, syncs read models, reads config, depends on multiple registries, or crosses module boundaries.
- If existing architecture is not Effect-native at an effectful seam, fix the seam directly instead of adding wrappers, compatibility patches, or shallow pass-through adapters.
- Name shared modules by domain capability, not by the Effect implementation style. Prefer seams such as `lib/analytics`, `lib/content`, `lib/checkout`, or `lib/school`; do not create catch-all folders like `lib/effect` just because the implementation uses Effect.
- After touching app effectful code, run `rg -n "\btry\s*\{|\bcatch\s*\(" <touched app paths> --glob '*.{ts,tsx}'` and either make it clean or document every remaining framework-mandated exception with the exact file and reason.
- After touching domain source or projection modules, scan for `as ` assertions, `satisfies Record`, `Record<string`, `any`, generic `Error`, raw `throw`, raw `try/catch`, `Effect.runPromise`, `Effect.runSync`, and silent source-of-truth fallbacks such as `?? toPublicSlug` or `|| fallback`.
- Tests for Effect-domain seams must assert typed failure behavior, not just happy-path output.

## Required Reading

- Convex best practices: `https://docs.convex.dev/understanding/best-practices/`
- Convex Workflow: `https://www.convex.dev/components/workflow`
- Convex cron jobs: `https://docs.convex.dev/scheduling/cron-jobs`
- Functional relationships helpers: `https://stack.convex.dev/functional-relationships-helpers`
- Convex Helpers README: `https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md`
- Convex Aggregate: `https://www.convex.dev/components/aggregate`
- Convex pagination: `https://docs.convex.dev/database/pagination`
- Confect spec/impl model: `https://confect.dev/concepts/spec-impl-model`
- Confect file naming conventions: `https://confect.dev/concepts/file-naming-conventions`
- Effect docs: `https://effect.website/docs`
- Effect LLM reference: `https://effect.website/llms.txt`
- Effect Cache: `https://effect.website/docs/caching/cache/`
- Effect Platform filesystem: `https://effect.website/docs/platform/file-system/`
- React effects guidance: `https://react.dev/learn/you-might-not-need-an-effect`
- Mantine Hooks docs: read before building new hook utilities.
- Read installed Convex node modules when behavior matters.
- Read Convex MCP code/docs when the change touches MCP or agent tooling.
- Use Context7 for up-to-date library docs and Ultracite search for lint/style rules.

## Core Commands
- `pnpm dev` - run the main web app and Convex backend through Turbo
- `pnpm dev:web` - run the main web app and Convex backend through Turbo
- `pnpm dev:all` - run all workspace `dev` tasks through Turbo
- `pnpm start` - run built workspace start tasks through Turbo
- `pnpm build` - build all packages and apps
- `pnpm test` - run all workspace tests
- `pnpm test:watch` - run watch-mode tests where supported
- `pnpm test:ui` - open Vitest UI where supported
- `pnpm test:coverage` - run coverage across workspaces that support it
- `pnpm lint` - run `ultracite check`
- `pnpm format` - run `ultracite fix`
- `pnpm format:doctor` - run `ultracite doctor`
- `pnpm analyze` - run analyze tasks
- `pnpm boundaries` - run workspace boundaries checks

## Focused Commands

- `pnpm --filter www dev` - Next.js app on `3000`
- `pnpm --filter api dev` - Next.js API app on `3002`
- `pnpm --filter mcp dev` - MCP app on `3001`
- `pnpm --filter email dev` - React Email preview on `3004`
- `pnpm --filter @repo/backend dev` - Convex dev with tailed logs
- Prefer `pnpm start` for running the app after a build; `pnpm dev` is heavy and should be used when debugging development-mode behavior, devtools, hot reload, or Convex live development.
- `pnpm dev` / `pnpm dev:web` - development-mode combo for `www` + Convex backend
- `pnpm dev:all` - use when you truly need every app running together
- There is no single root `typecheck` script; run it in the workspace you changed.
- `pnpm --filter www typecheck`
- `pnpm --filter api typecheck`
- `pnpm --filter @repo/backend typecheck`
- `pnpm --filter @repo/contents typecheck`
- `pnpm --filter @repo/design-system typecheck`
- Preferred single-test pattern: `pnpm --filter <workspace> exec vitest run <relative-test-path>`
- `pnpm --filter www exec vitest run __tests__/pages.test.tsx`
- `pnpm --filter api exec vitest run lib/__tests__/proxy.test.ts`
- `pnpm --filter @repo/backend exec vitest run helpers/chunk.test.ts`
- `pnpm --filter @repo/contents exec vitest run _lib/content.test.ts`
- Some workspaces enforce per-file 100% coverage, so use the full workspace test for the coverage gate.
- Add `-t "test name"` to run one named test.
- Use `pnpm --filter <workspace> test` for the whole workspace suite.
- Convex helpers: `pnpm --filter @repo/backend setup`, `seed`, `deploy`, `insights`

## Workflow Expectations

- Read the touched package's `package.json`, config files, and nearby code before editing.
- Follow existing local patterns before inventing new abstractions.
- Keep changes cohesive across frontend, Convex backend, and dev/prod behavior.
- Avoid disconnected patches, workaround code, wrapper chains, and legacy leftovers.
- Do not leave technical debt behind in touched code: remove dead code, redundant code, obsolete data repair paths, and one-off cleanup functions once the underlying data has been verified clean in every relevant environment.
- Prefer small, direct helpers over abstraction layers.
- Use early returns to keep logic flat and skimmable.
- Run the smallest useful verification set after changes, then expand if risk is high.
- Prefer `pnpm start` over `pnpm dev` when you only need to run the built app. Use `pnpm dev` when the task needs devtools, hot reload, development-mode diagnostics, or Convex live debugging.

## Module Size And Decomposition

- Hand-written `.ts` and `.tsx` Modules should target 300 LOC or less.
- A new or touched hand-written `.ts` or `.tsx` file over 500 LOC is a production-readiness blocker unless it is generated, vendor data, source corpus, or an intentionally dense content/curriculum registry where splitting would reduce locality. Record that exception in PR or final proof.
- When a touched Module exceeds 500 LOC, stop and apply the architecture vocabulary deliberately: identify the Module, Interface, Implementation, Seam, Depth, Leverage, and Locality before editing.
- Decompose by real domain capability into folder-owned files with short concrete names. Do not hide size by creating shallow wrappers, pass-through files, generic `utils` or `helpers`, or wrapper chains.
- Apply the deletion test: if deleting a new file only moves the same filtering, mapping, sorting, or reconstruction into another caller, the split is not deep enough.
- Do not create new `index.ts` barrels or re-export layers.
- Do not create or keep hand-written facade Modules in touched code. Do not use `export { ... } from "./x"`, `export type { ... } from "./x"`, or imports whose only purpose is to export symbols again. Export declarations implemented in the same Module; update callers to direct imports from the owning Module instead. The only exceptions are generated files or externally mandated package entrypoints, and the exception must be explicit in proof.
- Effect-native decomposition follows the same rule: split along schema contracts, typed errors, Effect programs, services, layers, and framework adapters, not raw TypeScript or Promise wrappers.
- Final readiness for broad changes must include LOC proof for touched `.ts` and `.tsx` files and explicit justification for any touched hand-written file over 500 LOC.

## Formatting And Imports

- Formatting is owned by Biome through Ultracite. Run `pnpm format` instead of hand-formatting.
- Use spaces for indentation.
- Use double quotes for strings and JSX attributes.
- Do not store Tailwind class strings in arbitrary data objects, maps, or variables outside a styling utility/component boundary. For reusable or variant-driven styles, use `cva` or existing variant helpers so Tailwind IntelliSense and class extraction stay reliable.
- Prefer `import type` for type-only imports.
- Within apps, prefer `@/` imports over long relative paths.
- Across workspaces, use `@repo/*` imports.
- Prefer direct file imports over adding new barrel layers unless the existing API already exposes one.
- Group imports clearly: external, workspace, then app-local.
- Respect existing file naming in the touched area; naming-convention lint rules are intentionally relaxed.

## TypeScript Rules

- TypeScript is strict across the repo.
- The root toolchain intentionally installs TypeScript 7 as `@typescript/native` and exposes it as `tsc`, while the `typescript` package name resolves to `@typescript/typescript6` for Next.js, Ultracite, and language-service consumers that still require the JavaScript compiler API. Keep this side-by-side arrangement until those consumers support the TypeScript 7 API.
- `packages/backend` owns package-local TypeScript 6 because the Convex CLI resolves `node_modules/typescript/bin/tsc` directly and Effect diagnostics still require the JavaScript compiler API. Its workspace `typecheck` script explicitly runs the root native TypeScript 7 compiler, while Convex deployment performs an additional TypeScript 6 compatibility check. Keep this boundary until Convex supports the stable native compiler path and programmatic consumers support TypeScript 7.
- Run `pnpm exec tsc --version` to verify the native TypeScript 7 compiler and `pnpm exec tsc6 --version` only for compatibility diagnostics.
- Prefer derived and inferred types over manual annotations.
- Do not add redundant type annotations just to restate what TypeScript already knows.
- If inference breaks, fix the source design instead of forcing the type system.
- Avoid `any`; use `unknown` only when something is truly unknown and narrow it quickly.
- Avoid type assertions and workaround casts whenever possible.
- Keep public function inputs and outputs obvious.
- Use meaningful names instead of magic values or anonymous tuple-like objects.

## Type Source Of Truth

- Domain value sets have one source module. Schemas, validators, constants, and UI option lists derive from that source instead of duplicating unions.
- Public domain types derive from their runtime contract: use `Schema.Schema.Type<typeof Schema>` for Effect schemas, Convex `Infer<typeof validator>` for validators, and generated `Doc<>`, `Id<>`, `FunctionArgs<>`, or `FunctionReturnType<>` where Convex owns the shape.
- Do not duplicate unions such as locale, taxonomy, route-kind, content-kind, or graph identity strings when a schema, validator, generated type, or constant already owns them.
- Do not add manual type annotations where inference is clear. If inference is unclear, improve the Module Interface or schema source instead of adding workaround casts.
- Test fixtures may use literal values as concrete samples, but helper signatures must derive from the same source types as production code.

## Effect Rules

- Use Effect for effectful TypeScript business logic across the repo, especially in `packages/ai`, `packages/contents`, MCP/agent tooling, IO/cache/schema boundaries, and scripts.
- Effect-native means effectful work is modeled with Effect; pure deterministic helpers should stay pure.
- Model expected failures with `Schema.TaggedError` and specific domain error names.
- Prefer `Effect.fn("scope.name")` for effectful exported functions and service methods so traces are named.
- Use `Effect.Service` with declared dependencies for business services; reserve `Context.Tag` for runtime-injected infrastructure boundaries.
- Use `@effect/platform` and `@effect/platform-node` for Node filesystem and HTTP boundaries when those packages own the IO seam.
- Prefer `Effect.Cache` or Effect cached effects for shared effectful cache state. Plain `Map` is acceptable inside one pure algorithm for grouping, deduplication, or indexing.
- Use `Effect.try`, `Effect.tryPromise`, `Effect.acquireRelease`, and `Effect.sync` instead of raw `try/catch`, raw async wrappers, or hidden side effects.
- Handle known errors with `catchTag` or `catchTags`; avoid `catchAll` unless preserving the full cause at an outer boundary.
- Use `Option.match`, `Option.getOrElse`, or explicit early returns instead of `Option.getOrThrow`.
- Use `Option` in domain logic for absence. Use `Schema.optional` for absent object fields and `Schema.NullOr` only when `null` is a real external or corpus value.
- Use `Config.*` for application configuration. Direct `process.env` access is allowed only in dedicated env-schema boundary modules.
- Use `Effect.log` or the repo logger for production logs; do not use `console.log`.
- Keep Effect code readable: flat generator flow, early returns for pure branches, no clever pipelines when a named step is clearer.

## Readability And Errors

- Optimize for code that is easy to skim.
- Prefer obvious control flow over clever one-liners.
- Keep functions focused and narrow in responsibility.
- Extract repeated logic only when it improves readability or reuse.
- Do not introduce wrapper functions around other functions without a clear benefit.
- Do not leave redundant branches, temporary code, or commented-out code behind.
- Throw real `Error` objects or framework-appropriate errors such as `ConvexError`.
- Use descriptive error messages and handle edge cases deliberately.
- Do not catch errors just to rethrow the same thing.
- Remove `console.log`, `debugger`, and `alert` from production code.

## React And Next.js

<!-- BEGIN:nextjs-agent-rules -->
 
### Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant installed Next.js doc. With pnpm, resolve it with `find . -path '*/node_modules/next/dist/docs' -type d -print`; do not assume it exists at direct `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

- Follow existing Next.js and React 19 conventions already present in the repo.
- Use function components.
- Add `"use client"` only when the component truly needs client-side features.
- Keep hooks at the top level and satisfy dependency arrays.
- Prefer deriving values over adding extra effects.
- Check Mantine Hooks before writing a new custom hook from scratch.
- Use semantic HTML and accessible component APIs.
- Prefer Next.js primitives like `<Image>` when appropriate.
- Keep server/client boundaries explicit and minimal.
- New or touched app route UI must reuse existing Nakafa and design-system surfaces before adding markup. Route migrations may change data and URL shape, but the visual composition should follow the established page surface for that domain, such as subject/material lists and material body layouts. Do not introduce one-off card/list styling, bespoke hover treatments, or custom shells when an existing component already owns the pattern; use `className` only as layout glue around those components.
- When a static route hits Next.js current-time prerender errors, do not blindly add `connection()`. Installed Next.js docs state `connection()` opts the subtree into runtime rendering; use it only when the route is intentionally dynamic, not to hide an Effect runtime timestamp in content that should stay SSG.

## Convex Rules

- Follow official Convex docs and the generated AI guidelines exactly.
- Prefer Convex-first app-data mutations and queries. Do not add Next Server Actions or Route Handlers that only wrap Convex functions; use them only for real Next/framework boundaries such as cookies, headers, cache invalidation, or non-Convex integrations, and document that reason at the seam.
- Use shared helpers and validators in `packages/backend/convex/lib/`.
- Use auth helpers from `packages/backend/convex/lib/helpers/auth.ts`; do not reach for raw `ctx.auth` patterns first.
- Add validators for every Convex function.
- Use `query`, `mutation`, `action`, and internal variants appropriately; do not expose sensitive logic publicly.
- Keep Convex route files focused on registered Convex functions. Move domain implementation details into capability folders such as `checkout/impl.ts`, `redeem/spec.ts`, or `integrity/internal.ts`; do not create prefix-suffixed files like `public.impl.ts` or `mutations.impl.ts`.
- Use the Confect spec/impl split as structural inspiration, adapted to Convex routing with folder-owned `spec.ts`, `impl.ts`, and `internal.ts` files instead of prefix-suffixed filenames.
- Prefer one clear capability token per Convex folder or filename. CamelCase domain terms such as `assistantResponses` or `contentAudios` are acceptable when they name one established concept; ambiguous generic names or compound prefix/suffix filenames are not.
- Prefer direct imports from the owning module. Do not add new barrel re-exports or compatibility routes when callers can import the concrete capability directly.
- Name Convex files by the capability they expose, not by generic lifecycle labels. Use names such as `reset`, `integrity`, `checkout`, `redeem`, or `assistantResponses`; avoid vague one-off names such as `maintenance` unless the module is a permanent, domain-specific maintenance surface.
- When a Convex migration, backfill, or repair function is no longer needed, verify dev and prod data first, then remove both the function and its tests so no legacy repair path remains.
- Prefer installed helpers/components when they fit: Better Auth, Workflow, Aggregate, Workpool, `convex-helpers`.
- Keep pagination, relationships, aggregates, workflows, and cron jobs aligned with official patterns.
- Make Convex schema and index names explicit and readable.

## Testing Rules

- Vitest is the standard test runner.
- Existing tests live in `__tests__/`, `__test__/`, and `*.test.ts(x)` files.
- `packages/contents` uses colocated `{filename}.test.ts` files and architecture tests reject nested test folders.
- Do not add final-code React component `.test.tsx` shell tests that mock child components just to render static markup. For app UI behavior, prefer route, data, or domain seams, or production-mode Browser/e2e checks. Existing historical `.test.tsx` files are not a mandate to delete unrelated tests outside the current PR scope.
- Use `describe`, `it`/`test`, and focused assertions.
- Keep tests readable and behavior-oriented.
- Do not leave `.only` or `.skip` in committed code.
- When changing business logic, add or update the nearest relevant test.
- After risky changes, run the affected workspace suite, not just one file.
- For React Doctor, use `pnpm run doctor --verbose --diff`. Do not invoke `pnpm run doctor -- --verbose --diff` or plain `npx react-doctor@latest`, since those paths use the wrong argument/runtime behavior in this repo.

## MDX And Content Rules

- Content is primarily Indonesian unless context requires English.
- Subject lesson headings start at `h2`; keep lesson depth at `h3`.
- Exercise answer MDX is rendered under the app-provided `h3` answer heading, so answer sections start at `h4` and may use `h5` for real nested analysis.
- Use inline code for programming syntax.
- Use `InlineMath` and `BlockMath` for math, not plain text math.
- Use `MathContainer` around consecutive math blocks when needed.
- `NumberLine` and `LineEquation` require explicit imports from the design system.
- Keep list formatting simple with hyphen bullets.
- Leave blank lines between prose paragraphs and math blocks.

## Git And Final Verification

- Never overwrite or revert user changes you did not make.
- Never use destructive git commands unless explicitly asked.
- Never commit unless the user explicitly asks for a commit.
- Before structural changes, read recent history so your approach matches the repo's direction.
- Format changed files.
- Run `pnpm lint` when the change is ready.
- Run targeted tests and the relevant workspace `typecheck`.
- If the change touches build-critical paths, run `pnpm build` or the affected workspace build.
- Mention any verification you could not run.
