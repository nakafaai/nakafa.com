import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLatestGithubActionTag,
  GITHUB_ACTION_REVIEWS,
  inspectGithubActionPolicy,
  latestStableVTag,
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

test("reads release and stable-tag metadata from GitHub", async () => {
  const releaseTag = await fetchLatestGithubActionTag(
    {
      latestTagSource: "release",
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

  const stableTag = await fetchLatestGithubActionTag(
    {
      latestTagSource: "stable-v-tags",
      repository: "millionco/react-doctor",
    },
    {
      fetchImplementation: (url) => {
        assert.equal(
          url,
          "https://api.github.com/repos/millionco/react-doctor/git/matching-refs/tags/v?per_page=100&page=1"
        );
        return {
          json: () => [
            { ref: "refs/tags/v2" },
            { ref: "refs/tags/v2.2.8" },
            { ref: "refs/tags/v2.3.0-beta.1" },
          ],
          ok: true,
        };
      },
    }
  );
  assert.equal(stableTag, "v2.2.8");
});

test("rejects unavailable GitHub release metadata", async () => {
  await assert.rejects(
    fetchLatestGithubActionTag(
      {
        latestTagSource: "release",
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
