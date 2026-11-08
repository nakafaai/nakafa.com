import type { Operation } from "@repo/backend/confect/island/build";
import type { Item } from "@repo/backend/confect/island/item";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Option } from "effect";

/** A cell of the island: east, south and layer. */
type Cell = Extract<Operation, { _tag: "remove" }>["at"];

/** The placement whose first cell is `at`. */
function placementAt(layout: readonly Placement[], at: Cell) {
  return Arr.findFirst(
    layout,
    (placement) =>
      placement.x === at.x && placement.y === at.y && placement.z === at.z
  );
}

/**
 * What a press on a cell would do while building (ADR 0042, D12): place the
 * chosen item there at the current turn, or move the picked placement there
 * when the owner is moving it, or nothing, when a press only picks.
 */
export function aimedOperation(
  tools: {
    readonly choice: Option.Option<Item>;
    readonly moving: boolean;
    readonly rotation: number;
    readonly selected: Option.Option<Cell>;
  },
  target: Cell,
  layout: readonly Placement[]
): Option.Option<Operation> {
  if (Option.isSome(tools.choice)) {
    return Option.some({
      _tag: "place",
      at: target,
      item: tools.choice.value,
      rotation: tools.rotation,
      stage: 0,
    });
  }
  return Option.flatMap(
    Option.filter(tools.selected, () => tools.moving),
    (from) =>
      Option.map(placementAt(layout, from), () => ({
        _tag: "move" as const,
        from,
        rotation: tools.rotation,
        to: target,
      }))
  );
}

/** The item a cursor outlines: the one about to be placed, or the placement being moved. */
export function aimedItem(operation: Operation, layout: readonly Placement[]) {
  if (operation._tag === "place") {
    return Option.some(operation.item);
  }
  return operation._tag === "move"
    ? Option.map(
        placementAt(layout, operation.from),
        (placement) => placement.item
      )
    : Option.none();
}
