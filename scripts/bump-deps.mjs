import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  inspectDependencyPolicy,
  REGISTRY_REVIEWS,
} from "./dependency-policy.mjs";
import {
  fetchLatestGithubActionTag,
  githubActionReleaseReviews,
  inspectGithubActionPolicy,
} from "./github-action-policy.mjs";

/** Runs pnpm and preserves its exact output. */
function runPnpm(root, args, options = {}) {
  return spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
}

/** Returns every local dependency and workflow policy violation. */
export function inspectRepositoryPolicy(root) {
  return [...inspectDependencyPolicy(root), ...inspectGithubActionPolicy(root)];
}

/** Updates routine dependencies only after every safety policy passes. */
export async function bumpDependencies({
  inspectPolicy = inspectRepositoryPolicy,
  root = process.cwd(),
  run = runPnpm,
  writeError = (value) => process.stderr.write(value),
  writeOutput = (value) => process.stdout.write(value),
} = {}) {
  const preflightProblems = inspectPolicy(root);
  if (preflightProblems.length > 0) {
    writeError(`${preflightProblems.join("\n")}\n`);
    return 1;
  }

  const update = run(root, ["update", "--recursive", "--latest"]);
  if (update.status !== 0) {
    return update.status ?? 1;
  }

  const problems = inspectPolicy(root);

  for (const [registry, reviewedLatest, reason] of REGISTRY_REVIEWS) {
    const result = run(root, ["view", registry, "version", "--json"], {
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
    writeOutput(`${registry}: reviewed ${reviewedLatest}. ${reason}\n`);
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
    writeOutput(
      `${review.repository}: reviewed ${review.expectedTag}. ${review.reason}\n`
    );
  }

  const outdated = run(root, ["outdated", "--recursive", "--format", "json"], {
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
    writeError(`${problems.join("\n")}\n`);
    return 1;
  }

  writeOutput(
    "Routine dependencies and every reviewed hold are current under the repository's 24-hour release-maturity policy and exact reviewed exception allowlist.\n"
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = await bumpDependencies();
}
