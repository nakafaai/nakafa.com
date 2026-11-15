import {
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
  Record as Rec,
  Ref,
  Result,
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
  /** The head of the stack member below it, which its proof ran on top of; empty for a pull request on main. */
  below: Schema.String,
  /** Whether it changes a file the product runs, under `apps` or `packages`, beyond specs and docs. */
  runtime: Schema.Boolean,
});
export type Candidate = typeof Candidate.Type;

/** A named pull request the train did not seat, and what to do about it, so a train that takes nothing says why. */
export const Refusal = Schema.Struct({
  number: Schema.Int,
  reason: Schema.String,
});

/** The pull requests a train may take, and each named one it may not. */
export const Seats = Schema.Struct({
  candidates: Schema.Array(Candidate),
  refused: Schema.Array(Refusal),
});
export type Seats = typeof Seats.Type;

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
    ) => Effect.Effect<Seats, TrainError>;
    /**
     * Every open pull request that may ride a batch: each stack whole,
     * bottom-up, oldest stack first, whose top's own gate passed on a head that
     * contains main's tip and carries the members below it. Its own proof is
     * not asked for, since the batch proves the combination.
     */
    readonly ready: (
      numbers: readonly number[]
    ) => Effect.Effect<Seats, TrainError>;
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

/** A spec that failed on a combination and passed when it ran again alone on the same one. */
const Flake = Schema.Struct({ spec: Schema.String, sha: Schema.String });

/**
 * What one train did. Main's failures are specs that fail on main too, which it
 * ignored; flakes are specs that failed once and passed again on the same
 * combination, which it recorded and let ride.
 */
const TrainReport = Schema.Struct({
  main: Schema.String,
  landed: Schema.Array(Candidate),
  skipped: Schema.Array(Rejection),
  rejected: Schema.Array(Rejection),
  refused: Schema.Array(Refusal),
  mainFailures: Schema.Array(Schema.String),
  flaky: Schema.Array(Flake),
});

const isSpec = Schema.is(SpecPath);
type TrainReport = typeof TrainReport.Type;

/** The failure of a combination whose gate failed, which no spec on main can share. */
const GATE_FAILURE = "gate:combination";

/**
 * How many stacks of a red batch the train verifies at once. The account runs
 * about 20 jobs at a time across both repositories, and each verification takes
 * four of them, the gate and one job per engine, so four stacks take 16 and
 * leave the rest to Aksara's gates, the sessions' gates and the deploy.
 */
const SPLIT_JOBS = 4;

/** The failure of a batch that an earlier train already verified red. */
const RED_BATCH = "batch:red";

/**
 * The one spec a combination that changes nothing the product runs is proven
 * on, such as a change to the landing scripts, a workflow or the docs: a fast
 * page that passes in all three engines on main (run 43699251319).
 */
const SMOKE_SPEC = "e2e/quran/landing.browser.ts";

/**
 * The specs a combination is proven on: those the caller names and those its
 * pull requests add or change. A combination that names none proves every
 * suite when a pull request changes a file the product runs, and only the
 * smoke spec when none does, since the gate already checks scripts and docs.
 */
const proofSpecs = (
  specs: readonly string[],
  heads: readonly Candidate[]
): readonly string[] => {
  const named = Arr.sort(
    Arr.dedupe([...specs, ...Arr.flatMap(heads, (head) => head.specs)]),
    Order.String
  );
  if (named.length > 0 || Arr.some(heads, (head) => head.runtime)) {
    return named;
  }
  return [SMOKE_SPEC];
};

/**
 * The most pull requests one batch carries (ADR 0048, "The Landing Queue"): at a
 * failure rate of one in ten per pull request, five pass together more often
 * than not, while 13 pass a quarter of the time.
 */
const BATCH_LIMIT = 5;

/**
 * The pull requests one batch takes, in landing order: whole stacks while the
 * batch stays within the limit, filling it with later stacks that still fit;
 * a first stack longer than the limit rides alone.
 */
const batchOf = (candidates: readonly Candidate[]): readonly Candidate[] =>
  Arr.match(candidates, {
    onEmpty: () => Arr.empty<Candidate>(),
    onNonEmpty: (all) => {
      const [first, ...rest] = Arr.groupWith(
        all,
        (one, other) => one.stack === other.stack
      );
      return Arr.reduce(
        rest,
        Arr.fromIterable<Candidate>(first),
        (taken, stack) =>
          taken.length + stack.length <= BATCH_LIMIT
            ? Arr.appendAll(taken, stack)
            : taken
      );
    },
  });

/**
 * Lands pull requests after one gate and one proof of their combination on
 * main: those whose own gate and proof passed, or with `batch` at most five,
 * each stack whole, whose top's own gate passed on a head that contains main.
 * A failing spec that fails on main too belongs to main: the train reports it
 * and ignores it. Any other failure, a failed gate included,
 * splits the batch. A batch of several stacks verifies every stack on its own,
 * side by side, so a split costs one wait in the runner queue, not one for each
 * half; the stacks that passed are verified together once more, and a failing
 * stack splits in halves. Each green group lands at once, by each exact head,
 * and deploys, and everything after it is verified on top of what landed, so
 * what lands is always one gated and proven combination.
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
  const seats = batch
    ? yield* repository.ready(numbers)
    : yield* repository.proven(numbers);
  const candidates = batch ? batchOf(seats.candidates) : seats.candidates;
  // A named pull request that a full batch leaves out rides the next one.
  const waiting = Arr.filterMap(seats.candidates, (candidate) =>
    Arr.contains(numbers, candidate.number) &&
    !Arr.some(candidates, (one) => one.number === candidate.number)
      ? Result.succeed({
          number: candidate.number,
          reason: "the batch is full: it rides the next one",
        })
      : Result.failVoid
  );
  const accepted = yield* Ref.make<readonly Candidate[]>([]);
  const landings = yield* Ref.make<readonly Landing[]>([]);
  const rejected = yield* Ref.make<readonly Rejection[]>([]);
  const flakes = yield* Ref.make<readonly (typeof Flake.Type)[]>([]);

  /**
   * The failing specs that pass when they run again alone on the same
   * combination: flaky, so they are recorded with the combination they flaked
   * on and reject nothing, while every one that fails again stays a failure. A
   * failed gate or a proof that named no spec never runs again. No spec is
   * skipped or deleted for it; the report names each flake for its owner.
   */
  const flakyOf = (sha: string, failures: readonly string[]) =>
    Effect.gen(function* () {
      const specs = Arr.filter(failures, isSpec);
      if (specs.length === 0) {
        return Arr.empty<string>();
      }
      const again = proofFailures(yield* prover.prove(sha, specs));
      const flaky = Arr.filter(specs, (spec) => !Arr.contains(again, spec));
      yield* Ref.update(
        flakes,
        Arr.appendAll(Arr.map(flaky, (spec) => ({ spec, sha })))
      );
      return flaky;
    });
  const baseline = yield* makeBaseline(main);
  // Stacks verified side by side ask main about their failures one at a time,
  // so main proves each spec once.
  const asking = yield* Semaphore.make(1);

  const reject = (candidate: Candidate, reason: string) =>
    Ref.update(rejected, Arr.append({ candidate, reason }));
  /**
   * Lands a verified group at once, by each exact head, and deploys it, so a
   * green group never waits for the rest of the train. Only what landed joins
   * the base of the next verification.
   */
  const accept = (riding: readonly Candidate[]) =>
    Effect.gen(function* () {
      const group = yield* Effect.forEach(riding, repository.land);
      yield* Ref.update(landings, Arr.appendAll(group));
      const landed = Arr.flatMap(group, (landing) =>
        landing._tag === "landed" ? [landing.candidate] : []
      );
      yield* Ref.update(accepted, Arr.appendAll(landed));
      if (landed.length > 0) {
        yield* Effect.logInfo(
          `Landed ${Arr.join(
            Arr.map(landed, (candidate) => `#${candidate.number}`),
            " "
          )}; deploying.`
        );
        yield* repository.deploy;
      }
    });

  /**
   * Verifies heads on main above what the train accepted, in one run. Answers
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
      const fresh = Arr.filter(
        failures,
        (failure) => !HashSet.has(known, failure)
      );
      const flaky = yield* flakyOf(combination.sha, fresh);
      return {
        ...verdict,
        caused: Arr.filter(fresh, (failure) => !Arr.contains(flaky, failure)),
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
        concurrency: SPLIT_JOBS,
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
  const all = yield* Ref.get(landings);
  const report: TrainReport = {
    main,
    landed: Arr.flatMap(all, (landing) =>
      landing._tag === "landed" ? [landing.candidate] : []
    ),
    skipped: Arr.flatMap(all, (landing) =>
      landing._tag === "skipped"
        ? [{ candidate: landing.candidate, reason: landing.reason }]
        : []
    ),
    rejected: yield* Ref.get(rejected),
    refused: Arr.appendAll(seats.refused, waiting),
    mainFailures: yield* baseline.failing,
    flaky: yield* Ref.get(flakes),
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
      ...Arr.map(
        report.refused,
        ({ number, reason }) => `refused #${number}: ${reason}`
      ),
      ...Arr.map(report.mainFailures, (spec) => `main fails ${spec}`),
      ...Arr.map(
        report.flaky,
        ({ spec, sha }) =>
          `flaky ${spec} on ${sha.slice(0, 10)}: failed, then passed when it ran again alone`
      ),
      Option.match(Arr.head(report.landed), {
        onNone: () => "nothing landed, no deploy",
        onSome: () => "each landed group deployed",
      }),
      "",
    ],
    "\n"
  );
}
