import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Option, Record as Rec } from "effect";
import {
  AI_SDK_COHORT,
  DEPENDENCY_HOLDS,
  EFFECT_COHORT_OVERRIDES,
  EFFECT_COHORT_VERSION,
  PACKAGE_MANAGER,
  VITEST_COHORT_VERSION,
} from "#scripts/dependencies/policy";
import {
  dependencyDeclarations,
  validateDependencyPolicy,
} from "#scripts/dependencies/validate";

const CONTRACT_MANIFEST_PATHS = [
  "apps/www/package.json",
  "packages/backend/package.json",
  "packages/contents/package.json",
  "packages/email/package.json",
  "packages/internationalization/package.json",
  "packages/seo/package.json",
] as const;
const CONTRACT_OWNERS = Arr.join(CONTRACT_MANIFEST_PATHS, ", ");
const WEB_MANIFEST = "apps/www/package.json";
/** Every manifest the fixture builds: the contract owners, the design system that holds collab, and the editor package. */
const FIXTURE_MANIFEST_PATHS = [
  ...CONTRACT_MANIFEST_PATHS,
  "packages/design-system/package.json",
  "packages/editor/package.json",
];

type PolicyInput = Parameters<typeof validateDependencyPolicy>[0];
type Manifest = PolicyInput["manifests"][number]["manifest"];

/** Returns the reviewed spec of one exact hold. */
function approvedSpec(dependency: string) {
  const hold = Option.getOrUndefined(
    Arr.findFirst(
      DEPENDENCY_HOLDS,
      (candidate) => candidate.dependency === dependency
    )
  );
  return hold !== undefined && "approved" in hold ? hold.approved : "";
}

/** Builds manifests and workspace settings that satisfy every reviewed hold. */
function validInput(): PolicyInput {
  const manifests = Arr.map(FIXTURE_MANIFEST_PATHS, (path, index) => ({
    manifest: {
      dependencies: Rec.fromEntries(
        Arr.map(
          Arr.filter(DEPENDENCY_HOLDS, (hold) =>
            "declarationPaths" in hold
              ? Arr.contains(hold.declarationPaths, path)
              : index === 0
          ),
          (hold) => [
            hold.dependency,
            "approved" in hold ? hold.approved : hold.allowed[0],
          ]
        )
      ),
      scripts:
        index === 0
          ? {
              doctor: "bunx --minimum-release-age 86400 react-doctor@0.9.18",
            }
          : undefined,
    },
    path,
  }));
  return {
    lock: "",
    manifests,
    rootManifest: {
      devEngines: { runtime: { version: "24.22.1" } },
      packageManager: PACKAGE_MANAGER,
    },
    workspace: {
      catalog: {
        ...AI_SDK_COHORT,
        "@effect/platform-node": EFFECT_COHORT_VERSION,
        "@effect/vitest": EFFECT_COHORT_VERSION,
        "@vitest/coverage-istanbul": VITEST_COHORT_VERSION,
        "@vitest/ui": VITEST_COHORT_VERSION,
        effect: EFFECT_COHORT_VERSION,
        typescript: "7.0.2",
        vitest: VITEST_COHORT_VERSION,
      },
      overrides: {
        "@effect/ai-openai-compat": EFFECT_COHORT_VERSION,
        "@effect/ai-openrouter": EFFECT_COHORT_VERSION,
        "@effect/platform-node": EFFECT_COHORT_VERSION,
        "@effect/platform-node-shared": EFFECT_COHORT_VERSION,
      },
    },
  };
}

/** Replaces the web manifest, which owns every single-consumer hold. */
function updateWebManifest(
  input: PolicyInput,
  update: (manifest: Manifest) => Manifest
): PolicyInput {
  return {
    ...input,
    manifests: Arr.map(input.manifests, (entry) =>
      entry.path === WEB_MANIFEST
        ? { ...entry, manifest: update(entry.manifest) }
        : entry
    ),
  };
}

/** Removes one dependency from every manifest. */
function withoutDependency(input: PolicyInput, dependency: string) {
  return {
    ...input,
    manifests: Arr.map(input.manifests, ({ manifest, path }) => ({
      manifest: {
        ...manifest,
        dependencies: Rec.fromEntries(
          Arr.filter(
            Rec.toEntries(manifest.dependencies ?? {}),
            ([name]) => name !== dependency
          )
        ),
      },
      path,
    })),
  };
}

describe("dependency policy validation", () => {
  it("accepts every reviewed dependency cohort", () => {
    assert.deepStrictEqual(validateDependencyPolicy(validInput()), []);
  });

  it("refuses a lock that resolves a retired package", () => {
    const peerOnly = `{
  "packages": {
    "convex-helpers": ["convex-helpers@0.1.129", "", { "peerDependencies": { "hono": "^4.0.5" }, "optionalPeers": ["hono"] }, "sha512-a"],
  }
}`;
    const resolved = `{
  "packages": {
    "hono": ["hono@4.13.13", "", {}, "sha512-b"],
  }
}`;
    assert.deepStrictEqual(
      validateDependencyPolicy({ ...validInput(), lock: peerOnly }),
      []
    );
    assert.deepStrictEqual(
      validateDependencyPolicy({ ...validInput(), lock: resolved }),
      [
        "bun.lock resolves the retired package hono; the Confect router with Effect HttpApi (ADR 0029) replaces it.",
      ]
    );
  });

  it("finds declarations in every dependency group", () => {
    const declarations = dependencyDeclarations(
      [
        {
          manifest: {
            dependencies: { effect: "catalog:" },
            devDependencies: { effect: "catalog:" },
            optionalDependencies: { effect: "catalog:" },
            peerDependencies: { effect: "4.0.0-rc.115" },
          },
          path: "package.json",
        },
      ],
      "effect"
    );

    assert.deepStrictEqual(
      Arr.map(declarations, ({ group }) => group),
      [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
      ]
    );
  });

  it.each<{
    readonly change: (input: PolicyInput) => PolicyInput;
    readonly name: string;
    readonly problem: string;
  }>([
    {
      name: "a contract consumer outside the reviewed owners",
      change: (input) => ({
        ...input,
        manifests: [
          ...input.manifests,
          {
            manifest: {
              dependencies: {
                "@nakafa/aksara-contracts": approvedSpec(
                  "@nakafa/aksara-contracts"
                ),
              },
            },
            path: "packages/cli/package.json",
          },
        ],
      }),
      problem:
        "@nakafa/aksara-contracts declarations are apps/www/package.json, packages/backend/package.json, packages/cli/package.json, packages/contents/package.json, packages/email/package.json, packages/internationalization/package.json, packages/seo/package.json; " +
        `expected ${CONTRACT_OWNERS}.`,
    },
    {
      name: "missing contract consumers",
      change: (input) => withoutDependency(input, "@nakafa/aksara-contracts"),
      problem: `@nakafa/aksara-contracts declarations are missing; expected ${CONTRACT_OWNERS}.`,
    },
    {
      name: "a missing held dependency",
      change: (input) => withoutDependency(input, "react"),
      problem: "react has 0 declarations; expected at least 1.",
    },
    {
      name: "an obsolete Next package",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          dependencies: { ...manifest.dependencies, next: "0.0.0" },
        })),
      problem:
        "apps/www/package.json declares the obsolete dependency next; use TanStack Start and TanStack Router, which the www app runs on.",
    },
    {
      name: "a spec outside the allowed list",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          dependencies: { ...manifest.dependencies, typescript: "^7.0.0" },
        })),
      problem:
        "apps/www/package.json declares typescript as ^7.0.0; approved 7.0.2 or catalog: or npm:typescript@7.0.2.",
    },
    {
      name: "an obsolete Effect package",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          devDependencies: { "@effect/platform": "0.97.1" },
        })),
      problem:
        "apps/www/package.json declares the obsolete dependency @effect/platform; use the matching module of effect.",
    },
    {
      name: "date-fns, which Intl and DateTime replace",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          dependencies: { ...manifest.dependencies, "date-fns": "4.4.0" },
        })),
      problem:
        "apps/www/package.json declares the obsolete dependency date-fns; use Intl.DateTimeFormat and Intl.RelativeTimeFormat with DateTime and Duration from effect, as apps/www/src/lib/i18n/date.ts does.",
    },
    {
      name: "nanoid, which randomUuid replaces",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          devDependencies: { nanoid: "^6.0.2" },
        })),
      problem:
        "apps/www/package.json declares the obsolete dependency nanoid; use randomUuid from @repo/utilities/uuid.",
    },
    {
      name: "a drifted reviewed script",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          scripts: { doctor: "bunx react-doctor@0.9.5" },
        })),
      problem:
        "apps/www/package.json script doctor is bunx react-doctor@0.9.5; approved bunx --minimum-release-age 86400 react-doctor@0.9.18.",
    },
    {
      name: "a missing reviewed script",
      change: (input) =>
        updateWebManifest(input, (manifest) => ({
          ...manifest,
          scripts: undefined,
        })),
      problem:
        "apps/www/package.json script doctor is missing; approved bunx --minimum-release-age 86400 react-doctor@0.9.18.",
    },
    {
      name: "an Effect catalog drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: { ...input.workspace.catalog, effect: "4.0.0-rc.116" },
        },
      }),
      problem: `The Effect catalog must be exactly ${EFFECT_COHORT_VERSION}.`,
    },
    {
      name: "a platform-node catalog drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: {
            ...input.workspace.catalog,
            "@effect/platform-node": "4.0.0-rc.116",
          },
        },
      }),
      problem: `The platform-node catalog must match Effect ${EFFECT_COHORT_VERSION}.`,
    },
    {
      name: "an Effect Vitest catalog drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: {
            ...input.workspace.catalog,
            "@effect/vitest": "4.0.0-rc.116",
          },
        },
      }),
      problem: `The Effect Vitest catalog must match Effect ${EFFECT_COHORT_VERSION}.`,
    },
    ...Arr.map(EFFECT_COHORT_OVERRIDES, (dependency) => ({
      name: `a ${dependency} override drift`,
      change: (input: PolicyInput) => ({
        ...input,
        workspace: {
          ...input.workspace,
          overrides: {
            ...input.workspace.overrides,
            [dependency]: "4.0.0-rc.110",
          },
        },
      }),
      problem: `The ${dependency} override must match Effect ${EFFECT_COHORT_VERSION}.`,
    })),
    {
      name: "a TypeScript catalog drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: { ...input.workspace.catalog, typescript: "7.0.1" },
        },
      }),
      problem: "The native TypeScript catalog must be exactly 7.0.2.",
    },
    {
      name: "a Vitest cohort drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: { ...input.workspace.catalog, "@vitest/ui": "5.0.0" },
        },
      }),
      problem: `@vitest/ui must match the supported Vitest ${VITEST_COHORT_VERSION} cohort.`,
    },
    {
      name: "an AI SDK cohort drift",
      change: (input) => ({
        ...input,
        workspace: {
          ...input.workspace,
          catalog: {
            ...input.workspace.catalog,
            "@convex-dev/ai-sdk-provider": "0.2.0",
          },
        },
      }),
      problem: `The @convex-dev/ai-sdk-provider catalog must be exactly ${AI_SDK_COHORT["@convex-dev/ai-sdk-provider"]}.`,
    },
    {
      name: "a package manager drift",
      change: (input) => ({
        ...input,
        rootManifest: { ...input.rootManifest, packageManager: "pnpm@11.26.0" },
      }),
      problem: `packageManager must be ${PACKAGE_MANAGER}.`,
    },
    {
      name: "a Node runtime drift",
      change: (input) => ({
        ...input,
        rootManifest: {
          ...input.rootManifest,
          devEngines: { runtime: { version: "24.20.0" } },
        },
      }),
      problem: "The managed Node runtime must be 24.22.1.",
    },
  ])("reports $name", ({ change, problem }) => {
    assert.deepStrictEqual(validateDependencyPolicy(change(validInput())), [
      problem,
    ]);
  });
});
