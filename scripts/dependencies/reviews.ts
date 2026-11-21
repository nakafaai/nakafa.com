import { AI_SDK_COHORT } from "#scripts/dependencies/policy";

/**
 * The upstream release that was last reviewed for each held dependency, with the
 * reason the hold stays. `bun run bump-deps` reports a registry whose latest
 * release is newer than its review, so a new release is reviewed before it lands.
 */
export const REGISTRY_REVIEWS = [
  [
    "alchemy@latest",
    "2.0.0-beta.87",
    "2.0.0-beta.87 is the latest release and the adopted one. It peers effect ^4.1.4, so it moves with that cohort. beta.86 breaks Archil, Domain, Fly, Prisma, SQL and Docker interfaces, regenerates the distilled Cloudflare and GitHub specs, adds Resource.lookup, drops resolveProgram's telemetry option and Cloudflare SSL issuance attributes, and moves GitHub credentials to GitHub.fromApp; the Nakafa stack typechecks against all of them. beta.87's cloudflare-runtime proxies the Vite preview and dev requests to workerd over a Unix socket, which ends the loopback port exhaustion of alchemy-run/alchemy#3194. A deploy with it moves the shared state store, so it lands right after its first deploy. Checked 13 November 2026.",
  ],
  [
    "effect@latest",
    "4.1.4",
    "Effect 4.1.4 is the latest release and the adopted cohort (EFFECT_COHORT_VERSION). 4.1.3 and 4.1.4 are patch releases: Rational, CLI completion and validation fixes, cluster workflow retries, a TestClock finalizer fix, and OpenRouter schema regeneration. The contracts follow the cohort: @nakafa/aksara-contracts 8.4.0 peers effect 4.1.4 exactly. Checked 20 November 2026.",
  ],
  [
    "@effect/platform-node@latest",
    "4.1.4",
    "@effect/platform-node follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@effect/platform-node-shared@latest",
    "4.1.4",
    "@effect/platform-node-shared follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@effect/vitest@latest",
    "4.1.4",
    "@effect/vitest follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    "4.1.4",
    "@effect/ai-openai-compat follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@effect/ai-openrouter@latest",
    "4.1.4",
    "@effect/ai-openrouter follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@effect/platform-bun@latest",
    "4.1.4",
    "@effect/platform-bun follows the Effect cohort and moves with effect@latest; 4.1.4 is the adopted release.",
  ],
  [
    "@confect/core@latest",
    "10.6.0",
    "Confect moves with the Effect cohort (CONFECT_COHORT_VERSION). 10.6.0 is the latest release and the adopted one: its core, server, client, CLI and test packages admit effect ~4.1.0, which holds 4.1.2, and its server requires convex 1.48.0 or later and convex-test 0.0.67 or later. It backs first() and take(n) with Convex's native take() and refuses a count that is not a non-negative integer. Checked 13 November 2026.",
  ],
  [
    "@effect/tsgo@latest",
    "0.73.2",
    "Compiler patching moves with tsrs and Effect, and every rule is decided in packages/typescript-config/base.json, which Aksara's rule block matches (docs/adr/0021-rules.md). 0.73.2 is the latest release and the adopted one: it patches tsrs 7.1.0-beta.tsrs2 and 7.1.0-beta.tsrs3 (the version table of its README) and no longer patches 0.25.0-ts7.1.0-beta, so tsrs moves with it, and prepare runs the same effect-tsgo patch --tsrs --no-typescript. 0.70 to 0.73 add five rules, which base.json decides (docs/adr/0021-rules.md): flatMapMapToZipWith and flatMapProvideServiceToProvideServiceEffect, which upstream ships as suggestions that fail the typecheck until decided, and forLoopPushToForEach, promiseAllInEffect and promiseRaceInEffect, which upstream ships off. 0.72, 0.73.1 and 0.73.2 change only the Vite+ integration and release builds. Checked 20 November 2026.",
  ],
  [
    "vitest@latest",
    "5.1.1",
    "The Effect 4 test adapter requires Vitest 5; @effect/vitest 4.1.4 admits >=5.0.0 <6.0.0. 5.1.1 is the latest release and the adopted one: fixes for fixture teardown, a new signal and reset assertion counts on each retry, --shard, coverage of untested files and stuck fork workers, and timeouts throw their own error classes. Checked 20 November 2026.",
  ],
  [
    "@vitest/coverage-istanbul@latest",
    "5.1.1",
    "Coverage must match the supported Vitest runner; 5.1.1 peers vitest 5.1.1 exactly. Checked 20 November 2026.",
  ],
  [
    "@vitest/ui@latest",
    "5.1.1",
    "The test UI must match the supported Vitest runner; 5.1.1 peers vitest 5.1.1 exactly. Checked 20 November 2026.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    "8.4.0",
    "nakafa.com declares 8.4.0, which peers effect 4.1.4 exactly, the adopted cohort. 7.1.0 added the 100 labs of the science stack to the Visual Catalog, 8.0.0 removes LineEquation, NumberLine and UnitCircle, which MathVisual replaces and no document used, and 8.0.2 adds ElectrolysisLab, TitrationLab, ChemicalCellLab and GasRateLab and the SPM organic molecules of MoleculeShapeLab, and 8.0.3 sends snapshot rows in batches of at most 512 KiB, so the largest Quran row (369 KiB) still fits one batch, and 8.0.4 decides whether a region figure shows without tracing its outline, so decoding a region row costs milliseconds instead of up to 0.8 s and every stageSnapshotBatch mutation stays inside Convex's one second, and 8.1.0 adds the eight biology labs (potometer, respirometer, Hydrilla, microscope, nephron, tropism, double fertilisation and osmosis), decides whether an equation draws without tracing it, and shades a region's whole cells as one rectangle per column run, so the renderer no longer joins fill cells itself, and 8.2.0 adds the forty SPM physics labs and requires a title and a description on every visual card, and 8.3.0 adds the probability and place-value labs (marble, dice, Galton board, abacus and binary lamp), and 8.4.0 gives every visual card an optional authored footer, keeps scene labels to 32 characters and joins contour outlines both ways. The acceptance runtime publishes Aksara's corpus at a reviewed revision whose content every contract rule up to the declared version accepts (`source.json`). Every catalog figure renders in lessons and try-outs through one renderer, whose registry equals the catalog. Checked 20 November 2026.",
  ],
  [
    "tsrs@latest",
    "7.1.0-beta.tsrs3",
    "tsrs is the Rust port of the TypeScript 7.1 checker, pinned exactly to 7.1.0-beta.tsrs3, the latest release and one of the two that @effect/tsgo 0.73.2 patches. From tsrs2 a version names the TypeScript release it targets and a tsrs revision, so 0.25.0-ts7.1.0-beta was the last of the old scheme. tsrs3 checks against TypeScript 7.1.0-beta at the same source commit, fixes compiler and lint edge cases, and leaves the tsrs/sync, tsrs/ast and tsrs/fs modules and the tsdk folder that the source check and the editors load unchanged byte for byte. Every typecheck, the language server, and the source check's compiler API run on it. Checked 20 November 2026.",
  ],
  [
    "ai@latest",
    "7.0.177",
    "AI SDK packages move as one reviewed cohort. 7.0.177 is the latest release and the adopted one (7.0.174 to 7.0.177 add batch output, extraction models in provider registries, a steering interrupt and one-pass validation of UI message metadata, and move @ai-sdk/provider to 4.0.39 and provider-utils to 5.0.82; none of these is used here): @convex-dev/agent 0.7.9 peers ai ^7.0.129, the gateway provider 0.3.0 peers ^7.0.105, and the gateway module (confect/gateway) typechecks against it. From 7.0.171 a failed tool's error text reaches the client as the model received it, and the agent offers no redactToolErrors, so a Nina capability that breaks on a defect settles as a failure whose text names no cause (confect/nina/capability/progress.ts). Checked 20 November 2026.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "@convex-dev/agent@latest",
    "0.7.10",
    "The backend stays on 0.7.9. 0.7.10 reads the recent window differently: when the window cuts the oldest order short and that order holds the prompt, it reads the order whole in a loop of pages instead of one bounded page (vercel/client/search.js), and it stores reasoning once in content, drops the unused memories table from its schema, and renders error-text and error-json tool results as output-error. The sealed module mirrors 0.7.9's window read step for step (confect/nina/sealed/context.ts), so a sealed thread reads what a plain one reads, and on 0.7.10 eighteen Nina tests fail across sealed/context, sealed/thread, sealed/turn, presentation, response, generation, messages/page and memory/tool: the follow-up suggestions call no model and the sealed window differs from the Agent's. The move ports the new window read into the sealed module and proves those suites again. Checked 20 November 2026.",
  ],
  [
    "@convex-dev/auth@latest",
    "2.1.0",
    "Convex Auth v2, the auth that Convex recommends for Convex apps: sessions, the Google method, and the username and password method that school accounts sign in with (confect/auth/core). 2.1.0 is the latest release and the adopted one. It adds deleteUser to the OAuth components, which the last step of an account deletion calls for the Google component (confect/auth/deletion/finalize), and hands the ID token's hd claim to the user callbacks as profile.hostedDomain, which GoogleProfile names because the callbacks' argument validator refuses a field it does not name (confect/auth/methods). The core keeps the session lifetimes in a one-row ttlConfig table, read at each session start and refresh and written only when a lifetime changes. It offers no public custom sign-in method (convex/convex-auth#900), so agent grants are Nakafa's own tokens signed with ctx.auth.signJwt, and the password component has no deletion by user yet (convex/convex-auth#924), so a deleted school account's password hash stays until a release adds one. Checked 20 November 2026.",
  ],
  [
    "@react-three/fiber@latest",
    "9.8.2",
    "Fiber stays on 9.8.2, the latest release. Fiber 9 builds every Canvas root with the THREE.Clock that three r183 deprecated, so each canvas logs one console notice, which apps/www/e2e/support/scene.ts allows as that exact line. No dependency patch removes it, because scripts/check/patches.ts refuses every patch. Fiber 10 removes the Clock (pmndrs/react-three-fiber#3741) and exists only as alpha and canary. When @latest moves to 10: adopt it, move the labs from state.clock to the timer, and delete the allowance in scene.ts. Checked 14 November 2026.",
  ],
  [
    "@polar-sh/sdk@latest",
    "1.3.1",
    "The backend stays on 1.0.2. 1.3.1 moves the Outpost and its OpenTelemetry, ioredis and @vercel/oidc imports to the @polar-sh/sdk/outpost subpath, which nothing here imports, so the cause of the 1.1.0 hold is gone. But @polar-sh/sdk/2026-10, whose createPolarCore, errors and webhooks the billing client and the Polar webhook route import (confect/billing/polar, confect/routes/polar.ts), statically imports the metering chunk dist/client-Os3zkUrE.mjs, which imports node:timers/promises (sdk/typescript/src/metering/buffered.ts). Convex bundles the default runtime for the browser platform, so the HTTP router cannot resolve it and the deploy fails; 1.1.0 carried the same import in dist/client-Bz9G1UDp.mjs. Move when a release keeps node: built-ins out of the 2026-10 entry. Checked 20 November 2026.",
  ],
  [
    "@convex-dev/workpool@latest",
    "0.5.0",
    "The backend stays on 0.4.16. Its one pool is the child that @convex-dev/workflow installs (workflow/workpool), and Workflow 0.5.0, the latest, peers @convex-dev/workpool ^0.4.16, which excludes 0.5.0. The backend's own declaration supplies vResultValidator to the privacy and invite completion handlers and decides which copy the Workflow component links. 0.5.0 orders queues by commit timestamp, requires convex 1.47, migrates queued work itself, and cannot be downgraded; before it, each pool on 0.4.15 or later runs migrations:backfillPendingStartIds (npx convex run --component workflow/workpool migrations:backfillPendingStartIds). Move when a Workflow release admits 0.5, after that migration has run on every deployment. Checked 20 November 2026.",
  ],
  [
    "@types/node@26",
    "26.6.6",
    "The root, API and MCP manifests declare the Node 26 types (#1872): the scripts and tooling run on Node 26, and the API and MCP Workers run on workerd. The backend declares no Node types, so its Node actions on node.nodeVersion 24 (packages/backend/convex.json) gain no Node 26 API from this.",
  ],
  [
    "node@26",
    "26.13.1",
    "Node 26 is the Active LTS line since 28 October 2026, and the tooling, CI and devEngines run it. 26.13.1 is the security release of 10 November 2026: nine high CVEs in HTTP/2, TLS and HTTP, with undici 8.12.4 and llhttp 9.4.4. Convex Node actions stay on 24 until a dev deployment proves 26.",
  ],
  [
    "react-doctor@latest",
    "0.9.23",
    "The local scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled. 0.9.23, released 13 November 2026, is the adopted one: since 0.9.18 the releases narrow existing rules (an effect cleanup that only reads a local binding counts as empty, button type keywords in any case), pin the hooks plugin the lockfile resolves, and bound the duplicate-JSX analysis so it finishes on a large project. Checked 14 November 2026.",
  ],
];
