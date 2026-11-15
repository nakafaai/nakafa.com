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
    headRefName: Schema.String,
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
    "state,headRefOid,mergeable,baseRefName,headRefName",
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
 * A change as Git prints it, less what differs when the same change is replayed
 * onto a newer base: the blob ids of its `index` lines and the line numbers and
 * context of its hunk headers, as `git patch-id` compares two changes.
 */
const changeOf = (diff: string) =>
  Arr.join(
    Arr.map(
      Arr.filter(Str.split(diff, "\n"), (line) => !line.startsWith("index ")),
      (line) => (line.startsWith("@@") ? "@@" : line)
    ),
    "\n"
  );

/**
 * The head a pull request may land at: the head the train proved, or the head
 * GitHub rebased it to after the pull request below it in a stack landed, when
 * that head holds exactly the proven head's change on today's main. A member of
 * a stack holds it when its rebased head contains main and changes main as the
 * proven head changed the member below it, which also holds when two members
 * edit the same lines, where merging main with the proven head conflicts. A
 * pull request on main holds it when merging main with the proven head gives
 * the rebased head's tree.
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
  if (candidate.below !== "") {
    const onMain = yield* attempt(
      "git",
      ["merge-base", "--is-ancestor", main, head],
      root
    );
    if (onMain.code !== 0) {
      return Option.none<string>();
    }
    const proven = yield* git(["diff", candidate.below, candidate.sha]);
    const replayed = yield* git(["diff", main, head]);
    return changeOf(proven) === changeOf(replayed)
      ? Option.some(head)
      : Option.none<string>();
  }
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

/**
 * A stack member that GitHub reports conflicting after the member below it
 * landed: its history holds merges that GitHub's rebase cannot repeat onto the
 * squashed commit. The train builds the member's merge with main itself and
 * pushes it to the member's branch only when that merge changes main exactly as
 * the proof changed the member below it, so the tree that lands is the tree the
 * combination proved. The member's own tree serves when it already is main plus
 * that change; otherwise `git merge-tree` builds one, and a merge that repeats
 * or loses a change the two sides both made is refused.
 */
const rebuiltHead = Effect.fn("landing.rebuiltHead")(function* (
  root: string,
  candidate: Candidate,
  head: string,
  branch: string
) {
  const git = (args: readonly string[]) =>
    run("git", args, root).pipe(Effect.map(Str.trim));
  yield* git([
    "fetch",
    "--quiet",
    "origin",
    "main",
    `refs/pull/${candidate.number}/head`,
  ]);
  const main = yield* git(["rev-parse", "origin/main"]);
  const proven = changeOf(yield* git(["diff", candidate.below, candidate.sha]));
  const exact = (tree: string) =>
    git(["diff", main, tree]).pipe(
      Effect.map((diff) => changeOf(diff) === proven)
    );
  const own = yield* git(["rev-parse", `${head}^{tree}`]);
  const merged = yield* attempt(
    "git",
    ["merge-tree", "--write-tree", main, head],
    root
  );
  const built = Arr.headNonEmpty(Str.split(merged.stdout, "\n"));
  const tree = yield* Effect.findFirst(
    merged.code === 0 ? [own, built] : [own],
    exact
  );
  if (Option.isNone(tree)) {
    return Option.none<string>();
  }
  const rebuilt = yield* git([
    "commit-tree",
    tree.value,
    "-p",
    head,
    "-p",
    main,
    "-m",
    `Merge main into ${branch}`,
  ]);
  yield* git(["push", "--quiet", "origin", `${rebuilt}:refs/heads/${branch}`]);
  return Option.some(rebuilt);
});

/**
 * The head a pull request lands at once GitHub can merge it: the landable head
 * when GitHub reports it mergeable, or, for a stack member GitHub reports
 * conflicting, the merge with main the train built and GitHub then found
 * mergeable. Anything else waits.
 */
const readyHead = Effect.fn("landing.readyHead")(function* (
  root: string,
  candidate: Candidate,
  view: typeof PullViewJson.Type,
  head: string
) {
  if (view.mergeable === "MERGEABLE") {
    return Option.some(head);
  }
  if (view.mergeable !== "CONFLICTING" || candidate.below === "") {
    return Option.none<string>();
  }
  const rebuilt = yield* rebuiltHead(root, candidate, head, view.headRefName);
  if (Option.isNone(rebuilt)) {
    return Option.none<string>();
  }
  // GitHub computes whether the pushed merge merges before it may land.
  const moved = yield* viewPull(candidate.number).pipe(
    Effect.repeat({
      until: (pull) =>
        pull.headRefOid === rebuilt.value && pull.mergeable !== "UNKNOWN",
      schedule: Schedule.spaced("5 seconds"),
      times: 24,
    })
  );
  return moved.headRefOid === rebuilt.value && moved.mergeable === "MERGEABLE"
    ? rebuilt
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
  const ready = yield* readyHead(root, candidate, view, landable.value);
  if (Option.isNone(ready)) {
    return skip(`GitHub reports it ${view.mergeable.toLowerCase()}`);
  }
  const head = ready.value;
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
