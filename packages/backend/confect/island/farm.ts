import { growsOf } from "@repo/backend/confect/island/item";
import { Placement, replaceAt } from "@repo/backend/confect/island/layout";
import { Materials } from "@repo/backend/confect/island/material";
import { FarmRefused } from "@repo/backend/confect/island/schema";
import { indexAt } from "@repo/backend/confect/island/stand";
import { Array as Arr, Option, Result, Schema } from "effect";

/**
 * Waters every plant on the island once (ADR 0042, D13): each counts one more
 * watered day toward its next stage and climbs to it once it has the days that
 * step takes, starting the count again. A plant at its last stage waits for a
 * harvest. None when the island has no plant.
 */
export function waterPlants(layout: readonly Placement[]) {
  if (
    !Arr.some(layout, (placement) => Option.isSome(growsOf(placement.item)))
  ) {
    return Option.none();
  }
  return Option.some(
    Arr.map(layout, (placement) =>
      Option.match(growsOf(placement.item), {
        onNone: () => placement,
        onSome: ({ days }) =>
          Option.match(Arr.get(days, placement.stage), {
            onNone: () => placement,
            onSome: (step) =>
              placement.growth + 1 < step
                ? { ...placement, growth: placement.growth + 1 }
                : { ...placement, growth: 0, stage: placement.stage + 1 },
          }),
      })
    )
  );
}

/** A harvest done: the layout after it and the materials it gave. */
const Harvested = Schema.Struct({
  layout: Schema.Array(Placement),
  yields: Materials,
});

/**
 * Harvests the plant whose first cell is `at` (ADR 0042, D13): only a plant at
 * its last stage gives its materials, and it grows back from its regrowing
 * stage. Refused when nothing stands there, when it is not a plant, or when it
 * has not grown to its last stage.
 */
export function harvestAt(
  layout: readonly Placement[],
  at: Pick<Placement, "x" | "y" | "z">
): Result.Result<typeof Harvested.Type, FarmRefused> {
  return Option.match(indexAt(layout, at), {
    onNone: () => Result.fail(new FarmRefused({ reason: "missing" })),
    onSome: (index) => {
      const placement = layout[index];
      return Option.match(growsOf(placement.item), {
        onNone: () => Result.fail(new FarmRefused({ reason: "barren" })),
        onSome: ({ days, regrows, yields }) =>
          placement.stage < days.length
            ? Result.fail(new FarmRefused({ reason: "unripe" }))
            : Result.succeed({
                layout: replaceAt(layout, index, {
                  ...placement,
                  growth: 0,
                  stage: regrows,
                }),
                yields,
              }),
      });
    },
  });
}
