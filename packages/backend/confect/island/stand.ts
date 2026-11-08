import { footprintOf, kindOf } from "@repo/backend/confect/island/item";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Option, Schema } from "effect";

/** Why a placement cannot stand where it is. */
export const StandRefusal = Schema.Literals([
  "outside",
  "overlap",
  "unsupported",
]);

/** A cell named by its first footprint cell: east, south, and layer. */
type At = Pick<Placement, "x" | "y" | "z">;

/** The layers a placement claims in its footprint: a block its own layer, anything else every layer from its own up. */
function claims(placement: Pick<Placement, "item" | "z">, z: number) {
  return kindOf(placement.item) === "block"
    ? z === placement.z
    : z >= placement.z;
}

/** Whether a placement's footprint covers one column. */
function covers(placement: Placement, x: number, y: number) {
  const [width, depth] = footprintOf(placement.item, placement.rotation);
  return (
    x >= placement.x &&
    y >= placement.y &&
    x < placement.x + width &&
    y < placement.y + depth
  );
}

/** The columns a placement's footprint covers. */
function columnsOf(placement: Placement) {
  const [width, depth] = footprintOf(placement.item, placement.rotation);
  return Arr.flatMap(Arr.range(0, width - 1), (dx) =>
    Arr.map(
      Arr.range(0, depth - 1),
      (dy) => [placement.x + dx, placement.y + dy] as const
    )
  );
}

/**
 * Why a placement cannot stand where it is among the others, none when it can:
 * it leaves the island, it overlaps another, a block it needs is missing under
 * it, or a pond is off the ground.
 */
export function standing(
  layout: readonly Placement[],
  placement: Placement,
  size: number
): Option.Option<typeof StandRefusal.Type> {
  const [width, depth] = footprintOf(placement.item, placement.rotation);
  if (placement.x + width > size || placement.y + depth > size) {
    return Option.some("outside");
  }
  const columns = columnsOf(placement);
  const overlaps = Arr.some(layout, (other) =>
    Arr.some(columns, ([x, y]) => {
      if (!covers(other, x, y)) {
        return false;
      }
      const top = Math.max(placement.z, other.z);
      return claims(other, top) && claims(placement, top);
    })
  );
  if (overlaps) {
    return Option.some("overlap");
  }
  if (placement.z === 0) {
    return Option.none();
  }
  const held =
    kindOf(placement.item) !== "pond" &&
    Arr.every(columns, ([x, y]) =>
      Arr.some(
        layout,
        (other) =>
          kindOf(other.item) === "block" &&
          other.z === placement.z - 1 &&
          covers(other, x, y)
      )
    );
  return held ? Option.none() : Option.some("unsupported");
}

/** Whether anything stands on a block, so it cannot leave. */
export function carries(layout: readonly Placement[], placement: Placement) {
  return (
    kindOf(placement.item) === "block" &&
    Arr.some(
      layout,
      (other) =>
        other.z === placement.z + 1 && covers(other, placement.x, placement.y)
    )
  );
}

/** The index of the placement whose first cell is `at`. */
export function indexAt(layout: readonly Placement[], at: At) {
  return Arr.findFirstIndex(
    layout,
    (placement) =>
      placement.x === at.x && placement.y === at.y && placement.z === at.z
  );
}
