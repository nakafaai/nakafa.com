import {
  growsOf,
  Item,
  materialsOf,
  stagesOf,
} from "@repo/backend/confect/island/item";
import {
  MAX_HEIGHT,
  Placement,
  replaceAt,
} from "@repo/backend/confect/island/layout";
import { MAX_SIZE } from "@repo/backend/confect/island/level";
import {
  addMaterials,
  coversMaterials,
  lessMaterials,
  Materials,
} from "@repo/backend/confect/island/material";
import {
  carries,
  indexAt,
  StandRefusal,
  standing,
} from "@repo/backend/confect/island/stand";
import { Array as Arr, Match, Option, Result, Schema } from "effect";

const Coordinate = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: MAX_SIZE - 1 })
);

/** A cell of the island: east, south, and the layer it stands on. */
export const Cell = Schema.Struct({
  x: Coordinate,
  y: Coordinate,
  z: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: MAX_HEIGHT - 1 })
  ),
});
type Cell = typeof Cell.Type;

const Turn = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 }));

/**
 * One change to an island (ADR 0042, D12). A placement is named by the cell its
 * first footprint cell stands on, since no two placements share a cell. A place
 * names the stage it is bought at, so undoing a removal puts back what was there.
 */
export const Operation = Schema.Union([
  Schema.TaggedStruct("place", {
    at: Cell,
    item: Item,
    rotation: Turn,
    stage: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 3 })),
  }),
  Schema.TaggedStruct("move", { from: Cell, rotation: Turn, to: Cell }),
  Schema.TaggedStruct("remove", { at: Cell }),
  Schema.TaggedStruct("upgrade", { at: Cell }),
  Schema.TaggedStruct("downgrade", { at: Cell }),
]);
export type Operation = typeof Operation.Type;

/** Why the island refused a change, and which change of the batch it was. */
export class BuildRefused extends Schema.TaggedError<
  BuildRefused,
  { readonly brand: unique symbol }
>()("BuildRefused", {
  index: Schema.Int,
  reason: Schema.Literals([
    ...StandRefusal.literals,
    "missing",
    "carrying",
    "grows",
    "locked",
    "materials",
    "rooted",
    "unaffordable",
    "starter",
    "top",
    "bottom",
  ]),
}) {}
type Reason = BuildRefused["reason"];

/** What the rules read besides the layout: the island's size, level, and spendable Stars and materials. */
const BuildContext = Schema.Struct({
  level: Schema.Int,
  materials: Materials,
  size: Schema.Int,
  stars: Schema.Finite,
});
type BuildContext = typeof BuildContext.Type;

/** The layout and the Stars and materials left after the changes so far. */
const Built = Schema.Struct({
  layout: Schema.Array(Placement),
  materials: Materials,
  stars: Schema.Finite,
});
type Built = typeof Built.Type;

/** A batch applied: the layout and Stars after it, and the batch that undoes it. */
const Edited = Schema.Struct({
  ...Built.fields,
  undo: Schema.Array(Operation),
});

const refuse = (reason: Reason) => Result.fail(reason);

/** A change applied: the layout and Stars after it, and the change that undoes it. */
function done(built: Built, undo: Operation) {
  return Result.succeed({ built, undo });
}

/** Runs a change on the placement whose first cell is `at`, refused as missing when none stands there. */
function onPlacement<A>(
  built: Built,
  at: Cell,
  change: (placement: Placement, index: number) => Result.Result<A, Reason>
) {
  return Option.match(indexAt(built.layout, at), {
    onNone: () => refuse("missing"),
    onSome: (index) => change(built.layout[index], index),
  });
}

/** Buys an item at a stage and sets it on its cell; removing it undoes that. */
function placeItem(
  built: Built,
  place: Extract<Operation, { _tag: "place" }>,
  context: BuildContext
) {
  const stages = stagesOf(place.item);
  if (place.stage >= stages.length) {
    return refuse("top");
  }
  const bought = Arr.take(stages, place.stage + 1);
  if (!Arr.every(bought, (stage) => stage.level <= context.level)) {
    return refuse("locked");
  }
  const paid = Arr.reduce(bought, 0, (total, stage) => total + stage.price);
  const cost = materialsOf(place.item, place.stage);
  const placement = {
    growth: 0,
    item: place.item,
    paid,
    rotation: place.rotation,
    stage: place.stage,
    ...place.at,
  };
  return Option.match(standing(built.layout, placement, context.size), {
    onNone: () => {
      if (paid > built.stars) {
        return refuse("unaffordable");
      }
      return coversMaterials(built.materials, cost)
        ? done(
            {
              layout: Arr.append(built.layout, placement),
              materials: lessMaterials(built.materials, cost),
              stars: built.stars - paid,
            },
            { _tag: "remove", at: place.at }
          )
        : refuse("materials");
    },
    onSome: refuse,
  });
}

/** Moves and turns a placement; moving it back undoes that. */
function moveItem(
  built: Built,
  move: Extract<Operation, { _tag: "move" }>,
  context: BuildContext
) {
  return onPlacement(built, move.from, (placement, index) => {
    if (carries(built.layout, placement)) {
      return refuse("carrying");
    }
    const moved = { ...placement, rotation: move.rotation, ...move.to };
    return Option.match(
      standing(Arr.remove(built.layout, index), moved, context.size),
      {
        onNone: () =>
          done(
            {
              layout: replaceAt(built.layout, index, moved),
              materials: built.materials,
              stars: built.stars,
            },
            {
              _tag: "move",
              from: move.to,
              rotation: placement.rotation,
              to: move.from,
            }
          ),
        onSome: refuse,
      }
    );
  });
}

/** Removes a placement and returns what it paid; placing it back undoes that. */
function removeItem(built: Built, at: Cell) {
  return onPlacement(built, at, (placement, index) => {
    if (placement.paid === 0) {
      return refuse("starter");
    }
    const grown = placement.stage > 0 || placement.growth > 0;
    if (grown && Option.isSome(growsOf(placement.item))) {
      return refuse("rooted");
    }
    return carries(built.layout, placement)
      ? refuse("carrying")
      : done(
          {
            layout: Arr.remove(built.layout, index),
            materials: addMaterials(
              built.materials,
              materialsOf(placement.item, placement.stage)
            ),
            stars: built.stars + placement.paid,
          },
          {
            _tag: "place",
            at,
            item: placement.item,
            rotation: placement.rotation,
            stage: placement.stage,
          }
        );
  });
}

/** The materials one stage costs on top of the stages before it. */
function stepMaterials(item: Item, stage: number) {
  return lessMaterials(materialsOf(item, stage), materialsOf(item, stage - 1));
}

/**
 * Raises a placement one stage for that stage's price and materials; a
 * downgrade undoes that. A plant grows by watering instead.
 */
function upgradeItem(built: Built, at: Cell, context: BuildContext) {
  return onPlacement(built, at, (placement, index) => {
    if (Option.isSome(growsOf(placement.item))) {
      return refuse("grows");
    }
    return Option.match(
      Arr.get(stagesOf(placement.item), placement.stage + 1),
      {
        onNone: () => refuse("top"),
        onSome: (next) => {
          if (next.level > context.level) {
            return refuse("locked");
          }
          if (next.price > built.stars) {
            return refuse("unaffordable");
          }
          const cost = stepMaterials(placement.item, placement.stage + 1);
          return coversMaterials(built.materials, cost)
            ? done(
                {
                  layout: replaceAt(built.layout, index, {
                    ...placement,
                    paid: placement.paid + next.price,
                    stage: placement.stage + 1,
                  }),
                  materials: lessMaterials(built.materials, cost),
                  stars: built.stars - next.price,
                },
                { _tag: "downgrade", at }
              )
            : refuse("materials");
        },
      }
    );
  });
}

/**
 * Lowers a placement one stage and returns that stage's price; an upgrade undoes
 * that. A stage the placement never paid for, such as a starter piece's, stays.
 */
function downgradeItem(built: Built, at: Cell) {
  return onPlacement(built, at, (placement, index) => {
    if (Option.isSome(growsOf(placement.item))) {
      return refuse("grows");
    }
    if (placement.stage === 0) {
      return refuse("bottom");
    }
    const refund = stagesOf(placement.item)[placement.stage].price;
    return placement.paid < refund
      ? refuse("starter")
      : done(
          {
            layout: replaceAt(built.layout, index, {
              ...placement,
              paid: placement.paid - refund,
              stage: placement.stage - 1,
            }),
            materials: addMaterials(
              built.materials,
              stepMaterials(placement.item, placement.stage)
            ),
            stars: built.stars + refund,
          },
          { _tag: "upgrade", at }
        );
  });
}

/** Applies one change, or answers why it is refused. */
function applyOne(built: Built, operation: Operation, context: BuildContext) {
  return Match.valueTags(operation, {
    downgrade: ({ at }) => downgradeItem(built, at),
    move: (move) => moveItem(built, move, context),
    place: (place) => placeItem(built, place, context),
    remove: ({ at }) => removeItem(built, at),
    upgrade: ({ at }) => upgradeItem(built, at, context),
  });
}

/**
 * Applies a batch of changes in order, on the server and in the browser alike
 * (ADR 0042, D12, D13), and returns the layout, the Stars and materials left,
 * and the batch that undoes it. The first refused change refuses the whole
 * batch, so the island never keeps half an edit. Placing buys an item at its
 * stage; removing returns what it paid; an upgrade pays its step and a
 * downgrade returns it; a starter piece paid nothing, so it can be moved and
 * upgraded but never removed or taken below what it came with. A plant is
 * bought as a seed and grows by watering, so it takes no upgrade, and once it
 * has grown it can be moved but not removed, which keeps every undo exact.
 */
export function applyOperations(
  layout: readonly Placement[],
  operations: readonly Operation[],
  context: BuildContext
): Result.Result<typeof Edited.Type, BuildRefused> {
  let built: Built = {
    layout,
    materials: context.materials,
    stars: context.stars,
  };
  let undo: readonly Operation[] = [];
  for (let index = 0; index < operations.length; index += 1) {
    const next = applyOne(built, operations[index], context);
    if (Result.isFailure(next)) {
      return Result.fail(new BuildRefused({ index, reason: next.failure }));
    }
    built = next.success.built;
    undo = Arr.prepend(undo, next.success.undo);
  }
  return Result.succeed({ ...built, undo });
}
