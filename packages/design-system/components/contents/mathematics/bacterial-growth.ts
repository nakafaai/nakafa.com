import { Schema } from "effect";

const MAX_VISIBLE_BACTERIA = 100;

export const BacterialFormulaTypeSchema = Schema.Literals([
  "geometric",
  "exponential",
]);
export type BacterialFormulaType = Schema.Schema.Type<
  typeof BacterialFormulaTypeSchema
>;

interface BacterialGrowthFrameInput {
  formulaType: BacterialFormulaType;
  generation: number;
  initialCount: number;
  maxGenerations: number;
  ratio: number;
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

function getVisibleBacteriaCounts(
  bacteriaCounts: readonly number[],
  isGrowing: boolean
) {
  const largestBacteriaCount = Math.max(...bacteriaCounts);
  if (largestBacteriaCount <= MAX_VISIBLE_BACTERIA) {
    return [...bacteriaCounts];
  }

  const positiveBacteriaCounts = [
    ...new Set(bacteriaCounts.filter((count) => count > 0)),
  ].sort((left, right) => left - right);
  const smallestPositiveCount = positiveBacteriaCounts[0];
  const scale = isGrowing
    ? smallestPositiveCount
    : largestBacteriaCount / MAX_VISIBLE_BACTERIA;

  return bacteriaCounts.map((bacteriaCount) => {
    if (bacteriaCount === 0) {
      return 0;
    }

    const rank = positiveBacteriaCounts.indexOf(bacteriaCount) + 1;
    const remainingDistinctCounts = positiveBacteriaCounts.length - rank;
    const minimumVisibleCount = Math.min(rank, MAX_VISIBLE_BACTERIA);
    const maximumVisibleCount = Math.max(
      1,
      MAX_VISIBLE_BACTERIA - remainingDistinctCounts
    );
    const scaledCount = Math.max(1, Math.round(bacteriaCount / scale));
    const lowerVisibleCount = Math.min(
      minimumVisibleCount,
      maximumVisibleCount
    );
    const upperVisibleCount = Math.max(
      minimumVisibleCount,
      maximumVisibleCount
    );

    return Math.min(
      upperVisibleCount,
      Math.max(lowerVisibleCount, scaledCount)
    );
  });
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
