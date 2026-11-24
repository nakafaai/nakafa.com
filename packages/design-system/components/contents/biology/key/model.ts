import { Array as Arr, Match, Option, Schema } from "effect";

const KeyAnimalSchema = Schema.Literals([
  "ant",
  "dragonfly",
  "spider",
  "centipede",
  "earthworm",
  "snail",
]);
export type KeyAnimal = typeof KeyAnimalSchema.Type;

const CoupletIdSchema = Schema.Literals([
  "legs",
  "pairs",
  "wings",
  "segments",
  "shell",
  "size",
  "colour",
  "overlap",
]);
export type CoupletId = typeof CoupletIdSchema.Type;

const BranchOutcomeSchema = Schema.Literals(["a", "b", "both", "neither"]);
type BranchOutcome = typeof BranchOutcomeSchema.Type;

const PathSideSchema = Schema.Literals(["a", "b"]);

const PendingGroupSchema = Schema.Struct({
  members: Schema.Array(KeyAnimalSchema),
  path: Schema.Array(PathSideSchema),
});
type PendingGroup = typeof PendingGroupSchema.Type;

const AnimalResultSchema = Schema.Struct({
  animal: KeyAnimalSchema,
  path: Schema.Array(PathSideSchema),
  status: Schema.Literals(["reached", "jammed", "grouped"]),
  step: Schema.Int,
});
export type AnimalResult = typeof AnimalResultSchema.Type;

const KeyEvaluationSchema = Schema.Struct({
  allSorted: Schema.Boolean,
  failedStep: Schema.Option(Schema.Int),
  reachedCount: Schema.Int,
  results: Schema.Array(AnimalResultSchema),
});
export type KeyEvaluation = typeof KeyEvaluationSchema.Type;

/** Evaluates how one animal responds to a dichotomous key couplet. */
export function testCouplet(
  animal: KeyAnimal,
  couplet: CoupletId
): BranchOutcome {
  return Match.value(couplet).pipe(
    Match.when(
      "legs",
      (): BranchOutcome =>
        animal === "earthworm" || animal === "snail" ? "b" : "a"
    ),
    Match.when("pairs", (): BranchOutcome => {
      if (animal === "ant" || animal === "dragonfly") {
        return "a";
      }
      if (animal === "spider" || animal === "centipede") {
        return "b";
      }
      return "neither";
    }),
    Match.when(
      "wings",
      (): BranchOutcome => (animal === "dragonfly" ? "a" : "b")
    ),
    Match.when("segments", (): BranchOutcome => {
      if (animal === "spider") {
        return "a";
      }
      if (animal === "centipede") {
        return "b";
      }
      return "neither";
    }),
    Match.when("shell", (): BranchOutcome => (animal === "snail" ? "a" : "b")),
    Match.when("size", (): BranchOutcome => "both"),
    Match.when("colour", (): BranchOutcome => "both"),
    Match.when("overlap", (): BranchOutcome => {
      if (animal === "dragonfly") {
        return "both";
      }
      if (animal === "ant") {
        return "b";
      }
      return "neither";
    }),
    Match.exhaustive
  );
}

/**
 * Picks initial step couplets from the available list, using one fewer step
 * than the number of animals shown.
 */
export function initialSteps(
  animals: readonly KeyAnimal[],
  couplets: readonly [CoupletId, ...CoupletId[]]
): readonly CoupletId[] {
  const stepCount = Math.max(1, animals.length - 1);
  return Arr.makeBy(stepCount, (index) =>
    Arr.getUnsafe(couplets, index % couplets.length)
  );
}

const BranchSettlementSchema = Schema.Struct({
  next: Schema.Array(PendingGroupSchema),
  settled: Schema.Array(AnimalResultSchema),
});

function settleBranch(
  members: readonly KeyAnimal[],
  path: readonly ("a" | "b")[],
  step: number
): typeof BranchSettlementSchema.Type {
  if (members.length === 1) {
    return {
      next: [],
      settled: [{ animal: members[0], path, status: "reached", step }],
    };
  }
  return {
    next: [{ members, path }],
    settled: [],
  };
}

/**
 * Runs every animal through the learner's sequence of couplet steps. At each
 * step, the first pending group with at least two animals is split by that
 * step's couplet. Any animal that matches both statements or neither jams that
 * step; any animal left alone in a leaf reaches its own name.
 */
export function evaluateKey(
  animals: readonly KeyAnimal[],
  steps: readonly CoupletId[]
): KeyEvaluation {
  let queue: readonly PendingGroup[] = [{ members: animals, path: [] }];
  let settled: readonly AnimalResult[] = [];
  let failedStep: Option.Option<number> = Option.none();

  for (const [stepIndex, couplet] of Arr.map(
    steps,
    (entry, index) => [index, entry] as const
  )) {
    const splitIndex = Arr.findFirstIndex(
      queue,
      (group) => group.members.length > 1
    );
    if (Option.isNone(splitIndex)) {
      break;
    }
    const target = queue[splitIndex.value];
    const remainingQueue = Arr.filter(
      queue,
      (_group, idx) => idx !== splitIndex.value
    );
    const branchA = Arr.filter(
      target.members,
      (animal) => testCouplet(animal, couplet) === "a"
    );
    const branchB = Arr.filter(
      target.members,
      (animal) => testCouplet(animal, couplet) === "b"
    );
    const hasJam =
      branchA.length + branchB.length < target.members.length ||
      branchA.length === 0 ||
      branchB.length === 0;

    if (hasJam) {
      failedStep = Option.orElse(failedStep, () => Option.some(stepIndex + 1));
      settled = Arr.appendAll(
        settled,
        Arr.map(target.members, (animal) => ({
          animal,
          path: target.path,
          status: "jammed" as const,
          step: stepIndex + 1,
        }))
      );
      queue = remainingQueue;
      continue;
    }

    const left = settleBranch(branchA, [...target.path, "a"], stepIndex + 1);
    const right = settleBranch(branchB, [...target.path, "b"], stepIndex + 1);
    settled = Arr.appendAll(
      settled,
      Arr.appendAll(left.settled, right.settled)
    );
    queue = Arr.appendAll(Arr.appendAll(left.next, right.next), remainingQueue);
  }

  for (const group of queue) {
    const status = group.members.length === 1 ? "reached" : "grouped";
    if (status === "grouped" && Option.isNone(failedStep)) {
      failedStep = Option.some(steps.length);
    }
    settled = Arr.appendAll(
      settled,
      Arr.map(group.members, (animal) => ({
        animal,
        path: group.path,
        status,
        step: steps.length,
      }))
    );
  }

  const ordered = Arr.getSomes(
    Arr.map(animals, (animal) =>
      Arr.findFirst(settled, (entry) => entry.animal === animal)
    )
  );
  const reachedCount = Arr.filter(
    ordered,
    (entry) => entry.status === "reached"
  ).length;

  return {
    allSorted: reachedCount === animals.length && Option.isNone(failedStep),
    failedStep,
    reachedCount,
    results: ordered,
  };
}
