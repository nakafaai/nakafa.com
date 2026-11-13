import { SpecPath } from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, Layer, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import { githubRepository } from "#scripts/landing/repository";
import { formatTrain, runTrain, TrainError } from "#scripts/landing/train";
import { writeOutput } from "#scripts/output";
import { githubProver } from "#scripts/proof/github";

const USAGE =
  "Usage: bun run train [pull-request-number...] [--specs=<spec>,<spec>]";

const Numbers = Schema.Array(
  Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0))
);

/** The pull requests a train may take, every proven one when none is named, and the specs it proves. */
export const parseTrainArguments = Effect.fn("landing.parseArguments")(
  function* (argv: readonly string[]) {
    const specs = Arr.flatMap(
      Arr.filter(argv, (arg) => arg.startsWith("--specs=")),
      (arg: string) =>
        Arr.filter(arg.slice(8).split(","), (spec) => spec !== "")
    );
    return {
      numbers: yield* Schema.decodeEffect(Numbers)(
        Arr.filter(argv, (arg) => !arg.startsWith("--"))
      ),
      specs: yield* Schema.decodeEffect(Schema.Array(SpecPath))(specs),
    };
  },
  Effect.mapError(() => new TrainError({ message: USAGE }))
);

/**
 * Runs one landing train from this checkout: the pull requests whose own proof
 * passed ride it, their combination is proven on GitHub's runners, and the
 * passing set lands with one production deploy.
 */
export const runTrainCli = Effect.fn("landing.cli")(function* (
  root: string,
  argv: readonly string[]
) {
  const { numbers, specs } = yield* parseTrainArguments(argv);
  const report = yield* runTrain(numbers, specs).pipe(
    Effect.provide(Layer.merge(githubProver, githubRepository(root)))
  );
  yield* writeOutput(formatTrain(report));
}, Effect.scoped);

runEntry(
  import.meta.main,
  runTrainCli(`${import.meta.dirname}/../..`, Arr.drop(process.argv, 2))
);
