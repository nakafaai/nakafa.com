import { idOf, opensAt } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, MutableHashMap, Option, Result } from "effect";
import type { Edit } from "@/lib/island/edits";
import { COTTAGE, houseParts } from "@/lib/island/items";
import { KIND, LOOK } from "@/lib/island/look";
import { type Cells, cellOf, SEA_LEVEL } from "@/lib/island/world";

/**
 * The learner's own home (ADR 0047, D17): the village's north-west cottage,
 * and what it grows into as the learner levels up. Each tier keeps the same
 * plot, so an upgrade never pushes into a neighbour.
 */
const HOME_TIERS = [
  { name: "cottage", style: COTTAGE },
  {
    name: "house",
    style: { lower: "plaster", roof: "roof", storeys: 2, upper: "plaster" },
  },
  {
    name: "manor",
    style: { lower: "brick", roof: "slate", storeys: 2, upper: "plaster" },
  },
] as const;

/** The cell the home's walls stand around: the middle of its plot, on the ground row. */
export const HOME = { x: SPAN / 2 - 7, y: SEA_LEVEL + 1, z: SPAN / 2 - 6 };

/** Where the parts of the home's middle stand: its plot is 7 by 6, centered on `HOME`. */
const ORIGIN = { x: 3, z: 3 };

/** Every cell of a tier, in the world, with the block it holds. */
function cellsOfTier(tier: number) {
  return Arr.map(houseParts(HOME_TIERS[tier].style), (part) => ({
    block: idOf(part.block),
    x: HOME.x + part.x - ORIGIN.x,
    y: HOME.y + part.y,
    z: HOME.z + part.z - ORIGIN.z,
  }));
}

/** The tier the home stands at now, read from its walls: a second storey, and brick under it. */
export function tierOf(cells: Cells) {
  const corner =
    cells[cellOf(HOME.x - ORIGIN.x, HOME.y + 3, HOME.z - ORIGIN.z)];
  if (corner !== idOf("log")) {
    return 0;
  }
  const wall = cells[cellOf(HOME.x - ORIGIN.x + 2, HOME.y, HOME.z - ORIGIN.z)];
  return wall === idOf("brick") ? 2 : 1;
}

/** The level that opens a tier: the latest level of any of its blocks. */
export function tierOpensAt(tier: number) {
  return Arr.reduce(houseParts(HOME_TIERS[tier].style), 1, (level, part) =>
    Math.max(level, opensAt(part.block))
  );
}

/**
 * The edits that raise the home to its next tier (ADR 0047, D17): every cell
 * of the new tier is built, and every cell of the old one it no longer needs
 * is emptied, as one step undo takes back. Refused at the top tier, before the
 * level that opens the next one, or when something the learner built stands
 * where the new walls go.
 */
export function upgradeOf(cells: Cells, level: number) {
  const tier = tierOf(cells);
  if (tier >= HOME_TIERS.length - 1) {
    return Result.fail("top" as const);
  }
  if (tierOpensAt(tier + 1) > level) {
    return Result.fail("locked" as const);
  }
  const old = MutableHashMap.empty<number, number>();
  for (const cell of cellsOfTier(tier)) {
    MutableHashMap.set(old, cellOf(cell.x, cell.y, cell.z), cell.block);
  }
  const next = cellsOfTier(tier + 1);
  const wanted = MutableHashMap.empty<number, number>();
  for (const cell of next) {
    MutableHashMap.set(wanted, cellOf(cell.x, cell.y, cell.z), cell.block);
  }
  const blocked = Arr.some(next, (cell) => {
    const there = cells[cellOf(cell.x, cell.y, cell.z)];
    return (
      there !== 0 &&
      LOOK.kinds[there] !== KIND.cross &&
      !MutableHashMap.has(old, cellOf(cell.x, cell.y, cell.z))
    );
  });
  if (blocked) {
    return Result.fail("room" as const);
  }
  const built = Arr.filterMap(next, (cell: (typeof next)[number]) => {
    const before = cells[cellOf(cell.x, cell.y, cell.z)];
    return before === cell.block
      ? Result.failVoid
      : Result.succeed<Edit>({
          after: cell.block,
          before,
          x: cell.x,
          y: cell.y,
          z: cell.z,
        });
  });
  const cleared = Arr.filterMap(cellsOfTier(tier), (cell) => {
    const key = cellOf(cell.x, cell.y, cell.z);
    return MutableHashMap.has(wanted, key) || cells[key] !== cell.block
      ? Result.failVoid
      : Result.succeed<Edit>({
          after: 0,
          before: cell.block,
          x: cell.x,
          y: cell.y,
          z: cell.z,
        });
  });
  return Result.succeed({
    edits: Arr.appendAll(cleared, built),
    tier: tier + 1,
  });
}

/** The tier after the home's own and its name, none at the top. */
export function nextTierOf(cells: Cells) {
  const tier = tierOf(cells) + 1;
  return tier < HOME_TIERS.length
    ? Option.some({ name: HOME_TIERS[tier].name, tier })
    : Option.none();
}
