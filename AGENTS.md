# Nakafa Codebase Agent Guide

Build for longevity. Favor readable, skimmable, well-verified code over speed or cleverness.

This guide is a map. It states each Nakafa decision once and names the file, command, or document that owns the detail. What a command enforces is not restated here: run the command and follow its message.

## Sources Of Truth

| Topic | Owner |
| --- | --- |
| Versions, package manager, runtime, dependency holds | `package.json`, `pnpm-workspace.yaml`, `scripts/dependencies/policy.ts` |
| Writing Effect v4 | `repos/effect/LLMS.md`, then source and tests under `repos/effect/packages`; https://effect.website/docs/v4/api/effect |
| Confect v10 | https://confect.dev and the installed `@confect/*` source |
| Convex architecture, auth, the dev deployment, migrations | `packages/backend/AGENTS.md`; installed API rules in `packages/backend/convex/_generated/ai/guidelines.md` |
| Next.js APIs, file conventions, deprecations | the installed docs, `apps/www/node_modules/next/dist/docs` |
| Turborepo | `docs/README.md` inside the installed `turbo` package |
| Effect-native source rules, their scopes and fixes | `scripts/check/rules.ts` |
| Effect compiler rules | `packages/typescript-config/base.json` |
| React, state, Tailwind, test, and layout policy | `scripts/check/tests.ts` and the modules it runs |
| Architecture decisions: client state and hydration, the renderer contract, and the rest | `docs/adr` |
| Advisories without a patched release | `osv.toml` |
| Authored content and its rules | the Aksara repository and its `nakafa-content` skill |

- Read the owner, the touched package's manifest and configuration, and nearby code before changing behavior. Skim recent `git log` before structural work so old patterns are not reintroduced.
- Use the enabled official Convex and Vercel plugin skills, and globally installed upstream skills when their scope matches. Do not add repository-local skill copies or new app-local `AGENTS.md` or `CLAUDE.md` files; the Convex-managed backend files are the only exception.

## Ownership

- Stack: pnpm, Turborepo, Next.js, React, native TypeScript, Confect and Effect on Convex, Biome through Ultracite, Vitest.
- Apps: `apps/www`, `apps/api`, `apps/mcp`, `apps/email`. Main packages: `packages/backend`, `packages/design-system`, `packages/contents`, `packages/testing`.
- Same-app imports use `@/*`, colocated modules and tests included; cross-package imports use `@repo/*`. Import the owning file directly.
- `packages/testing` owns shared Vitest defaults by runtime, `@repo/testing/node` and `@repo/testing/react`, including the per-file 100% coverage gate. A workspace keeps only local aliases, setup, projects, and its own coverage include and exclude lists.
- `packages/utilities` owns generic cross-domain primitives only. Content contracts, roles, taxonomy, Convex values, AI vocabulary, UI copy, and product helpers stay in their domain-owning package.
- Aksara exclusively owns authored content and signed publication for every content scope. For authored content work, open the Aksara repository and use its repository-local `nakafa-content` skill. Never copy that skill into Nakafa or global storage, and never add a second authored source, filesystem copy, or local publication writer. `packages/contents` owns only live Nakafa product, formatting, route-context, learner, and agent contracts.

## Architecture And TypeScript

- Keep changes cohesive and complete. Remove dead, redundant, obsolete, repair-only, and legacy paths after proving they are unused in every relevant environment.
- Prefer direct control flow, early returns, and small domain-owned modules over wrapper chains, compatibility facades, catch-all utility folders, and abstractions that do not reduce complexity. Deleting a proposed module should concentrate meaningful complexity, not merely relocate it.
- Hand-written `.ts` and `.tsx` modules target 300 LOC or less, and the source check rejects one over 500. Before splitting a module, identify its Module, Interface, Implementation, Seam, Depth, Leverage, and Locality, and decompose by real capability.
- Name new folders and files with one concise domain word per path segment plus conventional suffixes such as `.client` or `.test`: no hyphenated phrases, no repeated parent wording.
- Do not create new `index.ts` barrels, facade modules, pass-through re-exports, or generic `utils` or `helpers`. A generated or externally mandated package entrypoint needs an explicit exception.
- TypeScript is strict. Prefer derived and inferred types, fix the source design when inference is unclear, and avoid `any`, assertions, and workaround casts.
- The root `typescript` package exposes the Effect-patched native TypeScript 7 compiler as `tsc`; `packages/backend` owns its own because Convex resolves it directly. Verify with `pnpm exec tsc --version` from both. React Doctor manages its own TypeScript. Editors use the same compiler as their language server (`.zed/settings.json`, `.vscode/settings.json`), so Effect diagnostics show while editing.
- Ultracite owns formatting: run `pnpm format`, never hand-format.
- Keep Tailwind class strings inside styling utilities or component boundaries, with `cva` or existing variant helpers for variants. The policy check rejects an arbitrary value that a built-in class renders identically; theme-dependent scales such as radius, font size, and tracking are left to review.

## Effect V4 Standard

- Nakafa is Effect-native: Effect v4 and Confect v10 express every capability. Plain TypeScript remains only where Effect cannot express it, namely React component props in `.tsx`, framework configuration, generated code, ambient declarations, native promise syntax in a Confect workflow handler, the named type of a recursive Schema, the selector argument of `Extract` or `Exclude`, shapes that hold a value no Schema describes as data (a function, a React or MDX value, an AI SDK message part, an Effect runtime handle such as a fiber or a queue, or a parser syntax-tree node), generic shapes that use their type parameters, and code that Playwright serializes into the browser page, where no import reaches. The pull request justifies each one.
- Before writing code, find the Effect or Confect module that already does the job in the sources above. Unstable Effect v4 modules are welcome, and a dependency that Effect already covers goes. `repos/effect` is a read-only Git subtree pinned to the installed version: never edit, import from, build, lint, or test it. `pnpm effect:source:check` verifies parity; `pnpm effect:source:update` creates the matching reference commit after an Effect update.

| Instead of | Use |
| --- | --- |
| Interfaces, object type aliases, duplicated unions or value sets | An Effect Schema as the runtime contract; its type is `typeof X.Type` |
| Native array and object helpers, `Map`, `Set`, `switch` or `if` chains over tags | The Effect data modules with `pipe` or `flow`: `Array`, `Record`, `Option`, `Result`, `Match`, `HashMap`, `HashSet`, and their kin |
| `process.env`, `Date`, `Math.random`, timers, `console` | `Config`, `Clock` and `DateTime`, `Random`, `Duration` and `Schedule`, `Effect.log` |
| `fetch` | `HttpClient` from `effect/http`, provided by `FetchClient` from `@repo/utilities/http/client` |
| `crypto.randomUUID` | `randomUuid` from `@repo/utilities/uuid`, which reads Effect's `Crypto` service |
| `node:` file, path, and process modules | `FileSystem`, `Path`, and `ChildProcess`, provided by `NodeServices.layer` |
| Hand-written encodings, `JSON.parse` | `effect/encoding`, `Schema.fromJsonString` |
| `null`, generic `Error`, raw throws, silent fallbacks | A specific `Schema.TaggedError` or `Data.TaggedError`, handled with `catchTag` or `catchTags` |
| A Promise SDK used inline, hidden dependencies | One `Effect.tryPromise` wrapper; `Context.Service` with `Layer` at a real seam |

- `FetchClient` is Effect's Fetch client without the trace headers `FetchHttpClient.layer` adds to every request. A module whose request depends on Fetch-only options such as `cache`, `redirect`, or `credentials` provides it itself with `FetchHttpClient.RequestInit`, because no other client honors them.
- Code that Next.js bundles reads its environment through `readEnvironment` from `@repo/utilities/env`, with the Schema of each key and one record of literal `process.env.NAME` reads. `Config` cannot own this seam: the bundler inlines a public value only at a literal read, and the default `ConfigProvider` drops an empty string. A package keeps the readers that the browser may call in `public.ts` and its server readers in `keys.ts`. In the browser `readEnvironment` rejects a key that is not public, and `apps/www/env.ts` imports `server-only`, so a Client Component cannot import the server values.
- Name exported effectful functions and service methods with `Effect.fn("domain.operation")`. Public module interfaces expose schema-derived contracts and Effect-native operations; projections compose typed source rows without silent filtering, fallback strings, or duplicated maps.
- `Effect.runPromise`, `Effect.runSync`, and `Effect.runPromiseExit` belong only at framework, CLI, script-main, test, SDK callback, or browser event boundaries. `catchAll` belongs only to an outer boundary that preserves the complete cause.
- A private pure helper is allowed only for a small deterministic transformation after validation that cannot fail, perform IO, access dependencies, mutate shared state, or define a public source of truth.
- Name shared modules by domain capability, such as `lib/analytics` or `lib/content`, never `lib/effect`.
- Do not start a non-fast-path Effect runtime inside a statically prerendered Server Component before Next.js has request or uncached data. Use the framework Promise boundary and document the exception with https://nextjs.org/docs/messages/next-prerender-current-time.
- Enforcement: `pnpm check:tests`, part of `pnpm lint`, `pnpm test`, and `pnpm build`, runs the source rules, and every workspace typecheck runs the compiler rules. Each violation names its fix. No baseline, allowlist, exceptions file, inline suppression, or `@effect-diagnostics` comment may be added. A rule becomes an error in the pull request that clears its last violation, and the check recognizes by construction the places Effect cannot express, each with a test. A `plugins` array replaces the one it extends, so `base.json` declares the only one and every other configuration inherits it. `docs/adr/0021-rules.md` records which check owns a rule and which compiler rules stay off.
- The source rules read syntax, and the array rules also read the compiler's types. Review what they cannot see: assertions, broad records, `any`, generic errors, raw throws, runners, and silent source fallbacks. Explain every retained framework exception.

## React And Next.js

- Confect React owns application queries and mutations. Use the official Agent streaming hook and Better Auth integration at their component boundaries, without a custom transport or vanilla preload adapter.
- Predictable user mutations update optimistically with rollback on failure. Asynchronous UI boundaries use React transitions, not `useState` loading or pending flags, and stable content stays visible while optional data arrives.
- Compound components share state through the owning context and compose children directly; no props forwarded through components that do not consume them.
- Shared state has two homes: state written by its own actions or an external source lives in a Zustand store created once per provider instance, and everything a provider receives or computes during render lives in a plain React context read with `use()`. A provider that wraps streamed content never changes its context value after hydration, because React would discard the streamed HTML. `docs/adr/0017-state.md` owns both rules and the modules to use.
- Declare every component, list items and render helpers included, as a named module-level function component; inline callbacks passed where they are used stay inline. The policy check and Biome reject nested components, `use-context-selector`, React's `useContext`, Zustand's module-level `create`, and the context-backed auth APIs of `convex/react` and `@convex-dev/better-auth`.
- Keep code a page does not need at first paint out of a route's first JavaScript, Effect's HTTP client included: load it on intent with `next/dynamic` or `import()`. A request module is imported inside the event through `Effect.tryPromise` and provides `FetchClient` itself. `apps/www/e2e/budget/javascript.browser.ts` budgets each route's first JavaScript, and only the Production job's runtime suite runs it.
- Follow existing React 19 patterns: function components, `"use client"` only when needed, derived values instead of effects, Mantine Hooks before a custom hook, semantic HTML, accessible component APIs, and Next.js primitives such as `<Image>`. Before composition work use the global `vercel-composition-patterns` skill and the official Vercel React, Next.js, and shadcn plugin skills where they apply.
- Route UI reuses established Nakafa and design-system surfaces; a route migration may change data or URL shape but not introduce bespoke shells, cards, hover treatments, or list styling. Every interactive content visual composes the `VisualCard` parts in `packages/design-system/components/visual/card.tsx`; Mermaid diagrams (`DiagramFrame`) and embedded video keep their own frames.
- With Cache Components, keep static content in prerendering and never hide a current-time error behind a dynamic boundary. Use `io()` from `next/cache` before synchronous request-time work that should stream or take part in partial prefetching, and `connection()` only when rendering must wait for a real request.
- Keep `experimental.instantInsights.validationLevel` at `"warning"`. Add no redundant `instant = true` exports; use `instant = false` only for a route deliberately allowed to block navigation.
- The shared App Shell is the default prefetch. Use `<Link prefetch={true}>` only when URL-dependent cached content justifies one server invocation per link; grids and long lists prefetch on user intent.
- Keep truthful stable UI outside `Suspense`; when no truthful fallback exists use `fallback={null}`, never invented skeletons or fake content.
- Keep the real root layout in `[locale]`, use `next/root-params` only on the server, and prefer next-intl server APIs such as `getLocale()` over threading locale through Server Components.

## Convex

- `packages/backend/AGENTS.md` owns Convex architecture, the dev deployment, and the rollout contract of public functions; the Deployment section below owns production. Prefer direct Convex queries and mutations for app data; add a Next.js Server Action or Route Handler only for a real framework boundary such as cookies, headers, cache invalidation, or a non-Convex integration, and document that reason at the seam.

## Testing

- Vitest runs every test. Keep `*.test.ts` beside the real owning `.ts` module: no orphan concept tests, `*.test.tsx`, renamed React tests, or nested test folders. Import test APIs from `@effect/vitest` and use the shared configured `vi` global; never import `vi` or `vitest` directly.
- A test proves meaningful behavior, a regression, or a failure contract at the owning public seam, typed failures included. Never create a module or a test because a file exists, for coverage, or for a test-name check, and delete tests that only restate configuration or trivial branches.
- Every workspace inherits its per-file 100% statement, branch, function, and line coverage gate from `packages/testing`. Never lower, remove, or exclude around it; declarative files without executable behavior stay outside the coverage surface.
- Do not unit-test `.tsx` or mock children to verify static markup. Move testable behavior into an owning `.ts` seam with independent production value and verify rendered behavior through production-mode Browser or E2E acceptance.
- Tests reach HTTP through `FetchHttpClient.Fetch`: one `vi.fn<typeof fetch>()` per file, provided with `Effect.provideService(FetchHttpClient.Fetch, fetcher)`. Effect's client keeps the first global `fetch` it reads, so a fresh global stub per test only works for the first one; a seam that ends in a Promise stubs that one file-level double globally and resets it between tests.
- No `.only` or `.skip`. Run the nearest test first, then the workspace suite when risk warrants it.
- React Doctor: `pnpm run doctor --verbose --scope changed --base main --include-untracked` for changed React code, `--scope full` for a whole-codebase audit; not the deprecated `--diff` alias or plain `npx react-doctor@latest`.

## Content Rendering

- Authored MDX and its editorial rules live only in Aksara; Nakafa owns the renderer. `docs/adr/0018-renderer.md` owns the contract: locale equivalents without fallback, Markdown response labels, heading levels, math component names, one current renderer implementation without version fields or compatibility adapters, and the proof required before a renderer name is removed.

## Commands And Verification

- Root commands: `pnpm dev`, `pnpm dev:web`, `pnpm dev:all`, `pnpm start`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm security:audit`, `pnpm analyze`, and `pnpm boundaries`. Prefer `pnpm start` after a build; use `pnpm dev` only for hot reload, development-mode diagnostics, devtools, or Convex live development.
- There is no root typecheck: run `pnpm --filter <workspace> typecheck` for every changed workspace; CI runs `pnpm -r run typecheck`. Judge it by its exit code, because the Effect-patched compiler reports suggestions that fail the typecheck and the build without the word "error". The shared configurations turn off `unstableApiUsage` and `experimentalApiUsage`: Effect moves as one exact cohort that is reviewed at every upgrade.
- The `www` typecheck and build validate environment variables while Next.js loads its config. Run the build through `pnpm acceptance:build`, which supplies inert values, and pass inert local values to the typecheck, as the CI typecheck step does; never copy deployment values.
- One test: `pnpm --filter <workspace> exec vitest run <relative-test-path>`. One suite: `pnpm --filter <workspace> test`.
- Run the smallest useful verification first, then expand by risk: format, `pnpm lint`, affected tests and typechecks, `pnpm build` for build-critical changes, and `pnpm security:audit` after dependency or lockfile changes. Report any verification that could not run.
- CI audits against live OSV advisories, so a new advisory can fail Quality with no code change. Bump the version-keyed override in `pnpm-workspace.yaml` in its own change, then merge `main` into waiting pull requests.

## Deployment

- Vercel Preview deployments are prohibited for every Nakafa project. Never create one through a connector or the CLI, never require a Preview URL as a gate, and cancel and clean up any accidental one at once. Keep Vercel branch configuration restricted to `main`.
- Verify feature work with local production builds and starts, exact-head GitHub CI, Browser or Playwright, and isolated Convex Agent Mode deployments where needed.
- Production deploys only through the existing Git integration after a protected merge to `main`. An operator who holds a production deploy key may also deploy Convex functions directly with `pnpm --dir packages/backend exec convex deploy --yes`.
- Do not enable external Turborepo Remote Cache for the signed `www` production build until every server-side environment input and signed-content generation input is included in the task hash.

## Git And Release

- Never overwrite or revert user changes, and never use destructive Git commands without explicit authorization. Do not commit unless the user asks.
- Before a pull request, format, run the relevant local checks, and inspect the complete diff. Production readiness requires the exact pull-request head, all required checks, reviews, mergeability, protected-branch policy, and cleanup evidence; green results from another commit are not proof.
- Automated review findings are evidence, not authority: trace each claim through the current code and authoritative sources. Unresolved review threads, automated reviewers' included, block merging, so fix each verified finding or reply with evidence, then resolve the thread.
- `main` merges only through GitHub's merge queue, and auto-merge stays off. Once Required and Doctor pass on a pull request's exact head, enqueue that head:

  ```sh
  gh api graphql -F id="$(gh pr view <number> --json id --jq .id)" -F head=<sha> \
    -f query='mutation($id: ID!, $head: GitObjectID!) { enqueuePullRequest(input: {pullRequestId: $id, expectedHeadOid: $head}) { mergeQueueEntry { position } } }'
  ```

  The queue reruns both checks on the change combined with the latest `main` and every change queued ahead of it, then squash merges it, so the branch needs no update from `main`. A pull request is merged once its state is `MERGED`, not when it enters the queue.
- A change that depends on an open pull request goes up as a GitHub stack: `gh stack init <bottom> <top>` tracks the branches locally and `gh stack submit` opens the pull requests. After the bottom merges, `gh stack sync` rebases and pushes the rest. `gh stack link` only links existing pull requests on GitHub, so run `gh stack checkout <stack>` once before syncing a stack made that way. CI runs each pull request on its own base.
- Version packages on demand: on a branch from the latest `main`, run `GITHUB_TOKEN="$(gh auth token)" pnpm version-packages` (the changelog plugin needs the token to link each entry to its pull request), then land that pull request through the queue. Keep release pull requests human-opened: CI never runs for a pull request a workflow opens with `GITHUB_TOKEN`, so it can never pass Required.
