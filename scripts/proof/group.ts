import { combineShards, HeadSha, ShardResultJson } from "@repo/testing/proof";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";
import {
  failuresOf,
  formatVerdict,
  makeBaseline,
} from "#scripts/proof/baseline";
import { gh, mainHead, ProofError, REPOSITORY } from "#scripts/proof/client";
import { githubProver } from "#scripts/proof/github";

const USAGE =
  "Usage: node scripts/proof/group.ts <head sha> <results folder> <run url>";

/**
 * What the job that posts a merge group's verdict hands it: the group's head,
 * the folder its engines' results were downloaded into, and its run.
 */
export const parseGroupArguments = Effect.fn("proof.parseGroupArguments")(
  function* (argv: readonly string[]) {
    const [head, results, url] = argv;
    return {
      head: yield* Schema.decodeEffect(HeadSha)(head ?? ""),
      results: yield* Schema.decodeEffect(Schema.NonEmptyString)(results ?? ""),
      url: yield* Schema.decodeEffect(Schema.NonEmptyString)(url ?? ""),
    };
  },
  Effect.mapError(() => new ProofError({ message: USAGE }))
);

/**
 * The result each engine of the run uploaded, which the job downloaded into one
 * folder per artifact. An engine whose build failed uploaded none, and the
 * download writes no folder when no engine did, so such an engine counts as
 * one that never reported.
 */
const readResults = Effect.fn("proof.readGroupResults")(function* (
  folder: string
) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(folder))) {
    return [];
  }
  const names = yield* fs.readDirectory(folder);
  return yield* Effect.forEach(names, (name) =>
    fs
      .readFileString(`${folder}/${name}/result.json`)
      .pipe(Effect.flatMap(Schema.decodeEffect(ShardResultJson)))
  );
});

/**
 * Posts `verify` for a merge group whose gate passed and whose engines did not
 * all pass, as the landing train judged a batch (ADR 0048, "A Merge Group Sets
 * Aside What Its Base Fails"): every failing spec is proven on main's head, and
 * the group fails only on a spec main passes, a suite that failed outside every
 * test, or an engine that never reported. Every group of the queue judges
 * against the same main commit, so the first one to fail on main's reds proves
 * them and the others read that run (`proveOnGithub`). It returns once the
 * verdict is posted, whatever the verdict, so the job keeps its own outcome.
 */
export const judgeGroup = Effect.fn("proof.judgeGroup")(function* (
  argv: readonly string[]
) {
  const input = yield* parseGroupArguments(argv);
  const result = combineShards(
    input.head,
    input.url,
    1,
    yield* readResults(input.results)
  );
  const failures = failuresOf(result);
  const main = yield* mainHead;
  const shared =
    failures.length === 0
      ? []
      : yield* makeBaseline(main).pipe(
          Effect.flatMap((baseline) => baseline.shared(failures)),
          Effect.provide(githubProver)
        );
  const fresh = Arr.filter(
    failures,
    (failure) => !Arr.contains(shared, failure)
  );
  const base = main.slice(0, 10);
  yield* gh([
    "api",
    "--silent",
    `repos/${REPOSITORY}/statuses/${input.head}`,
    "-f",
    `state=${fresh.length === 0 ? "success" : "failure"}`,
    "-f",
    "context=verify",
    "-f",
    `target_url=${input.url}`,
    "-f",
    `description=${
      fresh.length === 0
        ? `No new failure against main ${base}; ${shared.length} fail there too`
        : `${fresh.length} new failures against main ${base}`
    }`,
  ]);
  yield* writeOutput(formatVerdict(fresh, shared, main));
});

runEntry(import.meta.main, judgeGroup(Arr.drop(process.argv, 2)));
