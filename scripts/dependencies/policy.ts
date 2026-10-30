import { Array as Arr, Schema } from "effect";

/** The exact specs one reviewed dependency may declare. */
const ApprovedSpecsSchema = Schema.Union([
  Schema.Struct({ allowed: Schema.NonEmptyArray(Schema.String) }),
  Schema.Struct({ approved: Schema.String }),
]);

/** The manifests that must declare one reviewed dependency. */
const DeclarationOwnersSchema = Schema.Union([
  Schema.Struct({ declarationPaths: Schema.Array(Schema.String) }),
  Schema.Struct({ minimumDeclarations: Schema.Finite }),
]);

const DependencyNameSchema = Schema.Struct({ dependency: Schema.String });

type DependencyHold = typeof ApprovedSpecsSchema.Type &
  typeof DeclarationOwnersSchema.Type &
  typeof DependencyNameSchema.Type;

/** The exact package manager the root manifest pins for every checkout and workflow job. */
export const PACKAGE_MANAGER = "bun@1.4.4";
/**
 * The exact Node release the root manifest downloads. A workflow job that does
 * not check out the repository cannot read the manifest, so it names the same
 * release and the workflow checks compare it with this value.
 */
export const NODE_RUNTIME_VERSION = "24.22.2";
const CONTRACT_PACKAGE_VERSION = "1.0.0";
/** Effect and its platform and test packages move as one exact cohort. */
export const EFFECT_COHORT_VERSION = "4.0.5";
/**
 * Effect packages that only dependencies declare: the Confect CLI's platform
 * packages and the Confect server's AI providers. An override keeps each one
 * in the exact cohort.
 */
export const EFFECT_COHORT_OVERRIDES = [
  "@effect/ai-openai-compat",
  "@effect/ai-openrouter",
  "@effect/platform-node",
  "@effect/platform-node-shared",
] as const;
/** The Vitest runner, coverage, and UI packages move as one catalog cohort. */
export const VITEST_COHORT_VERSION = "5.0.5";
/**
 * The AI SDK core and the Convex AI gateway provider move as one catalog
 * cohort, and each bump rechecks the gateway module's provider contracts
 * (confect/gateway). The provider brings its own provider packages, so the
 * lockfile holds more than one version of @ai-sdk/provider and
 * @ai-sdk/provider-utils.
 */
export const AI_SDK_COHORT = {
  "@convex-dev/ai-sdk-provider": "0.3.0",
  ai: "7.0.140",
} as const;
/**
 * Tiptap moves as one exact cohort, and the workspace catalog does not hold it, so
 * each manifest pins it exactly. Every Tiptap package that a workspace declares is
 * held to this one version (ADR 0028). A bump changes this line and then every
 * manifest that pins the cohort: the policy test reports each declaration that still
 * holds the old version, so none is missed.
 */
const TIPTAP_COHORT_VERSION = "3.32.1";
/**
 * The Tiptap packages each manifest declares. The editor package holds the schema of
 * an assessment document, the design system holds the Memory editor, and the web app
 * declares `@tiptap/pm` alone. The backend declares the packages that its bundle imports
 * by name: the Convex bundle resolves each one from the backend, and the isolated linker does
 * not link a workspace package's dependencies into another workspace (ADR 0028).
 */
const TIPTAP_DECLARATIONS: readonly (readonly [string, readonly string[]])[] = [
  ["apps/www/package.json", ["@tiptap/pm"]],
  [
    "packages/backend/package.json",
    [
      "@tiptap/core",
      "@tiptap/extension-bold",
      "@tiptap/extension-code",
      "@tiptap/extension-italic",
      "@tiptap/extension-link",
      "@tiptap/extension-list",
      "@tiptap/extension-subscript",
      "@tiptap/extension-superscript",
      "@tiptap/extension-table",
      "@tiptap/extension-underline",
      "@tiptap/starter-kit",
    ],
  ],
  [
    "packages/design-system/package.json",
    [
      "@tiptap/core",
      "@tiptap/extension-document",
      "@tiptap/extension-highlight",
      "@tiptap/extension-list",
      "@tiptap/extension-paragraph",
      "@tiptap/extension-table",
      "@tiptap/extension-text",
      "@tiptap/extension-underline",
      "@tiptap/extensions",
      "@tiptap/markdown",
      "@tiptap/pm",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/suggestion",
    ],
  ],
  [
    "packages/editor/package.json",
    [
      "@tiptap/core",
      "@tiptap/extension-bold",
      "@tiptap/extension-code",
      "@tiptap/extension-italic",
      "@tiptap/extension-link",
      "@tiptap/extension-list",
      "@tiptap/extension-subscript",
      "@tiptap/extension-superscript",
      "@tiptap/extension-table",
      "@tiptap/extension-underline",
      "@tiptap/pm",
      "@tiptap/starter-kit",
    ],
  ],
];
/** Every Tiptap package that a manifest declares, each named once. */
const TIPTAP_PACKAGES = Arr.dedupe(
  Arr.flatMap(TIPTAP_DECLARATIONS, ([, packages]) => packages)
);

/**
 * Five transitive overrides in the root `package.json` hold a version for a reason
 * that no manifest states. `seroval` and `seroval-plugins` 1.7.3 are one copy each
 * for TanStack Start's serializer, its web plugins, and the prerender
 * (`apps/www/prerender.config.ts`): the TanStack packages declare `^1.6.7`, and Bun
 * kept their nested 1.6.8 copies, which GHSA-9wx9-5pv9-3349 and GHSA-f86p-h4j2-7qgj
 * affect, when the web app moved. `prosemirror-transform` 1.12.4 is the one copy that the
 * ProseMirror packages of `@tiptap/pm` and the backend's step folding share: Bun
 * kept the packages' nested 1.12.2 copies when the backend moved to 1.12.4, and a
 * step made by one copy fails `instanceof` checks against the other. `convex-helpers` 0.1.131, the latest release that the
 * release-age gate admits on 30 October 2026, keeps one copy for every Convex
 * component: @convex-dev/aggregate 0.3.4 pins
 * 0.1.128 exactly, the Agent and Workflow peers need ^0.1.127, and the Workpool peer
 * needs ^0.1.94, so one copy satisfies every range. `ip-address` 10.7.4 keeps the
 * socks path of sigstore, a root devDependency, on a patched release: GHSA-j6r3-76f7-8jcv
 * and GHSA-h3mg-xc3c-68pw affect ip-address 10.7.0 and earlier, and 10.7.1 fixes both.
 */
export const DEPENDENCY_HOLDS: readonly DependencyHold[] = [
  { approved: "19.3.1", dependency: "react", minimumDeclarations: 1 },
  { approved: "19.3.1", dependency: "react-dom", minimumDeclarations: 1 },
  { approved: "19.3.0", dependency: "@types/react", minimumDeclarations: 1 },
  {
    approved: "19.3.0",
    dependency: "@types/react-dom",
    minimumDeclarations: 1,
  },
  { approved: "11.17.2", dependency: "mermaid", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "effect",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/platform-browser",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/platform-node",
    minimumDeclarations: 1,
  },
  {
    approved: "catalog:",
    dependency: "@effect/vitest",
    minimumDeclarations: 1,
  },
  { approved: "catalog:", dependency: "vitest", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "@vitest/coverage-istanbul",
    minimumDeclarations: 1,
  },
  { approved: "catalog:", dependency: "@vitest/ui", minimumDeclarations: 1 },
  {
    approved: "0.63.0",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "1.48.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "catalog:", dependency: "ai", minimumDeclarations: 1 },
  {
    approved: "catalog:",
    dependency: "@convex-dev/agent",
    minimumDeclarations: 1,
  },
  {
    approved: "0.4.14",
    declarationPaths: ["packages/backend/package.json"],
    dependency: "@convex-dev/workpool",
  },
  {
    approved: "catalog:",
    dependency: "@convex-dev/ai-sdk-provider",
    minimumDeclarations: 1,
  },
  {
    approved: "1.6.33",
    dependency: "better-auth",
    minimumDeclarations: 1,
  },
  { approved: "1.6.33", dependency: "auth", minimumDeclarations: 1 },
  {
    allowed: ["^0.0.62"],
    dependency: "convex-test",
    minimumDeclarations: 1,
  },
  {
    approved: "0.12.6",
    dependency: "@convex-dev/better-auth",
    minimumDeclarations: 1,
  },
  {
    approved: CONTRACT_PACKAGE_VERSION,
    declarationPaths: [
      "apps/www/package.json",
      "packages/backend/package.json",
      "packages/contents/package.json",
      "packages/email/package.json",
      "packages/internationalization/package.json",
      "packages/seo/package.json",
    ],
    dependency: "@nakafa/aksara-contracts",
  },
  {
    approved: "2.5.15",
    dependency: "@biomejs/biome",
    minimumDeclarations: 1,
  },
  {
    approved: "24.19.2",
    dependency: "@types/node",
    minimumDeclarations: 1,
  },
  { approved: "8.0.2", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.11.10", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.11.10",
    dependency: "@turbo/gen",
    minimumDeclarations: 1,
  },
  {
    approved: "9.8.2",
    dependency: "@react-three/fiber",
    minimumDeclarations: 1,
  },
  { approved: "0.22.2", dependency: "afdocs", minimumDeclarations: 1 },
  // The marked that @tiptap/markdown lexes with. The Memory page reads stored
  // Markdown with the same lexer, so a row says what the editor shows; it moves
  // with the editor's lexer, which plain.test.ts checks, never with the latest.
  {
    approved: "npm:marked@^17.0.1",
    dependency: "marked-tiptap",
    minimumDeclarations: 1,
  },
  // The collab plugin that steps sync uses (ADR 0028). Tiptap 3.32.1 does not
  // ship it. It is MIT, depends on prosemirror-state alone, and its last
  // release is 1.3.1 of 17 May 2023, so it is pinned exactly, as Tiptap is. The
  // design system installs its extension, and the sync loop of the web app
  // reads the same plugin's state.
  {
    approved: "1.3.1",
    declarationPaths: [
      "apps/www/package.json",
      "packages/design-system/package.json",
    ],
    dependency: "prosemirror-collab",
  },
  // The model and the transform that the server folds stored steps with (ADR
  // 0028). They are the versions that `@tiptap/pm` 3.32.1 resolves in
  // `bun.lock` (the transform through its root override), so the server applies
  // a step with the code the editors run.
  {
    approved: "1.25.12",
    declarationPaths: ["packages/backend/package.json"],
    dependency: "prosemirror-model",
  },
  {
    approved: "1.12.4",
    declarationPaths: ["packages/backend/package.json"],
    dependency: "prosemirror-transform",
  },
  // The math input of the exam editor. It is MIT, and it loads only when a formula
  // popover opens, so no page's first JavaScript holds it. Its version moves only when
  // a reviewed release is adopted.
  {
    approved: "0.111.1",
    declarationPaths: ["packages/design-system/package.json"],
    dependency: "mathlive",
  },
  ...Arr.map(TIPTAP_PACKAGES, (dependency) => ({
    approved: TIPTAP_COHORT_VERSION,
    declarationPaths: Arr.map(
      Arr.filter(TIPTAP_DECLARATIONS, ([, packages]) =>
        Arr.contains(packages, dependency)
      ),
      ([path]) => path
    ),
    dependency,
  })),
];

export const REGISTRY_REVIEWS = [
  [
    "react@latest",
    "19.3.1",
    'The declared React is 19.3.1, the latest 19.3 release (checked 16 October 2026). Its release lists one entry, "Improve transport protocol" (facebook/react#37845), which adds a development-mode warning for an empty Flight or Fizz chunk where ArrayBuffer.prototype.detached is missing. Fiber 9.8.2 accepts React 19.3 (its peer range is >=19 <19.4), and scene labels no longer use drei\'s Html, so no second React root is created per label.',
  ],
  [
    "react-dom@latest",
    "19.3.1",
    "React DOM is 19.3.1, the same release as React. react-dom 19.3.1 requires react ^19.3.1, and the overrides pin both to 19.3.1.",
  ],
  [
    "@types/react@latest",
    "19.3.0",
    "19.3.0 is the newest published React declarations (checked 16 October 2026), so they stay on it while the runtime is 19.3.1.",
  ],
  [
    "@types/react-dom@latest",
    "19.3.0",
    "19.3.0 is the newest published React DOM declarations (checked 16 October 2026), so they stay on it while the runtime is 19.3.1.",
  ],
  [
    "mermaid@latest",
    "12.2.0",
    "Mermaid 12 requires Safari 17.4 (recorded when this hold was made; not re-measured on 25 October 2026), while Nakafa keeps the Safari 16.4 floor that Vite 8.3.5 builds for by default (its baseline-widely-available target lists safari16.4). The hold holds while both are true.",
  ],
  [
    "effect@latest",
    "4.1.0",
    "Effect 4.1.0 is the latest release and is reviewed here, but the cohort stays on 4.0.5 (EFFECT_COHORT_VERSION). 4.1.0 replaces effect/Crypto with the effect/crypto services (Digest, SecureRandom, Signature, KeyFormat, Mac, Aead) and no longer bundles crypto in the runtime layers. Every published @nakafa/aksara-contracts (1.0.0, 1.0.1 and 2.0.0) peers effect 4.0.5 exactly, and its dist/hash/digest.js calls Crypto.make from effect when the module loads, so on 4.1 every contracts import fails. nakafa.com therefore moves to 4.1.0 in the change that adopts a contracts release built on 4.1, which follows the contracts 2.0 adoption (#1434, #1436). Checked 30 October 2026.",
  ],
  [
    "@effect/platform-browser@latest",
    "4.1.0",
    "@effect/platform-browser follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/platform-node@latest",
    "4.1.0",
    "@effect/platform-node follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/platform-node-shared@latest",
    "4.1.0",
    "@effect/platform-node-shared follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/vitest@latest",
    "4.1.0",
    "@effect/vitest follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    "4.1.0",
    "@effect/ai-openai-compat follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/ai-openrouter@latest",
    "4.1.0",
    "@effect/ai-openrouter follows the Effect cohort. Its 4.1.0 release peers effect ^4.1.0, so it moves with effect@latest and stays on 4.0.5 until the cohort moves.",
  ],
  [
    "@effect/tsgo@latest",
    "0.63.0",
    "Compiler patching moves with TypeScript and Effect. Every rule is decided in packages/typescript-config/base.json, and docs/adr/0021-rules.md records each decision. 0.57 adds the experimental tsrs build and 0.59 adds the effect-tsgo tsc, tsrs and oxlint proxy commands, which this repository does not use: it patches the installed compiler. 0.61 adds flatMapIdentityToFlatten, 0.62 mapConstToAs, and 0.63 failCauseToConstructor and manualMetricTapToTrack, each a style suggestion by default that base.json sets to error, and the opt-in mapMapErrorToMapBoth, which base.json keeps off as upstream does. 0.63 also names the catch variant in two messages and builds quick-fix references from the file's imports. 0.63.0 is the latest release and supports TypeScript 7.0.2.",
  ],
  ["vitest@latest", "5.0.5", "The Effect 4 test adapter requires Vitest 5."],
  [
    "@vitest/coverage-istanbul@latest",
    "5.0.5",
    "Coverage must match the supported Vitest runner.",
  ],
  [
    "@vitest/ui@latest",
    "5.0.5",
    "The test UI must match the supported Vitest runner.",
  ],
  [
    "@nakafa/aksara-contracts@latest",
    "2.0.0",
    "2.0.0 replaces the question and try-out contracts with the assessment snapshot, and nakafa.com adopts it in the try-out engine train (#1434, #1436), so this repository stays on 1.0.0 until that train lands. 2.0.0 still peers effect 4.0.5 exactly, as 1.0.0 does.",
  ],
  [
    "convex-test@latest",
    "0.0.66",
    "convex-test 0.0.65 fails 115 backend tests in 52 files that pass on 0.0.62 (measured 25 October 2026 with the backend test suite on the merged tree). 0.0.63 to 0.0.66 pin a transaction's clock at or after its snapshot, enforce search candidate limits in paginated queries, fail fast on an unregistered component, allow one paginate() per component query, and support ctx.auth.signJwt in mutations; which of them the failures follow is not traced yet. The backend stays on the 0.0.62 range until it is, and the Agent and Workpool releases that paginate inside their components wait for it (re-checked 30 October 2026).",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "convex@latest",
    "1.48.0",
    "Convex 1.48 adds `ctx.auth.signJwt`, redacts environment values in deploy logs, lists environment variable names only for agents, and makes storage available in mutations. Its `convex deploy` asks before it creates or changes a non-staged index on a table of 100,000 documents or more, and a non-interactive deploy fails there unless `--skip-large-indexes-check` is passed, so a production build that adds such an index fails without that flag. Acceptance uses an isolated deployment.",
  ],
  [
    "ai@latest",
    "7.0.153",
    "AI SDK packages move as one reviewed cohort. 7.0.140 stays: 7.0.141, 7.0.142, 7.0.147 and 7.0.152 each fail the backend typecheck with TS2590 in confect/nina (21 errors each, measured on 25 October 2026 with @convex-dev/agent 0.7.8), and 7.0.140 passes. 7.0.153 is the latest release and becomes eligible at 2026-10-25 17:57 UTC; re-test it then. Its release notes change the streamed input of OpenAI custom tools and the workflow telemetry context, and Nakafa uses neither.",
  ],
  [
    "@convex-dev/agent@latest",
    "0.7.9",
    "The Agent component stays on 0.7.8 while convex-test stays on 0.0.62. 0.7.9 lists the component's files, threads, streams and users with one native ctx.db paginate() per query instead of the convex-helpers paginator. Convex runs one paginate() per component query, and convex-test supports it from 0.0.64 (get-convex/convex-test#163), but 0.0.62 refuses it (\"paginate() is only supported in the app\"): measured on 30 October 2026, 42 backend tests in 14 files fail on 0.7.9 with 0.0.62, among them the Agent file sweep, chat deletion, Nina sealing and privacy erasure. The component moves with the convex-test upgrade.",
  ],
  [
    "@convex-dev/workpool@latest",
    "0.4.15",
    "The Workpool component stays on 0.4.14 for the reason of the Agent entry: 0.4.15 reads its stats report (component/stats.js, run by the main loop) with a native paginate() inside the component, which convex-test 0.0.62 refuses, so 11 backend tests in 3 files that drive the Workflow component fail (privacy recovery, account deletion cleanup, content release proof). It moves with the convex-test upgrade.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "better-auth@latest",
    "1.7.14",
    "@convex-dev/better-auth 0.12.6, the latest adapter, still declares the peer range >=1.6.11 <1.7.0 (checked 30 October 2026), so runtime stays on the latest 1.6 patch (1.6.33) until the adapter opens 1.7. Its optional Vitest peer stops at 4, but only unused test-utils import Vitest; Nakafa auth runtime tests pass on 5.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.6",
    "The adapter defines the accepted Better Auth peer range. 0.12.6 keeps >=1.6.11 <1.7.0 and convex-helpers ^0.1.128.",
  ],
  [
    "posthog-node@latest",
    "5.60.1",
    "posthog-node 5.57.2 and later read the OpenTelemetry API from its global symbol instead of importing @opentelemetry/api, and 5.59 moves the OpenTelemetry integration to the separate posthog-node/otel entrypoint, so the Convex bundle of @posthog/convex resolves without the optional peer. The override that held the component on 5.55.1 is gone, and the component and the analytics package share one release. 5.60.1 is the latest release and becomes one day old at 2026-10-30 17:51 UTC; the release-age gate resolves 5.57.2 until then.",
  ],
  [
    "@biomejs/biome@latest",
    "2.6.4",
    "Formatting is reviewed as one cohort with Ultracite. Biome stays on 2.5.15. Ultracite 8.1.0 peers Biome ^2.6.2 and renames useSortedClasses to useTailwindSortedClasses, so the 2.6 line loads now, but the cohort also sorts classes in Tailwind CSS v4 order and turns on the rules that Biome 2.6 made stable. Measured on 30 October 2026 with Biome 2.6.4 and Ultracite 8.1.0: 1,620 findings in about 550 files, among them 733 class lists to re-sort in 290 files, 410 regular expressions without the unicode flag, 177 unnamed capture groups, 101 hook factory components (noComponentHookFactories) and 83 imports after code. That change touches most of the files that the open pull requests touch, so it lands in its own change when the merge trains allow it.",
  ],
  [
    "ultracite@latest",
    "8.1.0",
    "Ultracite 8.1 moves with Biome 2.6, as the Biome entry describes: it renames the class sort rule, sorts the class lists of cva variants, turns on the newly stable Biome rules that match its Oxlint presets, and formats YAML and SCSS. Its ESLint, Oxlint, Oxfmt and Zed changes do not apply to this Biome setup.",
  ],
  ["@types/node@24", "24.19.2", "Declarations remain on the Node 24 line."],
  ["node@24", "24.22.2", "The repository supports the Node 24 runtime line."],
  [
    "react-doctor@latest",
    "0.9.18",
    "The local scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled. 0.9.18 narrows existing rules to reduce false positives and adds the opt-in --scope contextual mode, which this repository does not use.",
  ],
  [
    "turbo@latest",
    "2.11.10",
    "Turbo and its generator move together. 2.11.10, published 2026-10-20, is the newest release one day old, and the repository gates pass on it.",
  ],
  [
    "@react-three/fiber@latest",
    "9.8.2",
    "Fiber 9.8.2 accepts React 19.3 (its peer range is >=19 <19.4) and mounts a scene inside the React DOM commit that renders its canvas. Its 9.8.2 release notes keep pointer capture when an object's args change during a drag, request a frame when an object is removed with frameloop demand, fix the createPortal memory leaks with Activity, and make roots follow devicePixelRatio changes. Scene labels draw in one DOM overlay per canvas (components/three/overlay.tsx) and no longer use drei's Html, which created a second React root per label. That root's replacement during Fiber's mount cleared the first label of every scene and made a label's removal throw on lesson navigation (pmndrs/drei#2867). drei 10.7.9 peers Fiber ^9.0.0, which 9.8.2 satisfies. Fiber 10, still prerelease, removes THREE.Clock: its upgrade drops the Clock allowance in apps/www/e2e/scene/lines.browser.ts and rechecks SceneTime in packages/design-system/components/three/canvas.tsx, which relies on Fiber 9 restarting the clock on frameloop changes and on internal.frames.",
  ],
  [
    "afdocs@latest",
    "0.22.2",
    "AFDocs 0.21 adds the page-size-transfer check. A cached surah page serves 0.73 to 0.88 MB; its first render after a deploy or a publication also carries the prefetch stream of the retired framework and serves up to 1.24 MB, so agent-docs.config.yml sets the pass line at 1.5 MB. AFDocs 0.22 adds the markdown-link-portability check, which the agent Markdown passes because site paths are written as absolute URLs. That check sends its first requests right after three checks that only compute, and for 50 large pages they hold the event loop longer than the 5 seconds a Node server keeps an idle connection, so the checker reused connections that the local server had closed (fetch failed, ECONNRESET). The start script of apps/www therefore keeps idle connections for 70 seconds, as a production proxy does.",
  ],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    // bunx installs React Doctor into a throwaway directory, so it takes the
    // one-day release age from its own flag: a 4-minute-old electron-to-chromium
    // tarball was still propagating through npm and returned 404, which failed
    // Doctor. The flag keeps that install on settled releases.
    approved: "bunx --minimum-release-age 86400 react-doctor@0.9.18",
    manifestPath: "apps/www/package.json",
    script: "doctor",
  },
];

const IN_EFFECT = "the matching module of effect";

/**
 * Packages whose job Effect or the platform now does, each with what to use
 * instead. No first-party manifest declares one, so one cannot come back.
 */
export const OBSOLETE_DEPENDENCIES = {
  "@effect/cluster": IN_EFFECT,
  "@effect/experimental": IN_EFFECT,
  "@effect/language-service": "@effect/tsgo, which patches the native compiler",
  "@effect/platform": IN_EFFECT,
  "@effect/rpc": IN_EFFECT,
  "@effect/sql": IN_EFFECT,
  "@effect/workflow": IN_EFFECT,
  "date-fns":
    "Intl.DateTimeFormat and Intl.RelativeTimeFormat with DateTime and Duration from effect, as apps/www/src/lib/i18n/date.ts does",
  nanoid: "randomUuid from @repo/utilities/uuid",
  next: "TanStack Start and TanStack Router, which the www app runs on",
};

/**
 * Packages that bun.lock must not resolve, each with what replaced it. Hono
 * stays only as an optional peer that convex-helpers declares (ADR 0029).
 */
export const RETIRED_LOCK_PACKAGES = {
  hono: "the Confect router with Effect HttpApi (ADR 0029)",
};
