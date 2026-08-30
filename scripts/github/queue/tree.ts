import { Effect, type PlatformError, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import {
  type QueueIdentity,
  queueGateError,
} from "#scripts/github/queue/admission";

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

const collectText = (
  stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>
) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (output, chunk) => output + chunk
    )
  );

const runGit = Effect.fn("QueueGate.runGit")(function* (
  repositoryRoot: string,
  args: readonly string[]
) {
  const command = yield* ChildProcess.make("git", args, {
    cwd: repositoryRoot,
  }).pipe(
    Effect.mapError((cause) =>
      queueGateError("Unable to start merge queue Git verification.", cause)
    )
  );
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      command.exitCode,
      collectText(command.stdout),
      collectText(command.stderr),
    ],
    { concurrency: 3 }
  ).pipe(
    Effect.mapError((cause) =>
      queueGateError("Unable to read merge queue Git verification.", cause)
    )
  );
  if (exitCode !== 0) {
    return yield* queueGateError(
      `Merge queue Git verification failed: ${stderr.trim() || "unknown Git error"}.`
    );
  }
  return stdout;
});

/** Reads and validates exact Git tree evidence for one merge-group commit. */
export const inspectQueueTree = Effect.fn("QueueGate.inspectTree")(function* (
  repositoryRoot: string,
  identity: QueueIdentity,
  sourceHead: string
) {
  yield* runGit(repositoryRoot, [
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
      runGit(repositoryRoot, ["rev-parse", "HEAD"]),
      runGit(repositoryRoot, [
        "rev-list",
        "--parents",
        "-n",
        "1",
        identity.groupSha,
      ]),
      runGit(repositoryRoot, [
        "merge-tree",
        "--write-tree",
        identity.baseSha,
        sourceHead,
      ]),
      runGit(repositoryRoot, ["rev-parse", `${identity.groupSha}^{tree}`]),
      runGit(repositoryRoot, ["rev-parse", `${sourceHead}^{tree}`]),
      runGit(repositoryRoot, ["merge-base", identity.baseSha, sourceHead]),
      runGit(repositoryRoot, [
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
