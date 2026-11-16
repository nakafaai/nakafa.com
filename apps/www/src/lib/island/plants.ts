import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Order, Record as Rec, Result } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { PLANT_HEIGHTS } from "@/lib/island/models/heights";
import { unitOf } from "@/lib/island/noise";
import { type Cells, cellOf } from "@/lib/island/world";

/** How tall a plant may be, in meters, and still be pushed aside by a body walking through it: about a knee. */
const KNEE = 0.6;

/** Each block id's plant of the catalog by its index, -1 for a block that is no plant. */
const PLANT_OF = Int16Array.from(
  Arr.makeBy(256, (id) =>
    Option.getOrElse(
      Arr.findFirstIndex(PLANT_KEYS, (key) => idOf(key) === id),
      () => -1
    )
  )
);

/** Whether a block is a plant of the catalog, drawn as its own model rather than in the chunk mesh (ADR 0047, D25). */
export function isPlantBlock(block: number) {
  return PLANT_OF[block] >= 0;
}

/** Whether a block is a plant too tall to walk through: a body goes round it as round a wall (ADR 0047, D25). */
export function isTallPlant(block: number) {
  const index = PLANT_OF[block];
  return index >= 0 && PLANT_HEIGHTS[PLANT_KEYS[index]] > KNEE;
}

/** Whether a body passes through a cell's block (ADR 0047, D22 and D25): air, or a plant no taller than a knee, which it pushes aside. */
export function isPassable(block: number) {
  const kind = LOOK.kinds[block];
  return kind === KIND.air || (kind === KIND.cross && !isTallPlant(block));
}

/**
 * Every plant of the world as its true 3D model at its real height (ADR
 * 0047, D25), one model a plant with its bodies as one run of numbers,
 * `BODY_STRIDE` a body: standing in the middle of its cell, turned a way of
 * its own, its shadow at its foot. The world changes only by its edits, so
 * this is read again after an edit, never every frame.
 */
export function plantBodies(cells: Cells) {
  const plants = Arr.flatMap(
    Arr.makeBy(HEIGHT, (y) => y),
    (y) =>
      Arr.flatMap(
        Arr.makeBy(SPAN, (z) => z),
        (z) =>
          Arr.filterMap(
            Arr.makeBy(SPAN, (x) => x),
            (x) => {
              const index = PLANT_OF[cells[cellOf(x, y, z)]];
              return index < 0
                ? Result.failVoid
                : Result.succeed({
                    index,
                    place: [
                      x + 0.5,
                      y,
                      z + 0.5,
                      unitOf(17, x, y, z) * Math.PI * 2,
                      0,
                      y,
                    ],
                  });
            }
          )
      )
  );
  const groups = Arr.sort(
    Rec.values(Arr.groupBy(plants, (plant) => String(plant.index))),
    Order.mapInput(
      Order.Number,
      (group: Arr.NonEmptyReadonlyArray<(typeof plants)[number]>) =>
        Arr.headNonEmpty(group).index
    )
  );
  return Arr.map(
    groups,
    (group) =>
      [
        { _tag: "plant", index: Arr.headNonEmpty(group).index } as const,
        Float32Array.from(Arr.flatMap(group, (plant) => plant.place)),
      ] as const
  );
}
