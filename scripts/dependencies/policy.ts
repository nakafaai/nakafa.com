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
export const PACKAGE_MANAGER = "pnpm@11.28.5";
/**
 * The exact Node release the root manifest downloads. A workflow job that does
 * not check out the repository cannot read the manifest, so it names the same
 * release and the workflow checks compare it with this value.
 */
export const NODE_RUNTIME_VERSION = "24.21.0";
const CONTRACT_PACKAGE_VERSION = "0.51.0";
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
const TIPTAP_COHORT_VERSION = "3.32.0";
/**
 * The Tiptap packages each manifest declares. The editor package holds the schema of
 * an assessment document, the design system holds the Memory editor, and the web app
 * declares `@tiptap/pm` alone. The backend declares the packages that its bundle imports
 * by name: the Convex bundle resolves each one from the backend, and pnpm does not link a
 * workspace package's dependencies into another workspace (ADR 0028).
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
    approved: "0.53.3",
    dependency: "@effect/tsgo",
    minimumDeclarations: 1,
  },
  {
    allowed: ["7.0.2", "catalog:", "npm:typescript@7.0.2"],
    dependency: "typescript",
    minimumDeclarations: 1,
  },
  { approved: "1.47.0", dependency: "convex", minimumDeclarations: 1 },
  { approved: "catalog:", dependency: "ai", minimumDeclarations: 1 },
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
    approved: "0.12.5",
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
  { approved: "8.0.1", dependency: "ultracite", minimumDeclarations: 1 },
  { approved: "2.11.8", dependency: "turbo", minimumDeclarations: 1 },
  {
    approved: "2.11.8",
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
  // The collab plugin that steps sync uses (ADR 0028). Tiptap 3.32.0 does not
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
  // 0028). They are the versions that `@tiptap/pm` 3.32.0 resolves in
  // `pnpm-lock.yaml`, so the server applies a step with the code the editors run.
  {
    approved: "1.25.12",
    declarationPaths: ["packages/backend/package.json"],
    dependency: "prosemirror-model",
  },
  {
    approved: "1.12.2",
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
    "12.1.0",
    "Mermaid 12 requires Safari 17.4 while Nakafa supports the Next.js Safari 16.4 browser floor.",
  ],
  [
    "effect@latest",
    EFFECT_COHORT_VERSION,
    "Signed content contracts move with the exact Effect cohort: @nakafa/aksara-contracts peers on one exact Effect version.",
  ],
  [
    "@effect/platform-browser@latest",
    EFFECT_COHORT_VERSION,
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node@latest",
    EFFECT_COHORT_VERSION,
    "The platform package must match the Effect cohort.",
  ],
  [
    "@effect/platform-node-shared@latest",
    EFFECT_COHORT_VERSION,
    "The transitive platform package must match the Effect cohort.",
  ],
  [
    "@effect/vitest@latest",
    EFFECT_COHORT_VERSION,
    "The test adapter must match the Effect cohort.",
  ],
  [
    "@effect/ai-openai-compat@latest",
    EFFECT_COHORT_VERSION,
    "The Confect server's transitive AI provider must match the Effect cohort.",
  ],
  [
    "@effect/ai-openrouter@latest",
    EFFECT_COHORT_VERSION,
    "The Confect server's transitive AI provider must match the Effect cohort.",
  ],
  [
    "@effect/tsgo@latest",
    "0.53.4",
    "Compiler patching moves with TypeScript and Effect. 0.49 migrates the compiler integrations to the current TypeScript path APIs, 0.50 adds the apiStabilityLeak diagnostic off by default (the maintainers preset only), 0.51 adds declaration locations to it, 0.52 adds schemaClassMissingBrand (default severity suggestion; base.json keeps it off until every Schema error class carries a brand, see docs/adr/0021-rules.md), effectSleepZeroToYieldNow and flatMapToTap (default severity suggestion; base.json sets error), and the opt-in preferEffectArray, preferEffectRecord, and preferSchemaTaggedError (default off). 0.53 adds errorPayloadShadowsName (default severity suggestion; base.json sets error) and the opt-in preferBarrelImport and preferNamespaceImport (default off). 0.53.3 makes effect-tsgo diagnostics report related locations. 0.53.4 only moves the TypeScript next tag, which Nakafa does not use, and Aksara's one-day release age admits it on 18 October 2026, so both repositories stay on 0.53.3 until then. Every rule is decided in packages/typescript-config/base.json.",
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
    CONTRACT_PACKAGE_VERSION,
    "Signed content contracts move with the exact Effect peer cohort.",
  ],
  ["typescript@latest", "7.0.2", "The native compiler is pinned exactly."],
  [
    "convex@latest",
    "1.47.0",
    "Convex 1.47 adds `.staged()` schema validation, `ctx.meta.getSnapshotTs()` and `getServiceUrl`, all additive. Its `convex deploy` asks before it creates or changes a non-staged index on a table of 100,000 documents or more, and a non-interactive deploy fails there unless `--skip-large-indexes-check` is passed, so a production build that adds such an index fails without that flag. Acceptance uses an isolated deployment.",
  ],
  [
    "ai@latest",
    "7.0.142",
    "AI SDK packages move as one reviewed cohort. 7.0.142 stays out: with it, `new Agent(...)` in confect/nina fails the backend typecheck with TS2590 (16 October 2026, with @convex-dev/agent 0.7.8 and with 0.7.7; 7.0.140 passes). Its release notes change the streamed input of OpenAI custom tools and the workflow telemetry context, and Nakafa uses neither.",
  ],
  [
    "@convex-dev/ai-sdk-provider@latest",
    AI_SDK_COHORT["@convex-dev/ai-sdk-provider"],
    "The Convex AI gateway provider moves with the AI SDK cohort; each bump rechecks the gateway module (confect/gateway).",
  ],
  [
    "better-auth@latest",
    "1.7.7",
    "@convex-dev/better-auth@0.12.5 declares the peer range >=1.6.11 <1.7.0, so runtime stays on the latest 1.6 patch (1.6.33) until the adapter opens 1.7. Its optional Vitest peer stops at 4, but only unused test-utils import Vitest; Nakafa auth runtime tests pass on 5.",
  ],
  [
    "@convex-dev/better-auth@latest",
    "0.12.5",
    "The adapter defines the accepted Better Auth peer range.",
  ],
  [
    "posthog-node@latest",
    "5.56.2",
    "posthog-node 5.56 imports @opentelemetry/api, an optional peer that is not installed, and Convex's bundler cannot resolve it. The PostHog Convex component therefore stays on 5.55.1 through the override for @posthog/convex in pnpm-workspace.yaml, and the analytics package keeps 5.56.2. Review this again when a posthog-node or @posthog/convex release bundles for Convex without the import.",
  ],
  ["@biomejs/biome@latest", "2.5.15", "Formatting is reviewed with Ultracite."],
  [
    "ultracite@latest",
    "8.0.1",
    "Ultracite 8 keeps the Biome presets. Its Biome core turns noForIn, noUndeclaredDependencies and three JSX rules into errors, and the repository passes them without code changes. Its ESLint, Oxlint and Zed changes do not apply to this Biome setup.",
  ],
  ["@types/node@24", "24.19.2", "Declarations remain on the Node 24 line."],
  ["node@24", "24.21.0", "The repository supports the Node 24 runtime line."],
  [
    "pnpm@latest",
    "12.10.1",
    "pnpm 12 records its own packages in a second YAML document at the top of the lockfile. OSV Scanner 2.6.0 reads both documents and Turborepo hashes each workspace as before, but GitHub's dependency graph reads only the first (dependabot/dependabot-core#15904), so it would report no application dependencies and close Aksara's Dependabot alerts. The one setting that keeps a single document, `pmOnFail: ignore`, also stops pnpm from enforcing the pinned version. pnpm 12 moves in both repositories once GitHub reads both documents.",
  ],
  [
    "react-doctor@latest",
    "0.9.18",
    "The local scanners move as one reviewed cohort. The doctor script installs only releases older than a day, so it takes a release once that release has settled. 0.9.18 narrows existing rules to reduce false positives and adds the opt-in --scope contextual mode, which this repository does not use.",
  ],
  [
    "turbo@latest",
    "2.11.8",
    "Turbo and its generator move together; 2.11 adds hash and scope-filtering performance work, 2.11.4 respects negated global dependencies in affected detection, and 2.11.8 hashes the Ruff and pytest configuration of the Python app and fixes affected listings, with no config change for this repository.",
  ],
  [
    "@react-three/fiber@latest",
    "9.8.2",
    "Fiber 9.8.2 accepts React 19.3 (its peer range is >=19 <19.4) and mounts a scene inside the React DOM commit that renders its canvas. Its 9.8.2 release notes keep pointer capture when an object's args change during a drag, request a frame when an object is removed with frameloop demand, fix the createPortal memory leaks with Activity, and make roots follow devicePixelRatio changes. Scene labels draw in one DOM overlay per canvas (components/three/overlay.tsx) and no longer use drei's Html, which created a second React root per label. That root's replacement during Fiber's mount cleared the first label of every scene and made a label's removal throw on lesson navigation (pmndrs/drei#2867). drei 10.7.9 peers Fiber ^9.0.0, which 9.8.2 satisfies. Fiber 10, still prerelease, removes THREE.Clock: its upgrade drops the Clock allowance in apps/www/e2e/scene/lines.browser.ts and rechecks SceneTime in packages/design-system/components/three/canvas.tsx, which relies on Fiber 9 restarting the clock on frameloop changes and on internal.frames.",
  ],
  [
    "afdocs@latest",
    "0.22.2",
    "AFDocs 0.21 adds the page-size-transfer check. A cached surah page serves 0.73 to 0.88 MB; its first render after a deploy or a publication also carries the stream Next.js embeds for Partial Prefetching and serves up to 1.24 MB, so agent-docs.config.yml sets the pass line at 1.5 MB. AFDocs 0.22 adds the markdown-link-portability check, which the agent Markdown passes because site paths are written as absolute URLs. That check sends its first requests right after three checks that only compute, and for 50 large pages they hold the event loop longer than the 5 seconds a Node server keeps an idle connection, so the checker reused connections that the local server had closed (fetch failed, ECONNRESET). The start script of apps/www therefore keeps idle connections for 70 seconds, as a production proxy does.",
  ],
];

export const SCRIPT_DEPENDENCY_HOLDS = [
  {
    // dlx honors the workspace's zero minimumReleaseAge, so React Doctor's
    // throwaway install took versions npm was still propagating: a 4-minute-old
    // electron-to-chromium tarball returned 404 and failed Doctor. The pnpm 11
    // default of one day keeps that install on settled releases.
    approved: "pnpm --config.minimum-release-age=1440 dlx react-doctor@0.9.18",
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
};
