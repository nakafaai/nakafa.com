import { HeadSha } from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Duration, Effect, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import {
  awaitVerdict,
  GateError,
  POLL,
  startingMoment,
  type Verdict,
} from "#scripts/gate/github";
import { writeOutput } from "#scripts/output";
import { gh, REPOSITORY } from "#scripts/proof/github";

const USAGE = "Usage: bun run gate <sha>";

/**
 * How long a waiter reads a gate before it gives up. The run keeps going and
 * posts its statuses on the head whatever the waiter does.
 */
const PATIENCE = Duration.hours(3);

/** The one head the command line names. */
export const parseGateArguments = Effect.fn("gate.parseArguments")(
  function* (argv: readonly string[]) {
    const [sha, ...rest] = argv;
    if (rest.length > 0) {
      return yield* new GateError({ message: USAGE });
    }
    return yield* Schema.decodeEffect(HeadSha)(sha ?? "");
  },
  Effect.mapError(() => new GateError({ message: USAGE }))
);

/** The report of one gate: its verdict, its run, then each part's state. */
export function formatGate(sha: string, verdict: Verdict) {
  return Arr.join(
    [
      `Gate of ${sha}: ${verdict.passed ? "passed" : "failed"}`,
      verdict.url,
      ...Arr.map(
        verdict.parts,
        (part) =>
          `${part.context.padEnd(18)}${part.state.toLowerCase()}${part.description === null ? "" : ` (${part.description})`}`
      ),
      "",
    ],
    "\n"
  );
}

/**
 * Gates one head on GitHub's runners: dispatches the gate workflow, then reads
 * the head's statuses until the run posts its verdict, and exits 0 only when
 * every part passed.
 */
export const runGate = Effect.fn("gate.run")(function* (
  argv: readonly string[]
) {
  const sha = yield* parseGateArguments(argv);
  const since = yield* startingMoment(sha);
  yield* gh([
    "workflow",
    "run",
    "gate.yml",
    "--repo",
    REPOSITORY,
    "--ref",
    "main",
    "-f",
    `sha=${sha}`,
  ]).pipe(
    Effect.mapError((error) => new GateError({ message: error.message }))
  );
  yield* Effect.log(
    `Gating ${sha}; its statuses are read every ${Duration.format(POLL)}.`
  );
  const verdict = yield* awaitVerdict(sha, since).pipe(
    Effect.timeoutOrElse({
      duration: PATIENCE,
      orElse: () =>
        Effect.fail(
          new GateError({
            message: `No verdict on ${sha} after ${Duration.format(PATIENCE)}: read its gate statuses on GitHub.`,
          })
        ),
    })
  );
  yield* writeOutput(formatGate(sha, verdict));
  return verdict.passed ? 0 : 1;
});

runEntry(import.meta.main, runGate(Arr.drop(process.argv, 2)));
