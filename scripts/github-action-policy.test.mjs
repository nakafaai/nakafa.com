import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLatestGithubActionTag,
  GITHUB_ACTION_REVIEWS,
  inspectGithubActionPolicy,
  validateGithubActionPolicy,
} from "./github-action-policy.mjs";

const GITHUB_FORBIDDEN_ERROR_PATTERN = /GitHub returned 403/u;

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

  const setupIndex = actionUses.findIndex(({ reference }) =>
    reference.startsWith("pnpm/setup@")
  );
  actionUses[setupIndex].inputs = { cache: false, install: false };
  actionUses.splice(setupIndex + 1, 1);

  const problems = validateGithubActionPolicy(actionUses);
  assert.ok(problems.some((problem) => problem.includes("approved")));
  assert.ok(problems.some((problem) => problem.includes("unreviewed")));
  assert.ok(problems.some((problem) => problem.includes("cache")));
  assert.ok(problems.some((problem) => problem.includes("expected 3")));
});

test("reads release metadata from GitHub", async () => {
  const releaseTag = await fetchLatestGithubActionTag(
    {
      repository: "actions/checkout",
    },
    {
      fetchImplementation: (url) => {
        assert.equal(
          url,
          "https://api.github.com/repos/actions/checkout/releases/latest"
        );
        return {
          json: () => ({ tag_name: "v7.0.1" }),
          ok: true,
        };
      },
    }
  );
  assert.equal(releaseTag, "v7.0.1");
});

test("rejects unavailable GitHub release metadata", async () => {
  await assert.rejects(
    fetchLatestGithubActionTag(
      {
        repository: "actions/checkout",
      },
      {
        fetchImplementation: () => ({
          json: () => ({}),
          ok: false,
          status: 403,
        }),
      }
    ),
    GITHUB_FORBIDDEN_ERROR_PATTERN
  );
});
