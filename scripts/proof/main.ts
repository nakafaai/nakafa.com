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
import {
  DEFAULT_SHARDS,
  ProofError,
  proveOnGithub,
  type RunTimings,
} from "#scripts/proof/github";

const USAGE =
  "Usage: bun run proof <sha> [spec...] [--shards=<1-6>], or bun run proof --local <sha> [spec...]";

const Shards = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 6 })
);

/** What the command line asks for: where to prove, which head, which specs. */
export const parseProofArguments = Effect.fn("proof.parseArguments")(
  function* (argv: readonly string[]) {
    const local = Arr.contains(argv, "--local");
    const shards = yield* Option.match(
      Arr.findFirst(argv, (arg) => arg.startsWith("--shards=")),
      {
        onNone: () => Effect.succeed(DEFAULT_SHARDS),
        onSome: (arg) => Schema.decodeEffect(Shards)(arg.slice(9)),
      }
    );
    const [sha, ...specs] = Arr.filter(argv, (arg) => !arg.startsWith("--"));
    return {
      local,
      shards,
      sha: yield* Schema.decodeEffect(HeadSha)(sha ?? ""),
      specs: yield* Schema.decodeEffect(Schema.Array(SpecPath))(specs),
    };
  },
  Effect.mapError(() => new ProofError({ message: USAGE }))
);

/** One line of seconds, or a dash for a phase the run did not reach. */
const seconds = (value: Option.Option<number>) =>
  Option.match(value, { onNone: () => "-", onSome: (n) => `${n}s` });

/** The report of one proof: its verdict per engine with the failing specs, then its phases. */
export function formatProof(result: ProofResult, timings: RunTimings) {
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
      ...engines,
      `queue ${seconds(timings.queue)}, prepare ${seconds(timings.prepare)}${prepared}, build ${seconds(timings.build)}, specs ${seconds(timings.specs)}, total ${seconds(timings.total)}`,
      "",
    ],
    "\n"
  );
}

/**
 * Proves one head and prints its verdict, exiting 0 only when every engine
 * passed. `--local` proves it on this machine through the acceptance runtime,
 * the adapter for debugging, which a session runs through the Mac's queue.
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
  const { result, timings } = yield* proveOnGithub(
    input.sha,
    input.specs,
    input.shards
  );
  yield* writeOutput(formatProof(result, timings));
  return result.passed ? 0 : 1;
}, Effect.scoped);

runEntry(
  import.meta.main,
  runProof(`${import.meta.dirname}/../..`, Arr.drop(process.argv, 2))
);
