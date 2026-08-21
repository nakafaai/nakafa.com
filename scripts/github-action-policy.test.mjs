import assert from "node:assert/strict";
import test from "node:test";

import {
  GITHUB_ACTION_REVIEWS,
  inspectGithubActionPolicy,
  latestStableVTag,
  validateGithubActionPolicy,
} from "./github-action-policy.mjs";

function validActionUses() {
  return GITHUB_ACTION_REVIEWS.flatMap((review) =>
    Array.from({ length: review.expectedUsages }, (_, index) => ({
      inputs: review.expectedInputs ?? {},
      reference: `${review.action}@${review.approvedSha}`,
      workflowPath: `.github/workflows/example-${index}.yml`,
    }))
  );
}

test("accepts every reviewed immutable GitHub Action", () => {
  assert.deepEqual(validateGithubActionPolicy(validActionUses()), []);
  assert.deepEqual(inspectGithubActionPolicy(process.cwd()), []);
});

test("reports mutable, unreviewed, missing, and misconfigured actions", () => {
  const actionUses = validActionUses();
  actionUses[0].reference = "actions/checkout@v7";
  actionUses.push({
    inputs: {},
    reference: "example/unreviewed@0123456789abcdef",
    workflowPath: ".github/workflows/example.yml",
  });

  const doctorIndex = actionUses.findIndex(({ reference }) =>
    reference.startsWith("millionco/react-doctor@")
  );
  actionUses[doctorIndex].inputs = { version: "latest" };

  const setupIndex = actionUses.findIndex(({ reference }) =>
    reference.startsWith("pnpm/setup@")
  );
  actionUses.splice(setupIndex, 1);

  const problems = validateGithubActionPolicy(actionUses);
  assert.ok(problems.some((problem) => problem.includes("approved")));
  assert.ok(problems.some((problem) => problem.includes("unreviewed")));
  assert.ok(problems.some((problem) => problem.includes("version")));
  assert.ok(problems.some((problem) => problem.includes("expected 2")));
});

test("selects only the newest stable action tag", () => {
  assert.equal(
    latestStableVTag([
      "v2",
      "v2.2.8",
      "v2.3.0-beta.1",
      "react-doctor@0.9.12",
      "v10.0.1",
      "v9.12.4",
    ]),
    "v10.0.1"
  );
});
