import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { bumpDependencies } from "#scripts/dependencies/bump";
import {
  CONTRACT_VERSION,
  DEPENDENCY_HOLDS,
} from "#scripts/dependencies/policy";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

import {
  dependencyDeclarations,
  validateDependencyPolicy,
} from "#scripts/dependencies/validate";

const CONTRACT_MANIFEST_PATHS = [
  "apps/www/package.json",
  "packages/ai/package.json",
  "packages/backend/package.json",
  "packages/contents/package.json",
  "packages/internationalization/package.json",
] as const;

function validInput() {
  const dependencies = Object.fromEntries(
    DEPENDENCY_HOLDS.map((hold) => [
      hold.dependency,
      hold.approved ?? hold.allowed?.[0] ?? "missing",
    ])
  );
  const manifests = CONTRACT_MANIFEST_PATHS.map((path, index) => ({
    manifest: {
      dependencies:
        index === 0
          ? dependencies
          : { "@nakafa/aksara-contracts": CONTRACT_VERSION },
      scripts:
        index === 0 ? { doctor: "pnpm dlx react-doctor@0.9.12" } : undefined,
    },
    path,
  }));
  const ignoreDeps = [
    ...new Set([
      ...DEPENDENCY_HOLDS.map(({ dependency }) => dependency),
      "node",
      "pnpm",
    ]),
  ].sort();
  return {
    manifests,
    rootManifest: {
      devEngines: { runtime: { version: "24.19.0" } },
      packageManager: "pnpm@11.23.0",
    },
    workspace: {
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
    input.workspace.overrides["@effect/platform-node-shared"] = "4.0.0-rc.111";
    input.workspace.update.ignoreDeps = [];

    const problems = validateDependencyPolicy(input);
    expect(
      problems.some((problem) => problem.includes("approved catalog:"))
    ).toBe(true);
    expect(
      problems.some((problem) => problem.includes("declarations are"))
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
