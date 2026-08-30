import { Effect } from "effect";
import {
  type QueueIdentity,
  queueGateError,
} from "#scripts/github/queue/admission";
import { runCommand } from "#scripts/github/queue/command";

const CI_CONFIG_PATTERN =
  /(?:^|\/)(?:biome|next\.config|tsconfig|turbo|ultracite|vercel|vitest)[^/]*\.(?:[cm]?[jt]s|json|mts|yml|yaml)$/u;
const WHITESPACE_PATTERN = /\s+/u;

export interface QueueTreeEvidence {
  readonly actualHead: string;
  readonly actualTree: string;
  readonly changedPaths: readonly string[];
  readonly expectedTree: string;
  readonly mergeBase: string;
  readonly parentLine: string;
  readonly sourceTree: string;
}

export interface QueueTreeDecision {
  readonly changedPaths: readonly string[];
  readonly reuse: boolean;
}

/** Returns whether a changed path can alter how CI proves another path. */
export const isCiSensitivePath = (path: string) =>
  path.startsWith(".github/") ||
  path.startsWith("scripts/") ||
  path.startsWith("packages/testing/") ||
  path.startsWith("packages/typescript-config/") ||
  path.startsWith("repos/effect/") ||
  path === ".npmrc" ||
  path === "package.json" ||
  path === "pnpm-lock.yaml" ||
  path === "pnpm-workspace.yaml" ||
  path.endsWith("/package.json") ||
  CI_CONFIG_PATTERN.test(path);

/** Validates a single squash candidate and decides whether source proof is reusable. */
export const validateQueueTree = Effect.fn("QueueGate.validateTree")(function* (
  identity: QueueIdentity,
  sourceHead: string,
  evidence: QueueTreeEvidence
) {
  const parents = evidence.parentLine.trim().split(WHITESPACE_PATTERN);
  if (
    evidence.actualHead !== identity.groupSha ||
    parents.length !== 2 ||
    parents[0] !== identity.groupSha ||
    parents[1] !== identity.baseSha
  ) {
    return yield* queueGateError(
      "Merge group is not a single squash candidate on its declared base."
    );
  }
  if (evidence.actualTree !== evidence.expectedTree) {
    return yield* queueGateError(
      "Merge group contains changes outside its admitted pull request."
    );
  }

  const reuse =
    evidence.mergeBase === identity.baseSha &&
    evidence.sourceTree === evidence.actualTree &&
    !evidence.changedPaths.some(isCiSensitivePath);

  if (sourceHead.length !== 40) {
    return yield* queueGateError("Pull request head identity is invalid.");
  }

  return {
    changedPaths: evidence.changedPaths,
    reuse,
  } satisfies QueueTreeDecision;
});

/** Reads and validates exact Git tree evidence for one merge-group commit. */
export const inspectQueueTree = Effect.fn("QueueGate.inspectTree")(function* (
  repositoryRoot: string,
  identity: QueueIdentity,
  sourceHead: string
) {
  yield* runCommand(repositoryRoot, "git", [
    "fetch",
    "--no-tags",
    "origin",
    identity.baseSha,
    identity.groupSha,
    sourceHead,
  ]);
  const [
    actualHead,
    parentLine,
    expectedTree,
    actualTree,
    sourceTree,
    mergeBase,
    changedPaths,
  ] = yield* Effect.all(
    [
      runCommand(repositoryRoot, "git", ["rev-parse", "HEAD"]),
      runCommand(repositoryRoot, "git", [
        "rev-list",
        "--parents",
        "-n",
        "1",
        identity.groupSha,
      ]),
      runCommand(repositoryRoot, "git", [
        "merge-tree",
        "--write-tree",
        identity.baseSha,
        sourceHead,
      ]),
      runCommand(repositoryRoot, "git", [
        "rev-parse",
        `${identity.groupSha}^{tree}`,
      ]),
      runCommand(repositoryRoot, "git", ["rev-parse", `${sourceHead}^{tree}`]),
      runCommand(repositoryRoot, "git", [
        "merge-base",
        identity.baseSha,
        sourceHead,
      ]),
      runCommand(repositoryRoot, "git", [
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        `${identity.baseSha}...${sourceHead}`,
        "--",
      ]),
    ],
    { concurrency: 4 }
  );

  return yield* validateQueueTree(identity, sourceHead, {
    actualHead: actualHead.trim(),
    actualTree: actualTree.trim(),
    changedPaths: changedPaths.split("\0").filter(Boolean),
    expectedTree: expectedTree.trim(),
    mergeBase: mergeBase.trim(),
    parentLine: parentLine.trim(),
    sourceTree: sourceTree.trim(),
  });
});
