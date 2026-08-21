import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";

const WORKFLOW_FILE_PATTERN = /\.ya?ml$/u;

export const GITHUB_ACTION_REVIEWS = [
  {
    action: "actions/checkout",
    approvedSha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
    expectedTag: "v7.0.1",
    expectedUsages: 3,
    reason: "Checkout is pinned to the latest reviewed stable release.",
  },
  {
    action: "pnpm/setup",
    approvedSha: "84cb39b217b10273981911c288cd62326dc7c6d2",
    expectedInputs: { cache: "true", install: "false" },
    expectedTag: "v2.0.2",
    expectedUsages: 3,
    reason:
      "The signed successor action owns Node, pnpm, and dependency caching.",
  },
  {
    action: "changesets/action",
    approvedSha: "8488615a623b1b9c987934bb89eae8af6a946ac1",
    expectedTag: "v2.1.1",
    expectedUsages: 1,
    reason: "The v2 release API and renamed inputs are migrated together.",
  },
  {
    action: "astral-sh/setup-uv",
    approvedSha: "20cfd1bf945f4377ade1205e4dbc17946fc9a30d",
    expectedTag: "v10.0.1",
    expectedUsages: 1,
    reason:
      "uv setup retains explicit trusted-event caching on the reviewed release.",
  },
  {
    action: "actions/cache/restore",
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedTag: "v6.1.0",
    expectedUsages: 1,
    reason: "The cache restore and save actions move as one cohort.",
  },
  {
    action: "actions/cache/save",
    approvedSha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9",
    expectedTag: "v6.1.0",
    expectedUsages: 1,
    reason: "The cache restore and save actions move as one cohort.",
  },
];

function collectActionUses(value, workflowPath, uses) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectActionUses(item, workflowPath, uses);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  if (typeof value.uses === "string") {
    uses.push({
      inputs: value.with && typeof value.with === "object" ? value.with : {},
      reference: value.uses,
      workflowPath,
    });
  }

  for (const child of Object.values(value)) {
    collectActionUses(child, workflowPath, uses);
  }
}

function parseActionReference(reference) {
  const separator = reference.lastIndexOf("@");
  if (separator <= 0 || separator === reference.length - 1) {
    return;
  }

  return {
    action: reference.slice(0, separator),
    revision: reference.slice(separator + 1),
  };
}

/** Reads every external action used by first-party GitHub workflows. */
export function readWorkflowActionUses(root) {
  const workflowRoot = path.join(root, ".github", "workflows");
  const uses = [];

  const workflowFiles = readdirSync(workflowRoot)
    .filter((fileName) => WORKFLOW_FILE_PATTERN.test(fileName))
    .sort();

  for (const fileName of workflowFiles) {
    const workflowPath = path.join(".github", "workflows", fileName);
    const workflow = parse(readFileSync(path.join(root, workflowPath), "utf8"));
    collectActionUses(workflow, workflowPath, uses);
  }

  return uses.filter(({ reference }) => !reference.startsWith("./"));
}

/** Validates immutable revisions, expected inputs, and complete action coverage. */
export function validateGithubActionPolicy(actionUses) {
  const problems = [];
  const reviews = new Map(
    GITHUB_ACTION_REVIEWS.map((review) => [review.action, review])
  );
  const usageCounts = new Map();

  for (const use of actionUses) {
    const parsed = parseActionReference(use.reference);
    if (!parsed) {
      problems.push(
        `${use.workflowPath} has an unpinned external action ${use.reference}.`
      );
      continue;
    }

    const review = reviews.get(parsed.action);
    if (!review) {
      problems.push(
        `${use.workflowPath} uses unreviewed GitHub Action ${parsed.action}.`
      );
      continue;
    }

    usageCounts.set(parsed.action, (usageCounts.get(parsed.action) ?? 0) + 1);
    if (parsed.revision !== review.approvedSha) {
      problems.push(
        `${use.workflowPath} pins ${parsed.action} to ${parsed.revision}; approved ${review.approvedSha}.`
      );
    }

    for (const [input, expected] of Object.entries(
      review.expectedInputs ?? {}
    )) {
      if (String(use.inputs[input] ?? "") !== expected) {
        problems.push(
          `${use.workflowPath} configures ${parsed.action} ${input} as ${String(use.inputs[input] ?? "missing")}; approved ${expected}.`
        );
      }
    }
  }

  for (const review of GITHUB_ACTION_REVIEWS) {
    const actualUsages = usageCounts.get(review.action) ?? 0;
    if (actualUsages !== review.expectedUsages) {
      problems.push(
        `${review.action} has ${actualUsages} workflow usages; expected ${review.expectedUsages}.`
      );
    }
  }

  return problems;
}

/** Reads and validates the repository GitHub Action policy. */
export function inspectGithubActionPolicy(root) {
  try {
    return validateGithubActionPolicy(readWorkflowActionUses(root));
  } catch (error) {
    return [
      error instanceof Error
        ? `Unable to inspect GitHub Actions: ${error.message}`
        : "Unable to inspect GitHub Actions.",
    ];
  }
}

function actionRepository(action) {
  return action.split("/").slice(0, 2).join("/");
}

/** Returns one consistent latest-release review for each upstream repository. */
export function githubActionReleaseReviews() {
  const reviews = new Map();

  for (const actionReview of GITHUB_ACTION_REVIEWS) {
    const repository = actionRepository(actionReview.action);
    const existing = reviews.get(repository);
    const review = {
      expectedTag: actionReview.expectedTag,
      reason: actionReview.reason,
      repository,
    };

    if (existing && existing.expectedTag !== review.expectedTag) {
      throw new Error(`${repository} has conflicting action release reviews.`);
    }
    reviews.set(repository, existing ?? review);
  }

  return [...reviews.values()];
}

async function requestGithubJson(url, { fetchImplementation, token }) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nakafa-dependency-policy",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImplementation(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url}.`);
  }
  return response.json();
}

/** Fetches the current stable tag for one reviewed GitHub Action repository. */
export async function fetchLatestGithubActionTag(
  review,
  { fetchImplementation = fetch, token } = {}
) {
  const options = { fetchImplementation, token };
  const release = await requestGithubJson(
    `https://api.github.com/repos/${review.repository}/releases/latest`,
    options
  );
  if (typeof release.tag_name !== "string") {
    throw new Error(`${review.repository} returned invalid release metadata.`);
  }
  return release.tag_name;
}
