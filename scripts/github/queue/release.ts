import { isDeepStrictEqual } from "node:util";
import { Effect, type Redacted } from "effect";
import { queueGateError } from "#scripts/github/queue/admission";
import { runCommand } from "#scripts/github/queue/command";
import { replayRelease } from "#scripts/github/queue/replay";

const CHANGESET_PATTERN = /^\.changeset\/(?!README\.md$)[^/]+\.md$/u;
const CHANGELOG_PATTERN = /^(?:apps|packages)\/[^/]+\/CHANGELOG\.md$/u;
const MANIFEST_PATTERN = /^(?:apps|packages)\/[^/]+\/package\.json$/u;
const RAW_CHANGE_PATTERN =
  /^:(\d{6}) (\d{6}) [0-9a-f]{40} [0-9a-f]{40} ([AMD])$/u;
const REGULAR_FILE_MODE = "100644";
const MISSING_FILE_MODE = "000000";

export interface ReleaseChange {
  readonly afterMode: string;
  readonly beforeMode: string;
  readonly path: string;
  readonly status: "A" | "D" | "M";
}

export interface ReleaseEvidence {
  readonly changes: readonly ReleaseChange[];
}

const packageDirectory = (path: string) =>
  path.slice(0, -"/package.json".length);

const changelogDirectory = (path: string) =>
  path.slice(0, -"/CHANGELOG.md".length);

const parseChanges = Effect.fn("QueueGate.parseReleaseChanges")(function* (
  raw: string
) {
  const tokens = raw.split("\0");
  if (tokens.at(-1) === "") {
    tokens.pop();
  }
  if (tokens.length === 0 || tokens.length % 2 !== 0) {
    return yield* queueGateError(
      "Generated release diff did not contain complete Git records."
    );
  }

  const changes: ReleaseChange[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const metadata = tokens[index];
    const path = tokens[index + 1];
    const match = metadata ? RAW_CHANGE_PATTERN.exec(metadata) : null;
    if (!(match && path)) {
      return yield* queueGateError(
        "Generated release diff contains an unsupported Git record."
      );
    }
    const status = match[3];
    if (status !== "A" && status !== "D" && status !== "M") {
      return yield* queueGateError(
        "Generated release diff contains an unsupported file status."
      );
    }
    changes.push({
      afterMode: match[2] ?? "",
      beforeMode: match[1] ?? "",
      path,
      status,
    });
  }
  return changes;
});

/** Allows only pending Changesets, package changelogs, and package manifests. */
export const validateReleaseTree = Effect.fn("QueueGate.validateReleaseTree")(
  function* (evidence: ReleaseEvidence) {
    const paths = new Set<string>();
    const manifestDirectories = new Set<string>();
    const changelogDirectories = new Set<string>();
    let changesetCount = 0;

    for (const change of evidence.changes) {
      if (paths.has(change.path)) {
        return yield* queueGateError(
          "Generated release diff contains a duplicate path."
        );
      }
      paths.add(change.path);

      if (CHANGESET_PATTERN.test(change.path)) {
        if (
          change.status !== "D" ||
          change.beforeMode !== REGULAR_FILE_MODE ||
          change.afterMode !== MISSING_FILE_MODE
        ) {
          return yield* queueGateError(
            "Generated release may only delete regular pending changesets."
          );
        }
        changesetCount += 1;
        continue;
      }

      if (CHANGELOG_PATTERN.test(change.path)) {
        if (
          (change.status !== "A" && change.status !== "M") ||
          change.afterMode !== REGULAR_FILE_MODE ||
          (change.status === "A"
            ? change.beforeMode !== MISSING_FILE_MODE
            : change.beforeMode !== REGULAR_FILE_MODE)
        ) {
          return yield* queueGateError(
            "Generated release changelogs must be regular added or modified files."
          );
        }
        changelogDirectories.add(changelogDirectory(change.path));
        continue;
      }

      if (MANIFEST_PATTERN.test(change.path)) {
        if (
          change.status !== "M" ||
          change.beforeMode !== REGULAR_FILE_MODE ||
          change.afterMode !== REGULAR_FILE_MODE
        ) {
          return yield* queueGateError(
            "Generated release package manifests must remain regular files."
          );
        }
        manifestDirectories.add(packageDirectory(change.path));
        continue;
      }

      return yield* queueGateError(
        `Generated release changed prohibited path ${change.path}.`
      );
    }

    if (
      changesetCount === 0 ||
      manifestDirectories.size === 0 ||
      changelogDirectories.size !== manifestDirectories.size ||
      [...manifestDirectories].some(
        (directory) => !changelogDirectories.has(directory)
      )
    ) {
      return yield* queueGateError(
        "Generated release must pair every versioned package with its changelog."
      );
    }
  }
);

/** Reads and validates the exact generated release diff admitted by the queue. */
export const inspectReleaseTree = Effect.fn("QueueGate.inspectReleaseTree")(
  function* (
    repositoryRoot: string,
    baseSha: string,
    sourceHead: string,
    expectedPaths: readonly string[],
    token: Redacted.Redacted
  ) {
    const raw = yield* runCommand(repositoryRoot, "git", [
      "diff",
      "--raw",
      "--abbrev=40",
      "--no-renames",
      "-z",
      `${baseSha}...${sourceHead}`,
      "--",
    ]);
    const changes = yield* parseChanges(raw);
    const observedPaths = changes.map((change) => change.path).sort();
    const sortedExpectedPaths = [...expectedPaths].sort();
    if (!isDeepStrictEqual(observedPaths, sortedExpectedPaths)) {
      return yield* queueGateError(
        "Generated release path evidence does not match the admitted tree."
      );
    }

    yield* validateReleaseTree({ changes });
    yield* replayRelease(repositoryRoot, baseSha, sourceHead, token);
  }
);
