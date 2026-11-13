import { idOf } from "@repo/backend/confect/island/blocks";
import { footprintOf } from "@repo/backend/confect/island/world";
import { Option } from "effect";
import type { Edit } from "@/lib/island/edits";
import type { castRay } from "@/lib/island/ray";
import { type Cells, cellOf, isInside } from "@/lib/island/world";

/** What a ray met: the block, the cell it hit, and the cell in front of that face. */
type Hit = Option.Option.Value<ReturnType<typeof castRay>>;

const WATER = idOf("water");

/**
 * The edit a press would make (ADR 0047, D5 and D6), none when it would make
 * none: with a block in hand it fills the cell in front of the face it hit, or
 * the water it hit; with the pickaxe (`held` 0) it empties the cell it hit.
 * Every edit stays inside the footprint and above the bedrock row, as the
 * server checks too, and a block placed where the same block stands is no edit.
 */
export function planOf(cells: Cells, hit: Hit, held: number, size: number) {
  const footprint = footprintOf(size);
  const allowed = (cell: readonly [number, number, number]) =>
    isInside(...cell) &&
    cell[1] >= 1 &&
    cell[0] >= footprint.from &&
    cell[0] <= footprint.to &&
    cell[2] >= footprint.from &&
    cell[2] <= footprint.to;
  const cell = held === 0 || hit.block === WATER ? hit.hit : hit.place;
  if (!allowed(cell)) {
    return Option.none();
  }
  const before = cells[cellOf(...cell)];
  if (before === held) {
    return Option.none();
  }
  const edit: Edit = {
    after: held,
    before,
    x: cell[0],
    y: cell[1],
    z: cell[2],
  };
  return Option.some(edit);
}
