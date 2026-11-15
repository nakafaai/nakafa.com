import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Schema,
  String as Str,
} from "effect";
import { runText } from "#scripts/process";
import {
  gh,
  mainHead,
  ProofError,
  REPOSITORY,
  RunListJson,
} from "#scripts/proof/client";

/** The head that a proof run's name carries: `Proof <sha> <nonce>`. */
const PROOF_TITLE = /^Proof (?<sha>[0-9a-f]{40}) /u;

/**
 * Runs Git in this checkout and returns its exit code. A question Git answers by
 * its exit code, such as whether one commit is an ancestor of another, says so;
 * any other command that fails fails the proof.
 */
const runGit = Effect.fn("proof.runGit")(function* (
  args: readonly string[],
  answersByCode: boolean
) {
  const output = yield* runText("git", args).pipe(
    Effect.mapError(() => new ProofError({ message: "Git could not start." }))
  );
  if (output.code !== 0 && !answersByCode) {
    return yield* new ProofError({
      message: `git ${Arr.join(Arr.take(args, 1), " ")} failed: ${output.stderr.trim()}`,
    });
  }
  return output.code;
});

/**
 * Cancels every queued proof run whose head is no longer worth proving: not the
 * head of an open pull request, not main's head, and not the tip of a train
 * branch. A head that a newer push replaced, or that merged, would otherwise
 * hold one of the 20 jobs that every proof and gate of the account shares.
 * Runs that already started keep going. Returns how many it cancelled.
 */
export const sweepSuperseded = Effect.fn("proof.sweepSuperseded")(function* () {
  const lines = (text: string) =>
    Arr.filter(Str.split(text, "\n"), (line) => line !== "");
  const heads = yield* gh([
    "pr",
    "list",
    "--repo",
    REPOSITORY,
    "--state",
    "open",
    "--limit",
    "300",
    "--json",
    "headRefOid",
    "--jq",
    ".[].headRefOid",
  ]);
  const trains = yield* gh([
    "api",
    `repos/${REPOSITORY}/git/matching-refs/heads/nabil/train-`,
    "--jq",
    ".[].object.sha",
  ]);
  const keep = HashSet.fromIterable([
    ...lines(heads),
    ...lines(trains),
    yield* mainHead,
  ]);
  const queued = yield* gh([
    "run",
    "list",
    "--repo",
    REPOSITORY,
    "--workflow",
    "proof.yml",
    "--status",
    "queued",
    "--limit",
    "200",
    "--json",
    "databaseId,displayTitle",
  ]).pipe(Effect.flatMap(Schema.decodeEffect(RunListJson)));
  // A proof of a commit on main, such as a baseline a verdict compares with, is
  // never superseded, whatever main's head is now.
  yield* runGit(["fetch", "--quiet", "origin", "main"], false);
  const stale = yield* Effect.filter(queued, (run) =>
    Option.match(
      Option.fromNullishOr(PROOF_TITLE.exec(run.displayTitle)?.groups?.sha),
      {
        onNone: () => Effect.succeed(false),
        onSome: (sha) =>
          HashSet.has(keep, sha)
            ? Effect.succeed(false)
            : runGit(
                ["merge-base", "--is-ancestor", sha, "origin/main"],
                true
              ).pipe(Effect.map((code) => code !== 0)),
      }
    )
  );
  yield* Effect.forEach(stale, (run) =>
    gh(["run", "cancel", String(run.databaseId), "--repo", REPOSITORY]).pipe(
      Effect.catchTag("ProofError", (error) =>
        Effect.logWarning(`Run ${run.databaseId} stays: ${error.message}`)
      )
    )
  );
  return stale.length;
});
