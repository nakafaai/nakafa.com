import {
  Array as Arr,
  Context,
  Effect,
  HashSet,
  Option,
  Order,
  Record as Rec,
  Ref,
  Schema,
  Semaphore,
} from "effect";
import { failuresOf, makeBaseline } from "#scripts/proof/baseline";
import type { ProofError } from "#scripts/proof/client";
import { Prover } from "#scripts/proof/github";

/** A pull request that may ride the train: its number, the exact head its own proof passed, and its title. */
export const Candidate = Schema.Struct({
  number: Schema.Int,
  /** The stack it belongs to, named by the number of the pull request at its bottom. */
  stack: Schema.Int,
  sha: Schema.String,
  title: Schema.String,
  /** The spec files the pull request adds or changes, which its combination is proven on. */
  specs: Schema.Array(Schema.String),
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
    /**
     * Every open pull request that may ride a batch, whatever its own gate and
     * proof say: each stack whole, bottom-up, oldest stack first.
     */
    readonly ready: (
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

/** The failure of a combination whose gate failed, which no spec on main can share. */
const GATE_FAILURE = "gate:combination";

/** The failure of a batch that an earlier train already verified red. */
const RED_BATCH = "batch:red";

/**
 * The specs a combination is proven on: those the caller names and those its
 * pull requests add or change. None at all proves every suite, which a batch of
 * changes that touch no spec needs.
 */
const proofSpecs = (
  specs: readonly string[],
  heads: readonly Candidate[]
): readonly string[] =>
  Arr.sort(
    Arr.dedupe([...specs, ...Arr.flatMap(heads, (head) => head.specs)]),
    Order.String
  );

/**
 * Lands pull requests after one gate and one proof of their combination on
 * main: those whose own gate and proof passed, or with `batch` every ready one,
 * each stack whole. A failing spec that fails on main too belongs to main: the
 * train reports it and ignores it. Any other failure, a failed gate included,
 * splits the batch. A batch of several stacks verifies every stack on its own,
 * side by side, so a split costs one wait in the runner queue, not one for each
 * half; the stacks that passed are verified together once more, and a failing
 * stack splits in halves. Everything is verified on top of what the train
 * already accepted, so what lands is always one gated and proven combination,
 * and each pull request lands by its exact head.
 */
export const runTrain = Effect.fn("landing.runTrain")(function* (
  numbers: readonly number[],
  specs: readonly string[],
  batch: boolean,
  red: boolean
) {
  const repository = yield* Repository;
  const prover = yield* Prover;
  const main = yield* repository.main;
  const candidates = yield* batch
    ? repository.ready(numbers)
    : repository.proven(numbers);
  const accepted = yield* Ref.make<readonly Candidate[]>([]);
  const rejected = yield* Ref.make<readonly Rejection[]>([]);
  const baseline = yield* makeBaseline(main);
  // Stacks verified side by side ask main about their failures one at a time,
  // so main proves each spec once.
  const asking = yield* Semaphore.make(1);

  const reject = (candidate: Candidate, reason: string) =>
    Ref.update(rejected, Arr.append({ candidate, reason }));
  const accept = (riding: readonly Candidate[]) =>
    Ref.update(accepted, Arr.appendAll(riding));

  /**
   * Verifies heads on main above what the train accepted, in one job. Answers
   * the heads that conflicted, the heads that rode, and the failures that main
   * does not share.
   */
  const check = (heads: readonly Candidate[]) =>
    Effect.gen(function* () {
      const before = yield* Ref.get(accepted);
      const combination = yield* repository.combine(main, [
        ...before,
        ...heads,
      ]);
      const conflicted = HashSet.fromIterable(
        Arr.map(combination.conflicted, (candidate) => candidate.number)
      );
      const riding = Arr.filter(
        heads,
        (candidate) => !HashSet.has(conflicted, candidate.number)
      );
      const verdict = {
        conflicted: combination.conflicted,
        riding,
        caused: Arr.empty<string>(),
      };
      if (riding.length === 0) {
        return verdict;
      }
      // One job gates and proves the combination: it holds every head merged
      // with main, which is what lands.
      const { result, gated } = yield* prover.verify(
        combination.sha,
        proofSpecs(specs, [...before, ...riding])
      );
      const failures = [
        ...failuresOf(result),
        ...(gated ? [] : [GATE_FAILURE]),
      ];
      const known = HashSet.fromIterable(
        yield* asking.withPermit(baseline.shared(failures))
      );
      return {
        ...verdict,
        caused: Arr.filter(failures, (failure) => !HashSet.has(known, failure)),
      };
    });

  /** Sets aside the heads that conflicted. */
  const rejectConflicts = (conflicted: readonly Candidate[]) =>
    Effect.forEach(conflicted, (candidate) =>
      reject(
        candidate,
        "conflicts with main or an earlier pull request: merge main into it"
      )
    );

  const attempt = (
    heads: readonly Candidate[]
  ): Effect.Effect<void, TrainError | ProofError> =>
    Effect.gen(function* () {
      const { conflicted, riding, caused } = yield* check(heads);
      yield* rejectConflicts(conflicted);
      if (caused.length === 0) {
        return yield* accept(riding);
      }
      yield* split(riding, caused);
    });

  /** Finds what failed in heads that failed together. */
  const split = (
    riding: readonly Candidate[],
    caused: readonly string[]
  ): Effect.Effect<void, TrainError | ProofError> =>
    Effect.gen(function* () {
      if (riding.length === 1) {
        return yield* Effect.forEach(riding, (candidate) =>
          reject(candidate, `fails ${Arr.join(caused, ", ")}`)
        );
      }
      const stacks = Rec.values(
        Arr.groupBy(riding, (candidate) => String(candidate.stack))
      );
      if (stacks.length === 1) {
        const middle = Math.ceil(riding.length / 2);
        yield* attempt(Arr.take(riding, middle));
        return yield* attempt(Arr.drop(riding, middle));
      }
      const verdicts = yield* Effect.forEach(stacks, check, {
        concurrency: "unbounded",
      });
      yield* Effect.forEach(verdicts, (verdict) =>
        rejectConflicts(verdict.conflicted)
      );
      const passing = Arr.filter(
        verdicts,
        (verdict) => verdict.caused.length === 0
      );
      // When every stack passed on its own, they already failed together.
      yield* together(
        Arr.map(passing, (verdict) => verdict.riding),
        passing.length < stacks.length
      );
      yield* Effect.forEach(
        Arr.filter(verdicts, (verdict) => verdict.caused.length > 0),
        (verdict) => split(verdict.riding, verdict.caused)
      );
    });

  /**
   * Accepts stacks that passed on their own, after one more job verifies them
   * together unless they already failed together. When they pass alone and fail
   * together, the first is accepted and each other one is verified on top of it,
   * one at a time.
   */
  const together = (
    stacks: readonly (readonly Candidate[])[],
    untried: boolean
  ) =>
    Effect.gen(function* () {
      const [first, ...rest] = stacks;
      if (first === undefined) {
        return;
      }
      if (rest.length === 0) {
        return yield* accept(first);
      }
      if (untried) {
        const { conflicted, riding, caused } = yield* check(
          Arr.flatten(stacks)
        );
        if (caused.length === 0) {
          yield* rejectConflicts(conflicted);
          return yield* accept(riding);
        }
      }
      yield* accept(first);
      yield* Effect.forEach(rest, attempt);
    });

  if (candidates.length > 0) {
    // A batch that `red` says already failed together starts at its split.
    yield* red && candidates.length > 1
      ? split(candidates, [RED_BATCH])
      : attempt(candidates);
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
    mainFailures: yield* baseline.failing,
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
