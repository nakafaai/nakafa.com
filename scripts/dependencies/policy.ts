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
 * Seven transitive overrides in the root `package.json` hold a version for a reason
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
 * needs ^0.1.94, so one copy satisfies every range. `lodash` 4.18.1 replaces the
 * 4.17.21 that chevrotain 10.5.0 pins exactly, which GHSA-f23m-r3pf-42rh,
 * GHSA-r5fr-rjxr-66jc and GHSA-xxjr-mmjv-4gpg affect: Better Auth 1.6's `auth` reaches it
 * through @mrleebo/prisma-ast ^0.13.1, and `auth` 1.7 moves to prisma-ast ^0.16 on
 * chevrotain 12. KaTeX 0.19.1 is the one copy for mermaid 11.17.2 (^0.16.47) and
 * micromark-extension-math 3.1.0 (^0.16.0, its latest release) beside the design
 * system's own: every 0.16 release is affected by GHSA-238p-pmpm-9mq7, which 0.18.2
 * fixes. The other transitive versions come from their dependents' own ranges.
 */
export const DEPENDENCY_HOLDS: readonly DependencyHold[] = [
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
