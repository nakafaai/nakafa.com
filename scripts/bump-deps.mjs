import { spawnSync } from "node:child_process";
import process from "node:process";

import {
  inspectDependencyPolicy,
  REGISTRY_REVIEWS,
} from "./dependency-policy.mjs";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
  inspectGithubActionPolicy,
} from "./github-action-policy.mjs";

const root = process.cwd();

/** Runs pnpm and preserves its exact output. */
function runPnpm(args, options = {}) {
  return spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
}

const update = runPnpm(["update", "--recursive", "--latest"]);
if (update.status !== 0) {
  process.exit(update.status ?? 1);
}

const problems = [
  ...inspectDependencyPolicy(root),
  ...inspectGithubActionPolicy(root),
];

for (const [registry, reviewedLatest, reason] of REGISTRY_REVIEWS) {
  const result = runPnpm(["view", registry, "version", "--json"], {
    capture: true,
  });
  if (result.status !== 0) {
    problems.push(
      result.stderr.trim() ||
        `Unable to inspect reviewed dependency ${registry}.`
    );
    continue;
  }

  let latest;
  try {
    latest = JSON.parse(result.stdout);
  } catch {
    problems.push(`${registry} returned invalid registry metadata.`);
    continue;
  }

  if (latest !== reviewedLatest) {
    problems.push(
      `${registry} is now ${String(latest)}; last reviewed ${reviewedLatest}.`
    );
  }
  process.stdout.write(`${registry}: reviewed ${reviewedLatest}. ${reason}\n`);
}

const actionChecks = await Promise.all(
  githubActionReleaseReviews().map(async (review) => {
    try {
      return {
        latest: await fetchLatestGithubActionTag(review, {
          token: process.env.GITHUB_TOKEN,
        }),
        review,
      };
    } catch (error) {
      return { error, review };
    }
  })
);

for (const { error, latest, review } of actionChecks) {
  if (error) {
    problems.push(
      error instanceof Error
        ? `Unable to inspect ${review.repository}: ${error.message}`
        : `Unable to inspect ${review.repository}.`
    );
    continue;
  }
  if (latest !== review.expectedTag) {
    problems.push(
      `${review.repository} is now ${String(latest)}; last reviewed ${review.expectedTag}.`
    );
  }
  process.stdout.write(
    `${review.repository}: reviewed ${review.expectedTag}. ${review.reason}\n`
  );
}

const outdated = runPnpm(["outdated", "--recursive", "--format", "json"], {
  capture: true,
});
if ([0, 1].includes(outdated.status ?? -1)) {
  try {
    const unresolved = Object.keys(
      outdated.stdout.trim() ? JSON.parse(outdated.stdout) : {}
    );
    if (unresolved.length > 0) {
      problems.push(
        `Routine dependencies remain outdated: ${unresolved.sort().join(", ")}.`
      );
    }
  } catch {
    problems.push("pnpm outdated returned invalid JSON.");
  }
} else {
  problems.push(outdated.stderr.trim() || "pnpm outdated failed.");
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  "Routine dependencies and every reviewed hold are current under the repository's 24-hour release-maturity policy.\n"
);
