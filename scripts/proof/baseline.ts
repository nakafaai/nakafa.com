import {
  type ProofResult,
  proofFailures,
  SpecPath,
} from "@repo/backend/scripts/content/acceptance/result";
import { Array as Arr, Effect, HashSet, Order, Ref, Schema } from "effect";
import { Prover } from "#scripts/proof/github";

/** The failure of a proof that names no spec file, such as a failed build or a machine that never reported. */
const INCOMPLETE = "proof:incomplete";

const isSpec = Schema.is(SpecPath);

/** Every failure of a proof, with one marker when it failed without naming one. */
export const failuresOf = (result: ProofResult): readonly string[] => {
  const failures = proofFailures(result);
  return !result.passed && failures.length === 0 ? [INCOMPLETE] : failures;
};

/**
 * What main fails on the same runners, learned by proving main on the failing
 * specs it has not run yet. A failure that main shares belongs to main; every
 * other failure, a whole suite or an incomplete proof included, is new. Each
 * spec runs on main at most once per baseline.
 */
export const makeBaseline = Effect.fn("proof.makeBaseline")(function* (
  main: string
) {
  const prover = yield* Prover;
  const failing = yield* Ref.make(HashSet.empty<string>());
  const passing = yield* Ref.make(HashSet.empty<string>());

  /** The given failures that main fails too. */
  const shared = Effect.fn("proof.sharedWithMain")(function* (
    failures: readonly string[]
  ) {
    const known = HashSet.union(
      yield* Ref.get(failing),
      yield* Ref.get(passing)
    );
    const unknown = Arr.filter(
      Arr.filter(failures, isSpec),
      (spec) => !HashSet.has(known, spec)
    );
    if (unknown.length > 0) {
      const red = HashSet.fromIterable(
        proofFailures(yield* prover.prove(main, unknown))
      );
      yield* Effect.forEach(unknown, (spec) =>
        Ref.update(
          HashSet.has(red, spec) ? failing : passing,
          HashSet.add(spec)
        )
      );
    }
    const now = yield* Ref.get(failing);
    return Arr.filter(failures, (failure) => HashSet.has(now, failure));
  });

  return {
    main,
    shared,
    /** Every spec this baseline found failing on main, in path order. */
    failing: Ref.get(failing).pipe(
      Effect.map((specs) => Arr.sort(Array.from(specs), Order.String))
    ),
  };
});
