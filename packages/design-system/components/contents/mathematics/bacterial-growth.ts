import { Schema } from "effect";

const MAX_VISIBLE_BACTERIA = 100;
const NonNegativeIntegerSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
);
const PositiveNumberSchema = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThan(0))
);

export const BacterialFormulaTypeSchema = Schema.Literals([
  "geometric",
  "exponential",
]);
export type BacterialFormulaType = Schema.Schema.Type<
  typeof BacterialFormulaTypeSchema
>;

export const BacterialGrowthFrameInputSchema = Schema.Struct({
  formulaType: BacterialFormulaTypeSchema,
  generation: NonNegativeIntegerSchema,
  initialCount: NonNegativeIntegerSchema,
  maxGenerations: NonNegativeIntegerSchema,
  ratio: PositiveNumberSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter((input) => input.generation <= input.maxGenerations, {
      expected: "generation no greater than maxGenerations",
    })
  )
);
type BacterialGrowthFrameInput = Schema.Schema.Type<
  typeof BacterialGrowthFrameInputSchema
>;
interface BacteriaCountGroup {
  bacteriaCount: number;
  generationCount: number;
}
interface VisibleBacteriaCountGroup extends BacteriaCountGroup {
  visibleCount: number;
}

/**
 * Calculates the population represented by one generation.
 */
function calculateBacteriaCount(
  input: BacterialGrowthFrameInput,
  generation: number
) {
  if (input.formulaType === "exponential") {
    return Math.round(
      input.initialCount * Math.exp(Math.log(input.ratio) * generation)
    );
  }

  return Math.round(input.initialCount * input.ratio ** generation);
}

/**
 * Adds each new daughter immediately after its parent while preserving every
 * existing lineage identifier for Motion layout transitions.
 */
function createNextGeneration(
  bacteriaIds: readonly number[],
  nextVisibleCount: number,
  nextLineageId: number
) {
  if (nextVisibleCount <= bacteriaIds.length) {
    return {
      bacteriaIds: bacteriaIds.slice(0, nextVisibleCount),
      nextLineageId,
    };
  }

  if (bacteriaIds.length === 0) {
    const seededBacteriaIds = Array.from(
      { length: nextVisibleCount },
      (_, index) => nextLineageId + index
    );

    return {
      bacteriaIds: seededBacteriaIds,
      nextLineageId: nextLineageId + seededBacteriaIds.length,
    };
  }

  const daughterCount = nextVisibleCount - bacteriaIds.length;
  const daughtersPerParent = Math.floor(daughterCount / bacteriaIds.length);
  const parentsWithExtraDaughter = daughterCount % bacteriaIds.length;
  const nextBacteriaIds: number[] = [];
  let availableLineageId = nextLineageId;

  for (const [parentIndex, parentId] of bacteriaIds.entries()) {
    nextBacteriaIds.push(parentId);

    const extraDaughter = parentIndex < parentsWithExtraDaughter ? 1 : 0;
    const parentDaughterCount = daughtersPerParent + extraDaughter;

    for (let index = 0; index < parentDaughterCount; index += 1) {
      nextBacteriaIds.push(availableLineageId);
      availableLineageId += 1;
    }
  }

  return {
    bacteriaIds: nextBacteriaIds,
    nextLineageId: availableLineageId,
  };
}

function groupBacteriaCounts(bacteriaCounts: readonly number[]) {
  const groups: BacteriaCountGroup[] = [];

  for (const bacteriaCount of bacteriaCounts) {
    const previousGroup = groups.at(-1);

    if (previousGroup?.bacteriaCount === bacteriaCount) {
      previousGroup.generationCount += 1;
      continue;
    }

    groups.push({ bacteriaCount, generationCount: 1 });
  }

  return groups;
}

function getVisibleBacteriaCounts(
  bacteriaCounts: readonly number[],
  isGrowing: boolean
) {
  const largestBacteriaCount = Math.max(...bacteriaCounts);
  if (largestBacteriaCount <= MAX_VISIBLE_BACTERIA) {
    return [...bacteriaCounts];
  }

  const positiveGenerationGroups: BacteriaCountGroup[] = [];
  let smallestPositiveCount = largestBacteriaCount;
  let zeroGenerationCount = 0;

  for (const group of groupBacteriaCounts(bacteriaCounts)) {
    if (group.bacteriaCount === 0) {
      zeroGenerationCount += group.generationCount;
      continue;
    }

    positiveGenerationGroups.push(group);
    smallestPositiveCount = Math.min(
      smallestPositiveCount,
      group.bacteriaCount
    );
  }

  const ascendingGenerationGroups = isGrowing
    ? positiveGenerationGroups
    : [...positiveGenerationGroups].reverse();
  const scale = isGrowing
    ? smallestPositiveCount
    : largestBacteriaCount / MAX_VISIBLE_BACTERIA;

  const canPreserveEveryDistinctCount =
    ascendingGenerationGroups.length <= MAX_VISIBLE_BACTERIA;
  const ascendingVisibleGroups: VisibleBacteriaCountGroup[] = [];
  let previousVisibleCount = 0;

  for (const [index, group] of ascendingGenerationGroups.entries()) {
    const scaledCount = Math.min(
      MAX_VISIBLE_BACTERIA,
      Math.max(1, Math.round(group.bacteriaCount / scale))
    );

    if (!canPreserveEveryDistinctCount) {
      ascendingVisibleGroups.push({ ...group, visibleCount: scaledCount });
      continue;
    }

    const remainingDistinctCounts =
      ascendingGenerationGroups.length - index - 1;
    const minimumVisibleCount = previousVisibleCount + 1;
    const maximumVisibleCount = MAX_VISIBLE_BACTERIA - remainingDistinctCounts;
    const visibleCount = Math.min(
      maximumVisibleCount,
      Math.max(minimumVisibleCount, scaledCount)
    );

    ascendingVisibleGroups.push({ ...group, visibleCount });
    previousVisibleCount = visibleCount;
  }

  const generationOrderedVisibleGroups = isGrowing
    ? ascendingVisibleGroups
    : [...ascendingVisibleGroups].reverse();
  const positiveVisibleCounts = generationOrderedVisibleGroups.flatMap(
    (group) =>
      Array.from({ length: group.generationCount }, () => group.visibleCount)
  );
  const zeroVisibleCounts = Array.from(
    { length: zeroGenerationCount },
    () => 0
  );

  return isGrowing
    ? [...zeroVisibleCounts, ...positiveVisibleCounts]
    : [...positiveVisibleCounts, ...zeroVisibleCounts];
}

/**
 * Builds one truthful bacterial-growth frame.
 *
 * Small cultures render one dot per bacterium. Large cultures use bounded
 * representative counts that preserve every distinct generation whenever the
 * visual budget can do so.
 */
export function getBacterialGrowthFrame(input: BacterialGrowthFrameInput) {
  const bacteriaCounts = Array.from(
    { length: input.maxGenerations + 1 },
    (_, generation) => calculateBacteriaCount(input, generation)
  );
  const visibleBacteriaCounts = getVisibleBacteriaCounts(
    bacteriaCounts,
    input.ratio >= 1
  );
  const initialVisibleCount = visibleBacteriaCounts[0];
  let bacteriaIds = Array.from(
    { length: initialVisibleCount },
    (_, index) => index
  );
  let nextLineageId = bacteriaIds.length;

  for (let generation = 1; generation <= input.generation; generation += 1) {
    const nextVisibleCount = visibleBacteriaCounts[generation];
    const nextGeneration = createNextGeneration(
      bacteriaIds,
      nextVisibleCount,
      nextLineageId
    );

    bacteriaIds = nextGeneration.bacteriaIds;
    nextLineageId = nextGeneration.nextLineageId;
  }

  return {
    bacteriaCount: calculateBacteriaCount(input, input.generation),
    bacteriaIds,
    gridColumns: Math.max(
      1,
      Math.min(Math.ceil(Math.sqrt(bacteriaIds.length)), 10)
    ),
  };
}
