import { describe, expect, it } from "@effect/vitest";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr } from "effect";
import {
  basinsOf,
  floraOf,
  piecesOf,
  watersOf,
  wildlifeOf,
} from "@/lib/island/pieces";

/** One placement with the fields a test does not care about filled in. */
const placed = (
  fields: Pick<Placement, "item" | "stage" | "x" | "y"> & Partial<Placement>
): Placement => ({ growth: 0, paid: 0, rotation: 0, z: 0, ...fields });

describe("island pieces", () => {
  it("centres each drawn piece on its footprint and turns it clockwise", () => {
    const [hut, pond] = piecesOf([
      placed({ item: "house", stage: 0, x: 1, y: 2 }),
      placed({ item: "pond", rotation: 1, stage: 2, x: 3, y: 0 }),
    ]);
    expect(hut).toMatchObject({
      angle: -0,
      center: [2, 0, 3],
      key: "house:0",
      pivot: [8, 0, 8],
    });
    expect(pond).toMatchObject({
      angle: -Math.PI / 2,
      center: [4.5, 0, 1.5],
      key: "pond:2",
      pivot: [12, 12, 12],
    });
  });

  it("leaves out a piece whose stage has no drawing yet", () => {
    expect(
      piecesOf([placed({ item: "flowers", stage: 0, x: 0, y: 0 })])
    ).toEqual([]);
  });

  it("cuts a basin and fills water for each pond, and nothing for other pieces", () => {
    const layout = [
      placed({ item: "pond", stage: 0, x: 5, y: 5 }),
      placed({ item: "tree", stage: 2, x: 0, y: 0 }),
    ];
    expect(basinsOf(layout)).toEqual([{ cells: [5, 5, 3, 3], depth: 12 }]);
    expect(watersOf(layout)).toEqual([
      { from: [5, -1.5, 5], to: [8, -0.25, 8] },
    ]);
  });

  it("gives every pond fish, and a pond with lilies ducks and Nina too", () => {
    const bare = wildlifeOf([placed({ item: "pond", stage: 0, x: 0, y: 0 })]);
    expect(Arr.map(bare, (animal) => animal.animal)).toEqual(["fish", "fish"]);
    const lively = wildlifeOf([placed({ item: "pond", stage: 1, x: 0, y: 0 })]);
    expect(Arr.map(lively, (animal) => animal.animal)).toEqual([
      "fish",
      "fish",
      "duck",
      "duck",
      "nina",
    ]);
    expect(lively[0]?.area).toEqual({ from: [0.4, 0.4], to: [2.6, 2.6] });
  });

  it("stands a bed of flowers in the middle of its cell, on its layer", () => {
    expect(
      floraOf([
        placed({ item: "flowers", stage: 0, x: 2, y: 3, z: 1 }),
        placed({ item: "grass", stage: 0, x: 2, y: 3 }),
      ])
    ).toEqual([{ sprite: "flowers", x: 2.5, y: 1, z: 3.5 }]);
  });
});
