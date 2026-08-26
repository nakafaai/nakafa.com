const MAX_VISIBLE_BACTERIA = 100;

export type BacterialFormulaType = "geometric" | "exponential";

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

function getVisibleCount(bacteriaCount: number, bacteriaPerDot: number) {
  return Math.min(
    MAX_VISIBLE_BACTERIA,
    Math.max(1, Math.ceil(bacteriaCount / bacteriaPerDot))
  );
}

/**
 * Builds one truthful bacterial-growth frame.
 *
 * Small cultures render one dot per bacterium. Large cultures use one fixed
 * cohort scale across every frame, so division stays visible without creating
 * an unbounded number of DOM nodes.
 */
export function getBacterialGrowthFrame(input: BacterialGrowthFrameInput) {
  const bacteriaCounts = Array.from(
    { length: input.maxGenerations + 1 },
    (_, generation) => calculateBacteriaCount(input, generation)
  );
  const largestBacteriaCount = Math.max(...bacteriaCounts);
  const bacteriaPerDot =
    largestBacteriaCount > MAX_VISIBLE_BACTERIA
      ? Math.max(
          1,
          Math.round(input.initialCount),
          Math.ceil(largestBacteriaCount / MAX_VISIBLE_BACTERIA)
        )
      : 1;

  const initialVisibleCount = getVisibleCount(
    calculateBacteriaCount(input, 0),
    bacteriaPerDot
  );
  let bacteriaIds = Array.from(
    { length: initialVisibleCount },
    (_, index) => index
  );
  let nextLineageId = bacteriaIds.length;

  for (let generation = 1; generation <= input.generation; generation += 1) {
    const nextVisibleCount = getVisibleCount(
      calculateBacteriaCount(input, generation),
      bacteriaPerDot
    );
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
    bacteriaPerDot,
    gridColumns: Math.min(Math.ceil(Math.sqrt(bacteriaIds.length)), 10),
  };
}
