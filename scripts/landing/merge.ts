import {
  Array as Arr,
  Effect,
  Option,
  Schedule,
  Schema,
  String as Str,
} from "effect";
import { attempt, decoded, gh, run } from "#scripts/landing/command";
import type { Candidate, Landing } from "#scripts/landing/train";
import { REPOSITORY } from "#scripts/proof/client";

const PullViewJson = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.String,
    headRefOid: Schema.String,
    mergeable: Schema.String,
    baseRefName: Schema.String,
  })
);

/** Reads one pull request, waiting while GitHub still computes whether it merges. */
const viewPull = Effect.fn("landing.viewPull")(function* (number: number) {
  return yield* gh([
    "pr",
    "view",
    String(number),
    "--repo",
    REPOSITORY,
    "--json",
    "state,headRefOid,mergeable,baseRefName",
  ]).pipe(
    Effect.flatMap(decoded(PullViewJson)),
    Effect.repeat({
      until: (view) => view.mergeable !== "UNKNOWN",
      schedule: Schedule.spaced("4 seconds"),
      times: 8,
    })
  );
});

/**
 * Squash-merges one pull request at the exact head the train proved. A pull
 * request of a GitHub stack refuses that merge and takes the asynchronous merge
 * instead, with the same head; the train then waits until GitHub reports it
 * merged.
 */
/**
 * The head a pull request may land at: the head the train proved, or the head
 * GitHub rebased it to after the pull request below it in a stack landed, when
 * that head holds exactly the proven head's change on today's main.
 */
const landableHead = Effect.fn("landing.landableHead")(function* (
  root: string,
  candidate: Candidate,
  head: string
) {
  if (head === candidate.sha) {
    return Option.some(head);
  }
  const git = (args: readonly string[]) => run("git", args, root);
  yield* git([
    "fetch",
    "--quiet",
    "origin",
    "main",
    `refs/pull/${candidate.number}/head`,
  ]);
  const main = (yield* git(["rev-parse", "origin/main"])).trim();
  const merged = yield* attempt(
    "git",
    ["merge-tree", "--write-tree", main, candidate.sha],
    root
  );
  const tree = (yield* git(["rev-parse", `${head}^{tree}`])).trim();
  return merged.code === 0 &&
    Arr.headNonEmpty(Str.split(merged.stdout, "\n")) === tree
    ? Option.some(head)
    : Option.none<string>();
});

export const landPull = Effect.fn("landing.landPull")(function* (
  root: string,
  candidate: Candidate
) {
  const skip = (reason: string): Landing => ({
    _tag: "skipped",
    candidate,
    reason,
  });
  const number = String(candidate.number);
  // In a stack, GitHub moves a pull request onto main once the one below lands.
  const view = yield* viewPull(candidate.number).pipe(
    Effect.repeat({
      until: (pull) => pull.state !== "OPEN" || pull.baseRefName === "main",
      schedule: Schedule.spaced("5 seconds"),
      times: 24,
    })
  );
  if (view.state !== "OPEN") {
    return skip(`already ${view.state.toLowerCase()}`);
  }
  if (view.baseRefName !== "main") {
    return skip(`it still targets ${view.baseRefName}: land its base first`);
  }
  const landable = yield* landableHead(root, candidate, view.headRefOid);
  if (Option.isNone(landable)) {
    return skip("its head moved after its proof: prove the new head");
  }
  const head = landable.value;
  if (view.mergeable !== "MERGEABLE") {
    return skip(`GitHub reports it ${view.mergeable.toLowerCase()}`);
  }
  const subject = `${candidate.title} (#${candidate.number})`;
  const merge = yield* attempt("gh", [
    "pr",
    "merge",
    number,
    "--repo",
    REPOSITORY,
    "--squash",
    "--match-head-commit",
    head,
    "--subject",
    subject,
  ]);
  if (merge.code === 0) {
    return { _tag: "landed", candidate } satisfies Landing;
  }
  if (!merge.stderr.includes("asynchronous merge")) {
    return skip(merge.stderr.trim());
  }
  yield* gh([
    "api",
    "-X",
    "PUT",
    `repos/${REPOSITORY}/pulls/${number}/merge-async`,
    "-f",
    "merge_action=direct_merge",
    "-f",
    "merge_method=squash",
    "-f",
    `sha=${head}`,
    "-f",
    `commit_title=${subject}`,
  ]);
  const merged = yield* viewPull(candidate.number).pipe(
    Effect.repeat({
      until: (pull) => pull.state === "MERGED",
      schedule: Schedule.spaced("5 seconds"),
      times: 24,
    })
  );
  return merged.state === "MERGED"
    ? ({ _tag: "landed", candidate } satisfies Landing)
    : skip("the asynchronous merge did not finish in two minutes");
});
