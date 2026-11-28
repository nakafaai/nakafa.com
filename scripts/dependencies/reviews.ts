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
    "4.1.5",
    "Effect 4.1.5 is the latest release and the adopted cohort (EFFECT_COHORT_VERSION). It is a patch release: Arbitrary reports unsupported regex patterns and shrinks strings anywhere, Cache and ScopedCache entries expire under a provided clock after an interrupted shared lookup, Chunk.fromIterable copies its array, field discovery handles own enumerable string and symbol fields (a field map declared as an interface is no longer accepted), cluster workflow and entity redelivery fixes, and the new effect/crypto/Password, Base64.encodeUnpadded and nthRoot helpers; the Node HTTP server answers 503 while not serving and survives request errors after an aborted stream. The contracts follow the cohort: @nakafa/aksara-contracts 8.9.1 peers effect 4.1.5 exactly. Checked 21 November 2026.",
  ],
  [
    "@effect/platform-node@latest",
    "4.1.5",
    "@effect/platform-node follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@effect/platform-node-shared@latest",
    "4.1.5",
    "@effect/platform-node-shared follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@effect/vitest@latest",
    "4.1.5",
    "@effect/vitest follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    "4.1.5",
    "@effect/ai-openai-compat follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@effect/ai-openrouter@latest",
    "4.1.5",
    "@effect/ai-openrouter follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@effect/platform-bun@latest",
    "4.1.5",
    "@effect/platform-bun follows the Effect cohort and moves with effect@latest; 4.1.5 is the adopted release.",
  ],
  [
    "@confect/core@latest",
    "10.6.0",
    "Confect moves with the Effect cohort (CONFECT_COHORT_VERSION). 10.6.0 is the latest release and the adopted one: its core, server, client, CLI and test packages admit effect ~4.1.0, which holds 4.1.2, and its server requires convex 1.48.0 or later and convex-test 0.0.67 or later. It backs first() and take(n) with Convex's native take() and refuses a count that is not a non-negative integer. Checked 13 November 2026.",
  ],
  [
    "@effect/tsgo@latest",
    "0.73.4",
    "Compiler patching moves with tsrs and Effect, and every rule is decided in packages/typescript-config/base.json, which Aksara's rule block matches (docs/adr/0021-rules.md). 0.73.2 is the adopted release: it patches tsrs 7.1.0-beta.tsrs2 and 7.1.0-beta.tsrs3. 0.73.4 is the latest release, and it widens missedPipeableOpportunity across 683 sites here (and 171 in Aksara) on two-call expressions such as Schema.optionalKey(Schema.Array(...)); hold on 0.73.2 until that rule sweep lands in its own change. Checked 24 November 2026.",
  ],
  [
    "vitest@latest",
    "5.1.1",
    "The Effect 4 test adapter requires Vitest 5; @effect/vitest 4.1.5 admits >=5.0.0 <6.0.0. 5.1.1 is the latest release and the adopted one: fixes for fixture teardown, a new signal and reset assertion counts on each retry, --shard, coverage of untested files and stuck fork workers, and timeouts throw their own error classes. Checked 20 November 2026.",
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
    "8.17.3",
    "nakafa.com declares 8.17.3, which peers effect 4.1.5 exactly, the adopted cohort. 8.17.3 keeps the 366-visual catalog, every verdict, digest and error order of 8.17.2, and proves structured snapshots in one replay of their rows instead of five, with canonical JSON written by one codec call per value (aksara#1081). The 32,901-row assessment proof inside a Convex Node action drops from timing out at 600 seconds to 52 seconds on a 3-CPU instance and about 250 seconds on a throttled 2-CPU one. Checked 28 November 2026.",
  ],
  [
    "tsrs@latest",
    "7.1.0-beta.tsrs5",
    "tsrs is the Rust port of the TypeScript 7.1 checker, pinned exactly to 7.1.0-beta.tsrs3, one of the two that @effect/tsgo 0.73.2 patches. 7.1.0-beta.tsrs5 is the latest release, and it waits for the @effect/tsgo upgrade, because every typecheck runs the patched compiler. Every typecheck, the language server, and the source check's compiler API run on it. Checked 24 November 2026.",
  ],
  [
    "ai@latest",
    "7.0.181",
    "AI SDK packages move as one reviewed cohort. 7.0.181 is the latest release and the adopted one. 7.0.180 updates @ai-sdk/gateway to 4.0.153; 7.0.181 adds per-call onWarning, stoppedBy on generateText/streamText, steering delivery reporting, and strips provider options from text and file parts in extraction. @convex-dev/agent 0.7.11 peers ai ^7.0.129, the gateway provider 0.3.0 peers ^7.0.105, and the gateway module (confect/gateway) typechecks against it. Checked 24 November 2026.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "@convex-dev/agent@latest",
    "0.7.11",
    "0.7.11 is the latest release and the adopted one. 0.7.10 reads the whole oldest order of a window in pages of at most 1,000 when that order holds the prompt, and one page otherwise (vercel/client/search.js), derives reasoning and reasoningDetails on read from the reasoning parts that it stores once in content (withDerivedReasoning), drops the unused memories table from its schema, and renders error-text and error-json tool results as output-error. The sealed module mirrors both reads (confect/nina/sealed/context.ts and sealed.ts): it reads the continued order whole the same way, ignores the empty reasoning that the component derives from a sealed row's skeleton, and derives reasoning from the opened content, so a sealed thread reads what a plain one reads. 0.7.11 changes the approval continuation, which applies only when a tool requests approval, and no Nina tool does. Checked 21 November 2026.",
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
    "1.3.3",
    "1.3.3 is the latest release and the adopted one. 1.3.3 keeps node:timers/promises solely in the @polar-sh/sdk/outpost subpath, which nothing here imports, so @polar-sh/sdk/2026-10 bundles cleanly in Convex's default runtime. Checked 24 November 2026.",
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
