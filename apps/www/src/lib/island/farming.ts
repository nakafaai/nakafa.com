import { idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, MutableHashMap, Option } from "effect";
import type { Edit } from "@/lib/island/edits";
import { KIND, LOOK } from "@/lib/island/look";
import { blockAt, type Cells } from "@/lib/island/world";

/** Every field crop a learner may sow, and the sprout it starts as (ADR 0047, D16). */
const CROPS = [
  ["rice", "rice-sprout"],
  ["corn", "corn-sprout"],
  ["cabbage", "cabbage-sprout"],
  ["tomato", "tomato-sprout"],
  ["chili", "chili-sprout"],
  ["carrot", "carrot-sprout"],
  ["cassava", "cassava-sprout"],
  ["sweet-potato", "sweet-potato-sprout"],
] as const;

/** How many seconds of play a watered sprout takes to ripen. */
export const GROW = 40;

const FARMLAND = idOf("farmland");
const WET = idOf("wet-farmland");
const TILLABLE = [idOf("grass"), idOf("dirt")];

/** One cell set to a block, as an edit from what it holds now. */
function edit(
  cells: Cells,
  at: readonly [number, number, number],
  block: number
): Edit {
  return {
    after: block,
    before: blockAt(cells, at[0], at[1], at[2]),
    x: at[0],
    y: at[1],
    z: at[2],
  };
}

/** Whether a cell is free for a crop to stand in: air, or a wild plant the hoe clears. */
function isOpenAbove(cells: Cells, x: number, y: number, z: number) {
  return (
    y + 1 < HEIGHT && LOOK.kinds[blockAt(cells, x, y + 1, z)] !== KIND.solid
  );
}

/** The crop a block is, ripe, or none. */
export function cropOf(block: number) {
  return Arr.findFirst(CROPS, ([crop]) => idOf(crop) === block);
}

/** The crop a sprout grows into, none for any other block. */
function grownOf(block: number) {
  return Option.map(
    Arr.findFirst(CROPS, ([, sprout]) => idOf(sprout) === block),
    ([crop]) => crop
  );
}

/**
 * The edits the hoe makes at a cell (ADR 0047, D16): it harvests a ripe crop
 * standing on farmland, or tills grass or dirt with room above into farmland,
 * clearing a wild plant there. None for anything else.
 */
export function hoeOf(cells: Cells, at: readonly [number, number, number]) {
  const [x, y, z] = at;
  const block = blockAt(cells, x, y, z);
  const below = blockAt(cells, x, y - 1, z);
  if (Option.isSome(cropOf(block)) && (below === FARMLAND || below === WET)) {
    return Option.some([edit(cells, at, 0)]);
  }
  if (!(Arr.contains(TILLABLE, block) && isOpenAbove(cells, x, y, z))) {
    return Option.none();
  }
  const above = blockAt(cells, x, y + 1, z);
  const clear = above === 0 ? [] : [edit(cells, [x, y + 1, z], 0)];
  return Option.some(Arr.prepend(clear, edit(cells, at, FARMLAND)));
}

/** The edit the watering can makes at a cell: dry farmland, or the farmland under a sprout, turns wet. */
export function waterOf(cells: Cells, at: readonly [number, number, number]) {
  const [x, y, z] = at;
  const soil: readonly [number, number, number] = Option.isSome(
    grownOf(blockAt(cells, x, y, z))
  )
    ? [x, y - 1, z]
    : at;
  return blockAt(cells, soil[0], soil[1], soil[2]) === FARMLAND
    ? Option.some(edit(cells, soil, WET))
    : Option.none();
}

/** The block a placed crop becomes: its sprout when sown on farmland, itself anywhere else. */
export function sownOf(
  cells: Cells,
  at: readonly [number, number, number],
  block: number
) {
  const below = blockAt(cells, at[0], at[1] - 1, at[2]);
  if (below !== FARMLAND && below !== WET) {
    return block;
  }
  return Option.match(cropOf(block), {
    onNone: () => block,
    onSome: ([, sprout]) => idOf(sprout),
  });
}

/**
 * The edits a sprout makes once it has grown for `GROW` seconds on wet
 * farmland: it ripens into its crop and the soil under it dries. None while it
 * is still growing, or when its soil is dry.
 */
export function ripenOf(
  cells: Cells,
  at: readonly [number, number, number],
  seconds: number
) {
  const [x, y, z] = at;
  return Option.flatMap(grownOf(blockAt(cells, x, y, z)), (crop) =>
    blockAt(cells, x, y - 1, z) === WET && seconds >= GROW
      ? Option.some([
          edit(cells, at, idOf(crop)),
          edit(cells, [x, y - 1, z], FARMLAND),
        ])
      : Option.none()
  );
}

/** Whether a block is a sprout still growing. */
function isSprout(block: number) {
  return Option.isSome(grownOf(block));
}

/**
 * Every sprout of the world that ripens at `seconds` of play, as edits:
 * `planted` keeps when each sprout was first seen, and forgets the ones that
 * ripen. A sprout grows only while the game is open (ADR 0047, D16).
 */
export function ripeningOf(
  cells: Cells,
  planted: MutableHashMap.MutableHashMap<number, number>,
  seconds: number
) {
  let ripe: readonly Edit[] = [];
  for (let index = 0; index < cells.length; index += 1) {
    if (!isSprout(cells[index])) {
      continue;
    }
    const found = MutableHashMap.get(planted, index);
    const since = Option.isSome(found) ? found.value : seconds;
    if (Option.isNone(found)) {
      MutableHashMap.set(planted, index, seconds);
    }
    const at = [
      index % SPAN,
      Math.floor(index / (SPAN * SPAN)),
      Math.floor(index / SPAN) % SPAN,
    ] as const;
    const grown = ripenOf(cells, at, seconds - since);
    if (Option.isSome(grown)) {
      ripe = Arr.appendAll(ripe, grown.value);
      MutableHashMap.remove(planted, index);
    }
  }
  return ripe;
}
