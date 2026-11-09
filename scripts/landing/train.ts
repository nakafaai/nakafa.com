import {
  type ProofResult,
  proofFailures,
  SpecPath,
} from "@repo/backend/scripts/content/acceptance/result";
import {
  Array as Arr,
  Context,
  Effect,
  HashSet,
  Option,
  Order,
  Ref,
  Schema,
} from "effect";
import type { ProofError } from "#scripts/proof/github";
import { Prover } from "#scripts/proof/github";

/** A pull request that may ride the train: its number, the exact head its own proof passed, and its title. */
export const Candidate = Schema.Struct({
  number: Schema.Int,
  sha: Schema.String,
  title: Schema.String,
});
export type Candidate = typeof Candidate.Type;

/** A train that could not read, combine or land its pull requests. */
export class TrainError extends Schema.TaggedError<
  TrainError,
  { readonly brand: unique symbol }
>()("TrainError", { message: Schema.String }) {}

/** The commit that merges heads onto a base by SHA, and the heads that conflicted instead. */
export const Combination = Schema.Struct({
  sha: Schema.String,
  merged: Schema.Array(Candidate),
  conflicted: Schema.Array(Candidate),
});
export type Combination = typeof Combination.Type;

/** A pull request the train set aside or could not land, and why. */
const Rejection = Schema.Struct({
  candidate: Candidate,
  reason: Schema.String,
});
type Rejection = typeof Rejection.Type;

/** How landing one pull request ended. */
export const Landing = Schema.Union([
  Schema.TaggedStruct("landed", { candidate: Candidate }),
  Schema.TaggedStruct("skipped", {
    candidate: Candidate,
    reason: Schema.String,
  }),
]);
export type Landing = typeof Landing.Type;

/** What the train reads from GitHub and Git, and what it changes there. */
export class Repository extends Context.Service<
  Repository,
  {
    /** Open pull requests whose own proof passed on their current head, in number order. */
    readonly proven: (
      numbers: readonly number[]
    ) => Effect.Effect<readonly Candidate[], TrainError>;
    /** The exact head of main now. */
    readonly main: Effect.Effect<string, TrainError>;
    /** Merges the heads onto the base in order, by SHA, and publishes the result for a proof. */
    readonly combine: (
      base: string,
      heads: readonly Candidate[]
    ) => Effect.Effect<Combination, TrainError>;
    /** Squash-merges one pull request at the head the train proved. */
    readonly land: (candidate: Candidate) => Effect.Effect<Landing, TrainError>;
    /** Starts the one production deploy of everything landed. */
    readonly deploy: Effect.Effect<void, TrainError>;
  }
>()("nakafa/scripts/landing/train/Repository") {}

/** What one train did. Main's failures are specs that fail on main too, which it ignored. */
const TrainReport = Schema.Struct({
  main: Schema.String,
  landed: Schema.Array(Candidate),
  skipped: Schema.Array(Rejection),
  rejected: Schema.Array(Rejection),
  mainFailures: Schema.Array(Schema.String),
});
type TrainReport = typeof TrainReport.Type;

/** The failures of a proof that no spec file names, such as a failed build or a machine that never reported. */
const INCOMPLETE = "proof:incomplete";

/** Every failure of a proof, with one marker when it failed without naming one. */
const failuresOf = (result: ProofResult): readonly string[] => {
  const failures = proofFailures(result);
  return !result.passed && failures.length === 0 ? [INCOMPLETE] : failures;
};

const isSpec = Schema.is(SpecPath);

/**
 * Lands every pull request whose own proof passed, after one proof of their
 * combination on main. A failing spec that fails on main too belongs to main:
 * the train reports it and ignores it. Any other failure splits the batch in
 * halves, so the passing half lands and the failing pull request is named.
 * Each half is proven on top of what the train already accepted, so what
 * lands is always one proven combination. Every head is an exact SHA.
 */
export const runTrain = Effect.fn("landing.runTrain")(function* (
  numbers: readonly number[],
  specs: readonly string[]
) {
  const repository = yield* Repository;
  const prover = yield* Prover;
  const main = yield* repository.main;
  const candidates = yield* repository.proven(numbers);
  const accepted = yield* Ref.make<readonly Candidate[]>([]);
  const rejected = yield* Ref.make<readonly Rejection[]>([]);
  const mainFailing = yield* Ref.make(HashSet.empty<string>());
  const mainPassing = yield* Ref.make(HashSet.empty<string>());

  const reject = (candidate: Candidate, reason: string) =>
    Ref.update(rejected, Arr.append({ candidate, reason }));

  /** The failing specs that main fails too, proving main once for each spec it has not yet run. */
  const onMain = Effect.fn("landing.onMain")(function* (
    failures: readonly string[]
  ) {
    const known = HashSet.union(
      yield* Ref.get(mainFailing),
      yield* Ref.get(mainPassing)
    );
    const unknown = Arr.filter(
      Arr.filter(failures, isSpec),
      (spec) => !HashSet.has(known, spec)
    );
    if (unknown.length > 0) {
      const failing = HashSet.fromIterable(
        proofFailures(yield* prover.prove(main, unknown))
      );
      for (const spec of unknown) {
        yield* Ref.update(
          HashSet.has(failing, spec) ? mainFailing : mainPassing,
          HashSet.add(spec)
        );
      }
    }
    const failing = yield* Ref.get(mainFailing);
    return Arr.filter(failures, (failure) => HashSet.has(failing, failure));
  });

  const attempt = (
    batch: readonly Candidate[]
  ): Effect.Effect<void, TrainError | ProofError> =>
    Effect.gen(function* () {
      const before = yield* Ref.get(accepted);
      const combination = yield* repository.combine(main, [
        ...before,
        ...batch,
      ]);
      const conflicted = HashSet.fromIterable(
        Arr.map(combination.conflicted, (candidate) => candidate.number)
      );
      for (const candidate of batch) {
        if (HashSet.has(conflicted, candidate.number)) {
          yield* reject(
            candidate,
            "conflicts with main or an earlier pull request: merge main into it"
          );
        }
      }
      const riding = Arr.filter(
        batch,
        (candidate) => !HashSet.has(conflicted, candidate.number)
      );
      if (riding.length === 0) {
        return;
      }
      const failures = failuresOf(yield* prover.prove(combination.sha, specs));
      const known = HashSet.fromIterable(yield* onMain(failures));
      const caused = Arr.filter(
        failures,
        (failure) => !HashSet.has(known, failure)
      );
      if (caused.length === 0) {
        yield* Ref.update(accepted, Arr.appendAll(riding));
        return;
      }
      const [only] = riding;
      if (riding.length === 1 && only !== undefined) {
        yield* reject(only, `fails ${Arr.join(caused, ", ")}`);
        return;
      }
      const middle = Math.ceil(riding.length / 2);
      yield* attempt(Arr.take(riding, middle));
      yield* attempt(Arr.drop(riding, middle));
    });

  if (candidates.length > 0) {
    yield* attempt(candidates);
  }
  const landings = yield* Effect.forEach(
    yield* Ref.get(accepted),
    repository.land
  );
  const landed = Arr.flatMap(landings, (landing) =>
    landing._tag === "landed" ? [landing.candidate] : []
  );
  if (landed.length > 0) {
    yield* repository.deploy;
  }
  const report: TrainReport = {
    main,
    landed,
    skipped: Arr.flatMap(landings, (landing) =>
      landing._tag === "skipped"
        ? [{ candidate: landing.candidate, reason: landing.reason }]
        : []
    ),
    rejected: yield* Ref.get(rejected),
    mainFailures: Arr.sort(
      Array.from(yield* Ref.get(mainFailing)),
      Order.String
    ),
  };
  return report;
});

/** The report of one train, one line for each pull request it landed or set aside. */
export function formatTrain(report: TrainReport) {
  const line = (mark: string, candidate: Candidate, reason = "") =>
    `${mark} #${candidate.number} ${candidate.sha.slice(0, 10)} ${candidate.title}${reason === "" ? "" : `: ${reason}`}`;
  return Arr.join(
    [
      `Train on main ${report.main.slice(0, 10)}`,
      ...Arr.map(report.landed, (candidate) => line("landed", candidate)),
      ...Arr.map(report.skipped, ({ candidate, reason }) =>
        line("skipped", candidate, reason)
      ),
      ...Arr.map(report.rejected, ({ candidate, reason }) =>
        line("rejected", candidate, reason)
      ),
      ...Arr.map(report.mainFailures, (spec) => `main fails ${spec}`),
      Option.match(Arr.head(report.landed), {
        onNone: () => "nothing landed, no deploy",
        onSome: () => "one production deploy started",
      }),
      "",
    ],
    "\n"
  );
}
