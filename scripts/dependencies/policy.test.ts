import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { bumpDependencies } from "./bump.ts";
import {
  CONTRACT_ARCHIVE,
  DEPENDENCY_HOLDS,
  DEPENDENCY_RELEASE_AGE_EXCLUSIONS,
  DEPENDENCY_RELEASE_AGE_MINUTES,
  LEGACY_QURAN_CONTRACT_ARCHIVE,
  TEMPORARY_DEPENDENCY_HOLDS,
} from "./policy.ts";
import { inspectDependencyPolicy } from "./source.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

import {
  dependencyDeclarations,
  validateDependencyPolicy,
} from "./validate.ts";

function fixtureManifestPath(index: number) {
  if (index === 0) {
    return "apps/www/package.json";
  }
  if (index === 1) {
    return "packages/backend/package.json";
  }
  return `packages/example-${index}/package.json`;
}

function validInput() {
  const dependencies = Object.fromEntries(
    DEPENDENCY_HOLDS.map((hold) => [
      hold.dependency,
      hold.approved ?? hold.allowed?.[0] ?? "missing",
    ])
  );
  const manifests = Array.from({ length: 6 }, (_, index) => ({
    manifest: {
      dependencies:
        index === 0
          ? dependencies
          : {
              "@nakafa/aksara-contracts": CONTRACT_ARCHIVE,
              ...(index === 1
                ? { "@nakafa/aksara-v151": LEGACY_QURAN_CONTRACT_ARCHIVE }
                : {}),
            },
      scripts:
        index === 0 ? { doctor: "pnpm dlx react-doctor@0.9.12" } : undefined,
    },
    path: fixtureManifestPath(index),
  }));
  const ignoreDeps = [
    ...new Set([
      ...DEPENDENCY_HOLDS.map(({ dependency }) => dependency),
      "node",
      "pnpm",
    ]),
  ].sort();
  const policyFiles = new Map<string, string>();
  for (const hold of TEMPORARY_DEPENDENCY_HOLDS) {
    for (const target of hold.cleanup) {
      const separator = target.indexOf("#");
      const path = separator === -1 ? target : target.slice(0, separator);
      const marker = separator === -1 ? "" : target.slice(separator + 1);
      policyFiles.set(path, `${policyFiles.get(path) ?? ""}\n${marker}`);
    }
    for (const consumer of hold.consumers) {
      policyFiles.set(
        consumer,
        `${policyFiles.get(consumer) ?? ""}\nimport "${hold.dependency}/fixture";`
      );
    }
  }

  return {
    files: [...policyFiles].map(([path, source]) => ({ path, source })),
    manifests,
    rootManifest: {
      devEngines: { runtime: { version: "24.19.0" } },
      packageManager: "pnpm@11.23.0",
    },
    workspace: {
      minimumReleaseAge: DEPENDENCY_RELEASE_AGE_MINUTES,
      minimumReleaseAgeExclude: [...DEPENDENCY_RELEASE_AGE_EXCLUSIONS],
      minimumReleaseAgeStrict: true,
      catalog: {
        "@effect/platform-node": "4.0.0-rc.110",
        "@effect/vitest": "4.0.0-rc.110",
        effect: "4.0.0-rc.110",
        typescript: "npm:@typescript/typescript6@6.0.2",
      },
      overrides: {
        "@effect/platform-node-shared": "4.0.0-rc.110",
      },
      update: { ignoreDeps },
    },
  };
}

describe("dependency policy", () => {
  it.effect("accepts the actual repository dependency policy", () =>
    Effect.gen(function* () {
      const problems = yield* inspectDependencyPolicy(REPOSITORY_ROOT).pipe(
        Effect.provide(NodeServices.layer)
      );
      expect(problems).toEqual([]);
    })
  );

  it("accepts every reviewed dependency cohort", () => {
    expect(validateDependencyPolicy(validInput())).toEqual([]);
  });

  it("restricts the temporary Quran rollback decoder to its owned seam", () => {
    expect(TEMPORARY_DEPENDENCY_HOLDS).toEqual([
      expect.objectContaining({
        approved: LEGACY_QURAN_CONTRACT_ARCHIVE,
        dependency: "@nakafa/aksara-v151",
        group: "dependencies",
        manifestPath: "packages/backend/package.json",
        owner: "Quran content release",
      }),
    ]);

    const input = validInput();
    const firstManifest = input.manifests[0];
    expect(firstManifest).toBeDefined();
    if (!firstManifest) {
      return;
    }
    firstManifest.manifest.dependencies["@nakafa/aksara-v151"] =
      LEGACY_QURAN_CONTRACT_ARCHIVE;

    const problems = validateDependencyPolicy(input);
    expect(
      problems.some((problem) =>
        problem.includes("expected exactly one temporary declaration")
      )
    ).toBe(true);
    expect(problems.some((problem) => problem.includes("approved"))).toBe(true);
  });

  it("rejects temporary dependency consumers and cleanup targets that drift", () => {
    const input = validInput();
    input.files.push({
      path: "packages/example/escape.ts",
      source: 'import "@nakafa/aksara-v151/quran/spec";',
    });
    const cleanupFile = input.files.find(
      ({ path }) => path === "packages/backend/client/quran/source.ts"
    );
    expect(cleanupFile).toBeDefined();
    if (cleanupFile) {
      cleanupFile.source = "cleanup marker removed";
    }

    const problems = validateDependencyPolicy(input);
    expect(problems.some((problem) => problem.includes("consumers are"))).toBe(
      true
    );
    expect(
      problems.some((problem) =>
        problem.includes("no longer contains tafsirAccess === null")
      )
    ).toBe(true);
  });

  it.effect("rejects unsafe policy before running pnpm update", () =>
    Effect.gen(function* () {
      const commands: string[][] = [];
      const errors: string[] = [];
      const status = yield* bumpDependencies({
        root: process.cwd(),
        inspectPolicy: () => Effect.succeed(["unsafe dependency policy"]),
        run: (_root, args) =>
          Effect.sync(() => {
            commands.push([...args]);
            return { exitCode: 0, stderr: "", stdout: "" };
          }),
        writeError: (value) =>
          Effect.sync(() => {
            errors.push(value);
          }),
        writeOutput: () => Effect.void,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer)
        )
      );

      expect(status).toBe(1);
      expect(commands).toEqual([]);
      expect(errors).toEqual(["unsafe dependency policy\n"]);
    })
  );

  it("reports drift, missing consumers, and obsolete Effect packages", () => {
    const input = validInput();
    const firstManifest = input.manifests[0];
    expect(firstManifest).toBeDefined();
    if (!firstManifest) {
      return;
    }
    firstManifest.manifest.dependencies.effect = "4.0.0-rc.111";
    firstManifest.manifest.dependencies["@effect/platform"] = "0.97.1";
    if (firstManifest.manifest.scripts) {
      firstManifest.manifest.scripts.doctor = "pnpm dlx react-doctor@0.9.5";
    }
    input.manifests.splice(1);
    input.workspace.minimumReleaseAge = 0;
    input.workspace.minimumReleaseAgeExclude = [
      ...DEPENDENCY_RELEASE_AGE_EXCLUSIONS,
      "effect",
    ];
    input.workspace.minimumReleaseAgeStrict = false;
    input.workspace.overrides["@effect/platform-node-shared"] = "4.0.0-rc.111";
    input.workspace.update.ignoreDeps = [];

    const problems = validateDependencyPolicy(input);
    expect(
      problems.some((problem) => problem.includes("approved catalog:"))
    ).toBe(true);
    expect(
      problems.some((problem) => problem.includes("expected at least 6"))
    ).toBe(true);
    expect(
      problems.some((problem) => problem.includes("obsolete Effect"))
    ).toBe(true);
    expect(
      problems.some((problem) => problem.includes("platform-node-shared"))
    ).toBe(true);
    expect(problems.some((problem) => problem.includes("react-doctor"))).toBe(
      true
    );
    expect(
      problems.some((problem) => problem.includes("update.ignoreDeps"))
    ).toBe(true);
    expect(problems.some((problem) => problem.includes("1440 minutes"))).toBe(
      true
    );
    expect(
      problems.some((problem) => problem.includes("minimumReleaseAgeExclude"))
    ).toBe(true);
    expect(problems.some((problem) => problem.includes("remain strict"))).toBe(
      true
    );
  });

  it("finds declarations in every dependency group", () => {
    const declarations = dependencyDeclarations(
      [
        {
          manifest: {
            dependencies: { effect: "catalog:" },
            peerDependencies: { effect: "4.0.0-rc.110" },
          },
          path: "package.json",
        },
      ],
      "effect"
    );

    expect(declarations.map(({ group }) => group)).toEqual([
      "dependencies",
      "peerDependencies",
    ]);
  });
});
