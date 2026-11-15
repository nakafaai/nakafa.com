import {
  combineShards,
  HeadSha,
  ShardResultJson,
} from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";
import {
  failuresOf,
  formatVerdict,
  makeBaseline,
} from "#scripts/proof/baseline";
import { gh, ProofError, REPOSITORY } from "#scripts/proof/client";
import { githubProver } from "#scripts/proof/github";

const USAGE =
  "Usage: node scripts/proof/group.ts <base sha> <head sha> <results folder> <run url>";

/**
 * What the job that posts a merge group's verdict hands it: the group's base and
 * head, the folder its engines' results were downloaded into, and its run.
 */
export const parseGroupArguments = Effect.fn("proof.parseGroupArguments")(
  function* (argv: readonly string[]) {
    const [base, head, results, url] = argv;
    return {
      base: yield* Schema.decodeEffect(HeadSha)(base ?? ""),
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
 * Aside What Its Base Fails"): every failing spec is proven on the group's base
 * (main, or the head of the group ahead), and the group fails only on a spec its
 * base passes, a suite that failed outside every test, or an engine that never
 * reported. It returns once the verdict is posted, whatever the verdict, so the
 * job keeps its own outcome.
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
  const shared =
    failures.length === 0
      ? []
      : yield* makeBaseline(input.base).pipe(
          Effect.flatMap((baseline) => baseline.shared(failures)),
          Effect.provide(githubProver)
        );
  const fresh = Arr.filter(
    failures,
    (failure) => !Arr.contains(shared, failure)
  );
  const base = input.base.slice(0, 10);
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
  yield* writeOutput(formatVerdict(fresh, shared, input.base));
});

runEntry(import.meta.main, judgeGroup(Arr.drop(process.argv, 2)));
