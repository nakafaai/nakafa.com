// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Order, Record as Rec } from "effect";
import {
  CELL,
  cellKey,
  Habitat,
  habitatAt,
  habitatOf,
  surveyOf,
} from "@/lib/island/fauna/habitat";
import {
  cover,
  coverAll,
  flood,
  floodAll,
  plainOf,
} from "@/lib/island/test.world";

/** Dry, level, open grass on the first terrace, which each case changes one thing of. */
const GRASS = { cover: "grass", depth: -1, elevation: 5, slope: 0.1 } as const;

describe("island/fauna/habitat", () => {
  it("reads a place as the habitat its water, its height and its cover make it", () => {
    const of = (site: Partial<Parameters<typeof habitatOf>[0]>) =>
      habitatOf({ ...GRASS, ...site });
    expect(of({})).toEqual(Option.some("grass"));
    expect(of({ cover: "path" })).toEqual(Option.some("grass"));
    expect(of({ cover: "meadow" })).toEqual(Option.some("meadow"));
    expect(of({ cover: "forest" })).toEqual(Option.some("forest"));
    expect(of({ cover: "sand" })).toEqual(Option.some("shore"));
    expect(of({ elevation: 14 })).toEqual(Option.some("highland"));
    expect(of({ cover: "sand", elevation: 14 })).toEqual(Option.some("shore"));
    expect(of({ slope: 0.9 })).toEqual(Option.none());
    expect(of({ depth: 0.6 })).toEqual(Option.some("fresh"));
    expect(of({ depth: 1.2, elevation: -2 })).toEqual(Option.some("shallows"));
    expect(of({ depth: 5, elevation: -9 })).toEqual(Option.some("sea"));
    // Water is water however steep its bed.
    expect(of({ depth: 5, elevation: -9, slope: 2 })).toEqual(
      Option.some("sea")
    );
  });

  it("reads the habitat of a place of the land", () => {
    const land = plainOf(1);
    flood(land, 4, 4, 4, "sea");
    cover(land, -4, -4, "meadow");
    expect(habitatAt(land, 0, 0)).toEqual(Option.some("grass"));
    expect(habitatAt(land, 4, 4)).toEqual(Option.some("sea"));
    expect(habitatAt(land, -4, -4)).toEqual(Option.some("meadow"));
  });

  it("surveys a cell into the places of each habitat, in an order of the seed's own", () => {
    const land = plainOf(2);
    floodAll(land, [0, 0], [32, CELL], 5, "sea");
    coverAll(land, [32, 0], [CELL, 32], "forest");
    const survey = surveyOf(land, 0, 0);
    expect(Arr.sort(Rec.keys(survey), Order.String)).toEqual(
      Arr.sort(Habitat.literals, Order.String)
    );
    // Every fourth block is read: 256 places a cell, half of them sea, a quarter forest, a quarter grass.
    expect(survey.sea).toHaveLength(128);
    expect(survey.forest).toHaveLength(64);
    expect(survey.grass).toHaveLength(64);
    expect(survey.meadow).toHaveLength(0);
    expect(Arr.every(survey.sea, (spot) => spot.x < 32 && spot.depth > 4)).toBe(
      true
    );
    expect(Arr.every(survey.forest, (spot) => spot.x > 32 && spot.z < 32)).toBe(
      true
    );
    // The order is the seed's, not the lattice's, and the same every time.
    const orders = Arr.map(survey.sea, (spot) => spot.order);
    expect(orders).toEqual(Arr.sort(orders, Order.Number));
    expect(Arr.map(survey.sea, (spot) => spot.x)).not.toEqual(
      Arr.sort(
        Arr.map(survey.sea, (spot) => spot.x),
        Order.Number
      )
    );
    expect(surveyOf(land, 0, 0)).toEqual(survey);
    // A cell on the far side of the origin is read from its own corner.
    const west = surveyOf(land, -1, -1);
    expect(west.grass).toHaveLength(256);
    expect(Arr.every(west.grass, (spot) => spot.x < 0 && spot.z < 0)).toBe(
      true
    );
  });

  it("names every cell with a key of its own, either side of the origin", () => {
    const keys = Arr.flatMap([-2, -1, 0, 1], (gx) =>
      Arr.map([-2, -1, 0, 1], (gz) => cellKey(gx, gz))
    );
    expect(Arr.dedupe(keys)).toHaveLength(16);
  });
});
