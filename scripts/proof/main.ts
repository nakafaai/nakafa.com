import {
  ENGINES,
  HeadSha,
  type ProofResult,
  SpecPath,
} from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";
import { failuresOf, makeBaseline } from "#scripts/proof/baseline";
import { mainHead, ProofError } from "#scripts/proof/client";
import {
  githubProver,
  postVerdict,
  proveOnGithub,
  type RunTimings,
} from "#scripts/proof/github";

const USAGE =
  "Usage: bun run proof <sha> [spec...], or bun run proof --local <sha> [spec...]";

/** What the command line asks for: where to prove, which head, which specs. */
export const parseProofArguments = Effect.fn("proof.parseArguments")(
  function* (argv: readonly string[]) {
    const local = Arr.contains(argv, "--local");
    const [sha, ...specs] = Arr.filter(argv, (arg) => !arg.startsWith("--"));
    return {
      local,
      sha: yield* Schema.decodeEffect(HeadSha)(sha ?? ""),
      specs: yield* Schema.decodeEffect(Schema.Array(SpecPath))(specs),
    };
  },
  Effect.mapError(() => new ProofError({ message: USAGE }))
);

/** One line of seconds, or a dash for a phase the run did not reach. */
const seconds = (value: Option.Option<number>) =>
  Option.match(value, { onNone: () => "-", onSome: (n) => `${n}s` });

/** The report of one run: its gate, its verdict per engine with the failing specs, then its phases. */
export function formatProof(
  result: ProofResult,
  gated: Option.Option<boolean>,
  timings: RunTimings
) {
  const engines = Arr.map(ENGINES, (engine) => {
    const { passed, failures } = result.engines[engine];
    return `${engine.padEnd(9)}${passed ? "passed" : "failed"}${Arr.join(
      Arr.map(failures, (failure) => `\n  ${failure}`),
      ""
    )}`;
  });
  const prepared = Option.match(timings.restored, {
    onNone: () => "",
    onSome: (restored) => (restored ? " (restored)" : " (prepared)"),
  });
  return Arr.join(
    [
      `Proof of ${result.sha}: ${result.passed ? "passed" : "failed"}`,
      result.url,
      ...Option.match(gated, {
        onNone: () => [],
        onSome: (passed) => [`gate     ${passed ? "passed" : "failed"}`],
      }),
      ...engines,
      `queue ${seconds(timings.queue)}, gate ${seconds(timings.gate)}, prepare ${seconds(timings.prepare)}${prepared}, build ${seconds(timings.build)}, specs ${seconds(timings.specs)}, total ${seconds(timings.total)}`,
      "",
    ],
    "\n"
  );
}

/**
 * Verifies one head in one job, its gate over the workspaces it changes and its
 * proof, and prints both, exiting 0 only when the gate passed and the head fails
 * nothing that main does not. `--local` proves it on this machine through the
 * acceptance runtime, the adapter for debugging, which a session runs through
 * the Mac's queue.
 */
export const runProof = Effect.fn("proof.run")(function* (
  root: string,
  argv: readonly string[]
) {
  const input = yield* parseProofArguments(argv);
  if (input.local) {
    const child = yield* ChildProcess.make(
      "bun",
      [
        "run",
        "--cwd",
        "packages/backend",
        "acceptance",
        "proof",
        input.sha,
        ...input.specs,
      ],
      { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" }
    );
    return Number(yield* child.exitCode);
  }
  const { result, gated, timings } = yield* proveOnGithub(
    input.sha,
    input.specs,
    { gate: true, full: false }
  );
  const gatePassed = Option.exists(gated, (passed) => passed);
  const main = yield* mainHead;
  const failures = failuresOf(result);
  if (main === input.sha) {
    // Main has nothing to be judged against: its failures are its own, and the
    // run's statuses already say so.
    yield* writeOutput(
      `${formatProof(result, gated, timings)}Verdict: this is main, which fails ${failures.length} specs\n`
    );
    return failures.length === 0 && gatePassed ? 0 : 1;
  }
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
  yield* postVerdict(input.sha, result.url, fresh, shared, main);
  yield* writeOutput(
    `${formatProof(result, gated, timings)}${formatVerdict(fresh, shared, main)}`
  );
  return fresh.length === 0 && gatePassed ? 0 : 1;
}, Effect.scoped);

/** The verdict against main: each failure, new or shared with main, then the one line a caller acts on. */
function formatVerdict(
  fresh: readonly string[],
  shared: readonly string[],
  main: string
) {
  return Arr.join(
    [
      ...Arr.map(fresh, (failure) => `new ${failure}`),
      ...Arr.map(
        shared,
        (failure) => `on main ${main.slice(0, 10)} too ${failure}`
      ),
      fresh.length === 0
        ? "Verdict: no new failure against main"
        : `Verdict: ${fresh.length} new failures against main`,
      "",
    ],
    "\n"
  );
}

runEntry(
  import.meta.main,
  runProof(`${import.meta.dirname}/../..`, Arr.drop(process.argv, 2))
);
