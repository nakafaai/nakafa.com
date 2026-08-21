import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTRACT_ARCHIVE,
  DEPENDENCY_HOLDS,
  dependencyDeclarations,
  validateDependencyPolicy,
} from "./dependency-policy.mjs";

function validInput() {
  const dependencies = Object.fromEntries(
    DEPENDENCY_HOLDS.map((hold) => [
      hold.dependency,
      hold.approved ?? hold.allowed[0],
    ])
  );
  const manifests = Array.from({ length: 6 }, (_, index) => ({
    manifest: {
      dependencies:
        index === 0
          ? dependencies
          : { "@nakafa/aksara-contracts": CONTRACT_ARCHIVE },
    },
    path: `packages/example-${index}/package.json`,
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
      packageManager: "pnpm@11.22.0",
    },
    workspace: {
      catalog: {
        "@effect/platform-node": "4.0.0-rc.110",
        "@effect/vitest": "4.0.0-rc.110",
        effect: "4.0.0-rc.110",
        typescript: "npm:@typescript/typescript6@6.0.2",
      },
      update: { ignoreDeps },
    },
  };
}

test("accepts every reviewed dependency cohort", () => {
  assert.deepEqual(validateDependencyPolicy(validInput()), []);
});

test("reports drift, missing consumers, and obsolete Effect packages", () => {
  const input = validInput();
  input.manifests[0].manifest.dependencies.effect = "4.0.0-rc.111";
  input.manifests[0].manifest.dependencies["@effect/platform"] = "0.97.1";
  input.manifests.splice(1);
  input.workspace.update.ignoreDeps = [];

  const problems = validateDependencyPolicy(input);
  assert.ok(problems.some((problem) => problem.includes("approved catalog:")));
  assert.ok(
    problems.some((problem) => problem.includes("expected at least 6"))
  );
  assert.ok(problems.some((problem) => problem.includes("obsolete Effect")));
  assert.ok(problems.some((problem) => problem.includes("update.ignoreDeps")));
});

test("finds declarations in every dependency group", () => {
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

  assert.deepEqual(
    declarations.map(({ group }) => group),
    ["dependencies", "peerDependencies"]
  );
});
