import assert from "node:assert/strict";
import test from "node:test";

import { bumpDependencies } from "./bump-deps.mjs";
import {
  CONTRACT_ARCHIVE,
  DEPENDENCY_HOLDS,
  DEPENDENCY_RELEASE_AGE_EXCLUSIONS,
  DEPENDENCY_RELEASE_AGE_MINUTES,
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
      scripts:
        index === 0 ? { doctor: "pnpm dlx react-doctor@0.9.12" } : undefined,
    },
    path:
      index === 0
        ? "apps/www/package.json"
        : `packages/example-${index}/package.json`,
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

test("accepts every reviewed dependency cohort", () => {
  assert.deepEqual(validateDependencyPolicy(validInput()), []);
});

test("rejects unsafe policy before running pnpm update", async () => {
  const commands = [];
  const errors = [];
  const status = await bumpDependencies({
    inspectPolicy: () => ["unsafe dependency policy"],
    run: (_root, args) => {
      commands.push(args);
      return { status: 0 };
    },
    writeError: (value) => errors.push(value),
    writeOutput: () => undefined,
  });

  assert.equal(status, 1);
  assert.deepEqual(commands, []);
  assert.deepEqual(errors, ["unsafe dependency policy\n"]);
});

test("reports drift, missing consumers, and obsolete Effect packages", () => {
  const input = validInput();
  input.manifests[0].manifest.dependencies.effect = "4.0.0-rc.111";
  input.manifests[0].manifest.dependencies["@effect/platform"] = "0.97.1";
  input.manifests[0].manifest.scripts.doctor = "pnpm dlx react-doctor@0.9.5";
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
  assert.ok(problems.some((problem) => problem.includes("approved catalog:")));
  assert.ok(
    problems.some((problem) => problem.includes("expected at least 6"))
  );
  assert.ok(problems.some((problem) => problem.includes("obsolete Effect")));
  assert.ok(
    problems.some((problem) => problem.includes("platform-node-shared"))
  );
  assert.ok(problems.some((problem) => problem.includes("react-doctor")));
  assert.ok(problems.some((problem) => problem.includes("update.ignoreDeps")));
  assert.ok(problems.some((problem) => problem.includes("1440 minutes")));
  assert.ok(
    problems.some((problem) => problem.includes("minimumReleaseAgeExclude"))
  );
  assert.ok(problems.some((problem) => problem.includes("remain strict")));
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
