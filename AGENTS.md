# Nakafa Codebase Agent Guide

Build for longevity. Favor readable, skimmable, well-verified code over speed or cleverness.

## Evidence And Scope

- Read repository code, package manifests, configuration, generated files, installed source, and current official documentation before changing behavior.
- This file is the repository baseline. Read `packages/backend/AGENTS.md` before any Convex work and `packages/backend/convex/_generated/ai/guidelines.md` before editing Convex code.
- Use the enabled official Convex and Vercel plugin skills for generic ecosystem guidance. Use globally installed upstream skills when their scope matches. Do not add repository-local skill copies or generate new app-local `AGENTS.md` or `CLAUDE.md` files. The existing Convex-managed backend files are the only package-local exception.
- Skim recent `git log` before structural work so old patterns are not reintroduced.
- Read the touched package's `package.json`, configuration, and nearby implementation before editing. Follow current local patterns unless evidence supports changing them.

## Stack And Ownership

- Package manager: `pnpm@12.9.1`
- Runtime: Node `24.x` through pnpm `devEngines.runtime`
- Monorepo: Turborepo
- Frontend: Next.js 16, React 19, native TypeScript 7
- Backend: Confect v10 and Effect v4 on Convex
- Lint and format: Biome through Ultracite
- Tests: Vitest
- Apps: `apps/www`, `apps/api`, `apps/mcp`, `apps/email`
- Main packages: `packages/backend`, `packages/design-system`, `packages/contents`, `packages/testing`
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
- The root `typescript` package exposes the Effect-patched native TypeScript 7 compiler as `tsc`. The test policy uses its pinned native API and scopes the compiler process to each policy run. `packages/backend` owns its package-local native compiler because Convex resolves it directly. Verify with `pnpm exec tsc --version` from the root and backend. React Doctor manages its own TypeScript dependency in its separate `pnpm dlx` environment.
- Formatting is owned by Ultracite. Use spaces, double quotes, `import type`, and clear external, workspace, then app-local import groups. Run `pnpm format` instead of hand-formatting.
- New or touched app TypeScript modules use direct `@/` imports for same-app modules, including colocated modules and tests. Across workspaces use `@repo/*`. Prefer direct owning-file imports over new barrels.
- New hand-written filenames use one domain word plus conventional suffixes such as `.client` or `.test`. Do not introduce hyphenated compound basenames.
- Keep Tailwind class strings inside styling utilities or component boundaries. Use `cva` or existing variant helpers for reusable or variant-driven styling.
- Use Tailwind's built-in classes. Never write an arbitrary value that a built-in class renders identically, such as a bracketed `4px` where `size-1` exists or a bracketed `50%` where `top-1/2` exists. `scripts/check/tailwind.ts` rejects them through `pnpm check:tests`; theme-dependent scales such as radius, font size and tracking are left to review.

## Effect V4 Standard

- Nakafa is Effect-native: Effect v4 and Confect v10 express every capability. Plain TypeScript constructs remain only where Effect cannot express them, namely React component props in `.tsx`, framework configuration, generated code, and ambient declarations (declaration files and `declare module` or `declare global` augmentations), and the pull request justifies each one.
- Before writing code, find the Effect or Confect module that already does the job in `repos/effect`, the installed `node_modules`, `https://effect.website/docs/v4/api/effect`, and `https://confect.dev/v10`. Unstable Effect v4 modules are welcome, and a dependency that Effect already covers goes.
- Data: every domain shape is an Effect Schema (`Struct`, `Class`, `TaggedClass`, `TaggedStruct`, `Union` or tagged unions, `Literals`, brands, refinements, transformations), and its type is `typeof X.Type`. Interfaces, object type aliases, and readonly field literals never describe data.
- Logic: name exported effectful functions and service methods with `Effect.fn("domain.operation")`. Transform with the Effect data modules (`Array`, `Record`, `Struct`, `Option`, `Result`, `Predicate`, `Match`, `Order`, `Equivalence`, `HashMap`, `HashSet`, `MutableHashMap`, `MutableHashSet`, `Chunk`, `String`, `Number`, and `pipe` or `flow`) in place of native array and object helpers, `Map`, `Set`, `Array.isArray`, and switch or if chains over tags.
- Services and effects: `Context.Service` with `Layer` for real dependency seams, `Config` for environment values, `Clock` and `DateTime` for time, `Random`, `Duration`, `Schedule`, `Stream`, and `Effect.log`. Domain code composes Effects and wraps a Promise SDK once with `Effect.tryPromise`.
- Platform: `HttpClient` from `effect/http` for HTTP; `FileSystem` and `Path` from `effect` and `ChildProcess` from `effect/process`, provided by `NodeServices.layer` from `@effect/platform-node`, for Node work; `Base64`, `Base64Url`, and `Hex` from `effect/encoding` for encodings; `Schema.fromJsonString` for JSON.
- Model expected failures with specific `Schema.TaggedError` or `Data.TaggedError` types and handle them with `catchTag` or `catchTags`. `null`, generic `Error`, raw throws, parser exceptions, and silent fallbacks never stand in for an expected failure, and `catchAll` belongs only to an outer boundary that preserves the complete cause.
- Public module interfaces expose schema-derived contracts and Effect-native operations for fallible, effectful, cross-source, or cross-module work. Source registries decode typed rows; projections compose them without silent filtering, fallback strings, or duplicated maps.
- `Effect.runPromise`, `Effect.runSync`, and `Effect.runPromiseExit` belong only at framework, CLI, script-main, test, SDK callback, or browser event boundaries. Services, domain modules, projections, and helper chains compose Effects without running them.
- Private pure helpers are allowed only for small deterministic transformations after validation, written with the Effect data modules, when they cannot fail, perform IO, access dependencies, mutate shared state, or define a public source of truth.
- Name shared modules by domain capability, such as `lib/analytics`, `lib/content`, or `lib/checkout`. Do not create `lib/effect` catch-alls.
- Do not start a non-fast-path Effect runtime inside a statically prerendered Server Component before Next.js has request or uncached data. Use the framework Promise boundary for request-less static work and document the exception with `https://nextjs.org/docs/messages/next-prerender-current-time`.
- `pnpm check:tests`, part of `pnpm lint`, `pnpm test`, and `pnpm build`, runs `scripts/check/effect.ts` over every authored module and fails on any violation. There is no baseline, allowlist, exceptions file, or inline suppression, and none may be added: fix every violation at its source. A rule leaves a construct alone only where Effect cannot express it, and `scripts/check` recognizes that case by construction, such as a `.tsx` component's props, a framework configuration module, generated output, or a declaration file, with a test that proves it.
- The check reads syntax, so review what it cannot see: after touching domain source or projections, scan for assertions, broad records, `any`, generic errors, raw throws, runners, and silent source fallbacks, and explain every retained framework exception.
- Tests for Effect-domain seams assert typed failure behavior as well as success.

### Vendored Effect Reference

- `repos/effect` is a read-only Git subtree pinned to the installed `effect` version. Before writing or reviewing Effect code, read `repos/effect/LLMS.md` and `repos/effect/.agents/AGENTS.md`, then inspect relevant implementation, tests, type-level tests, modules, and API design.
- Prefer matching vendored source over memory, declarations, or examples from another major version. Never edit, import from, build, lint, or test `repos/effect` as Nakafa application code.
- `pnpm effect:source:check` verifies version parity. After committing an Effect dependency update, run `pnpm effect:source:update` to create the matching linear reference update commit.
- Follow the official source-vendoring guidance at `https://www.effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive`.

## React And Next.js

- Confect React owns application queries and mutations. Use the official Agent streaming hook and Better Auth integration at their component boundaries, without a custom transport or vanilla preload adapter.
- Use optimistic updates for predictable user mutations with rollback on failure. Use React transitions for asynchronous UI boundaries; do not maintain separate `useState` loading or pending flags. Keep stable content visible while optional data arrives.
- Share compound-component state through the owning context and compose children directly. Do not forward props through components that do not consume them.
- Shared state has two homes, chosen by what writes it. State that only its own actions or an external source (an observer, stream, timer or browser API) writes, independent of render, lives in a Zustand store created once per provider instance with `useState(() => createStore(...))`, carried by a plain React context and read with `useStore(store, selector)`, so a reader that did not select the changed value never runs. Everything a provider receives or computes during render (props, server data, Confect, Convex Agent and Better Auth hook results), and state that follows props or a React transition, uses a plain React context read with `use()`; split such a context by change frequency when some readers need only its slower part, and never copy it into a store through an effect. Expose either kind through a `useX(selector)` hook so readers never depend on which one backs it. A context with no meaningful default starts as `null` and its hook rejects a missing provider; use a separate marker only when `null` is a value the provider shares.
- A provider that wraps streamed content keeps its context value unchanged after hydration: React client-renders a Suspense boundary that is still streaming when an ancestor context changes, in any lane, and discards the HTML the server sent. State that resolves in the browser after hydration, such as the Better Auth session (read from its session atom, not its hook), Convex authentication, the viewport, and browser storage, lives in such a store, whose `useStore` server snapshot is the state the server rendered; a value derived from a Confect query is derived in the reading hook, where Convex serves every reader from one subscription; a callback in the value keeps one identity and reads the latest render through a ref mirrored in a layout effect. Read Convex authentication with `useConvexAuth` from `@/components/providers/convex` and its gates from `@/components/auth/gate`; Biome's `noRestrictedImports` rejects the context-backed auth APIs of `convex/react` and `@convex-dev/better-auth`. A lesson renderer that loads with `next/dynamic` goes through `withHydrationBoundary` from `@/lib/content/renderer/client/boundary`, whose visible `Activity` lets the lesson hydrate, and answer presses, before the renderer's code arrives. `apps/www/e2e/hydration.browser.ts` proves cold lessons and articles keep their streamed content, signed out and signed in.
- `scripts/check/react.ts` rejects `use-context-selector`, React's `useContext`, and Zustand's module-level `create`.
- Declare every component, including list items and render helpers, as a named module-level function component. Never define a component or a function that returns JSX inside another component; `scripts/check/react.ts` rejects both, alongside Biome's `noNestedComponentDefinitions`. Inline callbacks passed where they are used, such as list items or rich-text tags, stay inline.

- Before React composition work, use the globally installed upstream `vercel-composition-patterns` skill. Use the official Vercel React, Next.js, and shadcn plugin skills when their focused guidance applies.
- Before Next.js work, find the installed version-matched documentation with `find . -path '*/node_modules/next/dist/docs' -type d -print`. Installed docs and source are authoritative for APIs, file conventions, and deprecations.
- Follow existing React 19 patterns. Use function components, add `"use client"` only when needed, keep hooks at the top level, derive values instead of adding effects, and check Mantine Hooks before creating a custom hook.
- Keep server and client boundaries explicit and minimal. Use semantic HTML, accessible component APIs, and Next.js primitives such as `<Image>` where appropriate.
- New or touched route UI reuses established Nakafa and design-system surfaces. Route migrations may change data or URL shape but must not introduce bespoke shells, cards, hover treatments, or list styling when an existing component owns the pattern.
- Every interactive content visual, such as a 3D scene, lab, chart, or animation, composes the `VisualCard` parts in `packages/design-system/components/visual/card.tsx`: header, body, the scene that takes the free height in full screen, and a footer that holds the visual's controls beside `VisualCardFullscreen`. Never hand-build `Card`, `CardHeader`, and `CardFooter` around a visual. Mermaid diagrams (`DiagramFrame` with its larger-diagram dialog) and embedded video are not interactive visuals in Aksara's content rules, so they keep their own frames.
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
- Never create a `.ts` module or unit test only to satisfy test-name checks. Do not unit-test `.tsx` modules. A domain seam must have independent production value; otherwise verify the real rendered behavior through Browser, E2E, or an existing production-boundary integration test.
- Never remove or relax a coverage gate to accommodate a design change. Keep meaningful `.ts` seams at 100% per-file coverage and verify `.tsx` output through Browser, E2E, or production-boundary integration tests.
- Keep tests behavior-oriented, focused, and free of `.only` or `.skip`. Run the nearest test first, then the relevant workspace suite when risk warrants it. Preserve every workspace's configured per-file 100% coverage gate.
- Use `pnpm run doctor --verbose --scope changed --base main --include-untracked` for changed React code and `pnpm run doctor --verbose --scope full` for a whole-codebase audit. Do not use the deprecated `--diff` alias or plain `npx react-doctor@latest`.
- Authored content follows the audited Aksara locale equivalent without fallback. Preserve reviewed facts, pedagogy, exercises, renderer contracts, and the language being assessed.
- Learner-facing response labels arrive as rich Markdown strings from Aksara. Render plain text and prose mixed with math through the canonical design-system Markdown surface. In these strings, use no-space `$$...$$` for inline math and a fenced `math` block for display math. Do not add text-versus-math unions, response-content ASTs, or a second label renderer.
- Lesson and article bodies use only `h2` and `h3`, including lesson exercises and worked solutions. Standalone question-bank answers render below an app-owned `h3`, so only those authored answer sections begin at `h4` and may use `h5` for real nesting.
- Use `InlineMath` and `BlockMath` for math, `MathContainer` for consecutive blocks when needed, and the published `NumberLine` or `LineEquation` component names. Renderer code imports their owning implementation directly; authored MDX has no renderer imports. Keep blank lines between prose and math blocks.
- Before removing any renderer name, verify the active signed corpus and retained inverse in both development and production. Repository source and production alone cannot prove development has migrated. Keep the required implementation through paired publication and acceptance, then remove it only after every active artifact's requirements exclude it.
- Authored MDX lives only in Aksara. Nakafa renderer work must preserve Aksara publication contracts. Internal renderer declarations and artifact requirements use component names with one current implementation and component set. Do not add component or renderer contract version fields, dual registries, or compatibility adapters for additive props; deploy the matching renderer before publishing content that uses them. Preserve compiler provenance, hashes, signatures, and immutable snapshot identities.

## Commands And Verification

- Root commands: `pnpm dev`, `pnpm dev:web`, `pnpm dev:all`, `pnpm start`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm security:audit`, `pnpm analyze`, and `pnpm boundaries`.
- Prefer `pnpm start` after a build. Use `pnpm dev` only for hot reload, development-mode diagnostics, devtools, or Convex live development.
- There is no root typecheck. Run `pnpm --filter <workspace> typecheck` for every changed workspace. CI's Quality job runs `pnpm lint`, every workspace typecheck through `pnpm -r run typecheck`, and `pnpm test`.
- Judge a typecheck by its exit code. The Effect-patched compiler reports language-service suggestions such as `suggestion TS377016` (use `Effect.undefined` for `Effect.succeed(undefined)`) that fail the typecheck and the build without the word "error".
- The shared TypeScript configs turn off the language service's `unstableApiUsage` and `experimentalApiUsage` rules. Effect moves as one exact cohort that is reviewed at every upgrade, and its HTTP, process, and CLI modules are marked `@stability unstable`, so a warning on each use adds no signal.
- The `www` typecheck and build validate environment variables while Next.js loads its config. Run them through `pnpm acceptance:build`, which supplies inert values, or pass inert local values; never copy deployment values.
- Before changing Turborepo configuration or commands, read `docs/README.md` in the installed `turbo` package (resolve it with `node -p "require.resolve('turbo/package.json')"`) and the relevant pages under its `docs/` directory.
- Run one test with `pnpm --filter <workspace> exec vitest run <relative-test-path>` and a workspace suite with `pnpm --filter <workspace> test`.
- Run the smallest useful verification first, then expand based on risk. Format changed files, run `pnpm lint`, run affected tests and typechecks, and run `pnpm build` for build-critical changes.
- Run `pnpm security:audit` after dependency or lockfile changes. Report any verification that could not run.
- CI audits against live OSV advisories, so a new advisory can fail Quality with no code change. Bump the version-keyed override in `pnpm-workspace.yaml` in its own change, then merge `main` into waiting pull requests. When no patched release exists and only development tooling reaches the package, add a time-boxed `IgnoredVulns` entry to `osv.toml`, the scanner configuration `pnpm security:audit` passes with `--config`, in its own change instead: `ignoreUntil` at most 14 days out and a `reason` naming the dependency path and why it cannot be exploited. Delete the entry once a patched release ships; an expired entry fails the audit again.

## Vercel Cost And Deployment Policy

- Vercel Preview deployments are prohibited for all Nakafa projects. Never create a Vercel Preview for a feature branch or pull request through a connector or the CLI, and never require a Preview URL as a gate.
- Verify feature work with local production builds and starts, exact-head GitHub CI, Browser or Playwright, and isolated Convex Agent Mode deployments where needed.
- Vercel production deploys happen only after a protected merge to `main`, through the existing Git integration. Keep Vercel branch configuration restricted to `main`.
- Convex production functions may be deployed directly with `pnpm --dir packages/backend exec convex deploy --yes` when the operator holds a production deploy key.
- Do not enable external Turborepo Remote Cache for the signed `www` production build until every server-side environment input and signed-content generation input is included in the task hash.
- Cancel any accidental Preview immediately and remove every task-owned Preview artifact during cleanup.

## Git And Release Readiness

- Never overwrite or revert user changes. Never use destructive Git commands without explicit authorization.
- Do not commit unless the user asks. Before creating a pull request, format, run the relevant local checks, inspect the complete diff, and use a ready pull request only when it is reviewable.
- Production readiness requires the exact pull-request head, all required checks, reviews, mergeability, protected-branch policy, and cleanup evidence. Green results from another commit are not proof.
- Never blindly trust automated review findings. Trace each claim through the current code and authoritative sources before changing anything.
- Unresolved review threads, including automated reviewers', block merging. Fix each verified finding or reply with evidence, then resolve the thread.
- `main` merges only through GitHub's merge queue. `gh pr merge` queues through auto-merge, which stays off, so once Required and Doctor pass on a pull request's exact head, enqueue that head directly with `gh api graphql -F id="$(gh pr view <number> --json id --jq .id)" -F head=<sha> -f query='mutation($id: ID!, $head: GitObjectID!) { enqueuePullRequest(input: {pullRequestId: $id, expectedHeadOid: $head}) { mergeQueueEntry { position } } }'`. The queue reruns Required and Doctor on the change combined with the latest `main` and every change queued ahead of it, then squash merges it, so the branch needs no update from `main` to merge. A pull request is merged once its state is `MERGED`, not when it enters the queue.
- Version packages on demand: on a branch from the latest `main`, run `GITHUB_TOKEN="$(gh auth token)" pnpm version-packages` to turn the pending changesets into package versions and changelog entries (the GitHub changelog plugin needs the token to link each entry to its pull request), then land that pull request through the merge queue. Keep release pull requests human-opened: CI never runs for a pull request a workflow opens with `GITHUB_TOKEN`, so it can never pass Required.
