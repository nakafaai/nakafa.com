import { describe, expect, it } from "@effect/vitest";
import { harvestAt, waterPlants } from "@repo/backend/confect/island/farm";
import type { Placement } from "@repo/backend/confect/island/layout";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Option, Result } from "effect";

/** A placement bought at its first stage on a cell of the ground. */
const planted = (
  item: Placement["item"],
  x: number,
  growth = 0,
  stage = 0
): Placement => ({ growth, item, paid: 5, rotation: 0, stage, x, y: 0, z: 0 });

/** Waters a layout `times` days in a row. */
function watered(layout: readonly Placement[], times: number) {
  let current = layout;
  for (let day = 0; day < times; day += 1) {
    current = Option.getOrThrow(waterPlants(current));
  }
  return current;
}

describe("island/farm", () => {
  it("grows every plant one watered day at a time, a stage per step, up to its last", () => {
    const garden = [
      planted("tree", 0),
      planted("flowers", 2),
      planted("grass", 4),
    ];
    expect(watered(garden, 1)).toEqual([
      planted("tree", 0, 1, 0),
      planted("flowers", 2, 1, 0),
      planted("grass", 4),
    ]);
    expect(watered(garden, 2)).toEqual([
      planted("tree", 0, 0, 1),
      planted("flowers", 2, 0, 1),
      planted("grass", 4),
    ]);
    expect(watered(garden, 8)[0]).toEqual(planted("tree", 0, 3, 2));
    expect(watered(garden, 9)[0]).toEqual(planted("tree", 0, 0, 3));
    expect(watered(garden, 20)[0]).toEqual(planted("tree", 0, 0, 3));
    expect(watered(garden, 20)[1]).toEqual(planted("flowers", 2, 0, 1));
  });

  it("grows the starter tree from the stage it came with", () => {
    expect(watered(STARTER_LAYOUT, 3)[1]).toMatchObject({
      growth: 3,
      stage: 2,
    });
    expect(watered(STARTER_LAYOUT, 4)[1]).toMatchObject({
      growth: 0,
      stage: 3,
    });
  });

  it("waters nothing on an island without a plant", () => {
    expect(waterPlants([planted("grass", 0)])).toEqual(Option.none());
  });

  it("harvests a plant at its last stage into materials and lets it grow back", () => {
    const tree = planted("tree", 0, 0, 3);
    const flowers = planted("flowers", 2, 0, 1);
    expect(Result.getOrThrow(harvestAt([tree], tree))).toEqual({
      layout: [planted("tree", 0, 0, 2)],
      yields: { petals: 0, wood: 4 },
    });
    expect(Result.getOrThrow(harvestAt([flowers], flowers))).toEqual({
      layout: [planted("flowers", 2, 0, 0)],
      yields: { petals: 3, wood: 0 },
    });
  });

  it("refuses a harvest of nothing, of what is not a plant, and of a plant still growing", () => {
    const reason = (layout: readonly Placement[], x: number) =>
      Result.match(harvestAt(layout, { x, y: 0, z: 0 }), {
        onFailure: (refused) => refused.reason,
        onSuccess: () => undefined,
      });
    expect(reason([], 0)).toBe("missing");
    expect(reason([planted("grass", 0)], 0)).toBe("barren");
    expect(reason([planted("tree", 0, 3, 2)], 0)).toBe("unripe");
  });
});
