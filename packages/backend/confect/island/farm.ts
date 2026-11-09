/**
 * The farm of the island game as blocks (ADR 0047, D16): tilled soil, the same
 * soil watered, and a sprout of every field crop a learner may sow, each
 * stored by its own id after the plants. A sprout grows into its crop's own
 * plant block. An id is never reused or changed.
 */
export const FARM = {
  farmland: { id: 140, opens: 1 },
  "wet-farmland": { id: 141, opens: 1 },
  "rice-sprout": { id: 142, opens: 1 },
  "corn-sprout": { id: 143, opens: 1 },
  "cabbage-sprout": { id: 144, opens: 1 },
  "tomato-sprout": { id: 145, opens: 1 },
  "chili-sprout": { id: 146, opens: 1 },
  "carrot-sprout": { id: 147, opens: 1 },
  "cassava-sprout": { id: 148, opens: 1 },
  "sweet-potato-sprout": { id: 149, opens: 1 },
} as const;

/** Every farm block, in the order of its id. */
export const FARM_KEYS = [
  "farmland",
  "wet-farmland",
  "rice-sprout",
  "corn-sprout",
  "cabbage-sprout",
  "tomato-sprout",
  "chili-sprout",
  "carrot-sprout",
  "cassava-sprout",
  "sweet-potato-sprout",
] as const;
