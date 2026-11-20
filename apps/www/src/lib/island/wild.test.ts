// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { CAST } from "@/lib/island/fauna/cast";
import { CELL, cellKey, surveyOf } from "@/lib/island/fauna/habitat";
import type { Land } from "@/lib/island/land/ground";
import type { Animal, Dweller } from "@/lib/island/life";
import { suitsOf, touches } from "@/lib/island/room";
import {
  coverAll,
  dwellerAt,
  floodAll,
  plainOf,
  speciesOf,
} from "@/lib/island/test.world";
import { dwellersOf, PET, roamed } from "@/lib/island/wild";

const DICE = { day: 20_000, gx: 0, gz: 0, seed: 1 };

/** Nothing stands in a walker's way. */
const open = () => false;

/** The animals of one cell of a land, by the dice. */
const cast = (land: Land, dice = DICE) =>
  dwellersOf(land, surveyOf(land, dice.gx, dice.gz), dice, open);

/** A cell of one cover. */
function coveredBy(kind: "forest" | "meadow" | "sand") {
  const land = plainOf(2);
  coverAll(land, [0, 0], [CELL, CELL], kind);
  return land;
}

/** The learner's fox at a place. */
const foxAt = (x: number, z: number): Animal => ({
  kind: "fox",
  rest: 1,
  steps: 0,
  tx: x,
  tz: z,
  x,
  z,
});

/** The animals of the cells of one land over many seeds of the dice, all together. */
const many = (land: Land) =>
  Arr.flatMap(Arr.range(1, 40), (seed) => cast(land, { ...DICE, seed }));

/** How far the members of a pack stand from its middle, at most. */
function spreadOf(pack: readonly Dweller[]) {
  const x = Arr.reduce(pack, 0, (sum, animal) => sum + animal.x) / pack.length;
  const z = Arr.reduce(pack, 0, (sum, animal) => sum + animal.z) / pack.length;
  return Math.max(
    ...Arr.map(pack, (animal) => Math.hypot(animal.x - x, animal.z - z))
  );
}

describe("island/wild", () => {
  it("finds a herd on a cell's meadow, the same one every day, each member where it fits and apart from the rest", () => {
    const land = coveredBy("meadow");
    const dwellers = cast(land);
    const herd = Arr.filter(dwellers, (animal) => animal.pack === 0);
    expect(herd.length).toBeGreaterThanOrEqual(2);
    expect(herd.length).toBeLessThanOrEqual(6);
    expect(Arr.dedupe(Arr.map(herd, (animal) => animal.kind))).toHaveLength(1);
    expect(Arr.contains(CAST.herds, herd[0].kind)).toBe(true);
    for (const animal of dwellers) {
      expect(suitsOf(land, animal.ground, animal.x, animal.z)).toBe(true);
      expect(animal.cell).toBe(cellKey(0, 0));
      expect(
        Arr.some(
          dwellers,
          (other) => other !== animal && touches(animal, other)
        )
      ).toBe(false);
    }
    expect(Arr.dedupe(Arr.map(dwellers, (animal) => animal.seed))).toHaveLength(
      dwellers.length
    );
    expect(cast(land)).toEqual(dwellers);
    expect(
      Arr.filter(cast(land, { ...DICE, day: 20_001 }), (a) => a.pack === 0)
    ).toEqual(herd);
    // A herd stands together about one spot of the cell.
    expect(spreadOf(herd)).toBeLessThan(12);
  });

  it("brings hens to some meadows and a prowler of the day to most, never to a cell with too little of it", () => {
    const land = coveredBy("meadow");
    const all = many(land);
    const hens = Arr.filter(all, (animal) => animal.kind === "hen");
    expect(hens.length).toBeGreaterThan(0);
    expect(hens.length % 3).toBe(0);
    expect(hens.length).toBeLessThan(40 * 3);
    const prowlers = Arr.filter(all, (animal) => animal.pack === 2);
    expect(prowlers.length).toBeGreaterThan(10);
    expect(prowlers.length).toBeLessThan(40);
    expect(
      Arr.every(prowlers, (animal) => Arr.contains(CAST.prowlers, animal.kind))
    ).toBe(true);
    const days = Arr.flatMap(Arr.range(0, 30), (day) =>
      Arr.map(
        Arr.filter(cast(land, { ...DICE, day }), (animal) => animal.pack === 2),
        (animal) => animal.kind
      )
    );
    expect(Arr.dedupe(days).length).toBeGreaterThan(4);
    // An islet of a few blocks in a cell of sea is too little land for any of them.
    const islet = plainOf(2);
    floodAll(islet, [0, 0], [CELL, 56], 6, "sea");
    floodAll(islet, [0, 56], [56, CELL], 6, "sea");
    expect(
      Arr.filter(many(islet), (animal) => animal.ground === "dry")
    ).toEqual([]);
  });

  it("puts climbers in the forest, crabs on the sand, fowl on fresh water with a wader at its bank, and seabirds on the sea", () => {
    const forest = cast(coveredBy("forest"));
    expect(Arr.contains(CAST.climbers, forest[0].kind)).toBe(true);
    const beach = coveredBy("sand");
    const crabs = Arr.filter(cast(beach), (animal) => animal.ground === "sand");
    expect(crabs).toHaveLength(4);
    expect(Arr.contains(CAST.crabs, crabs[0].kind)).toBe(true);
    const lake = plainOf(2);
    floodAll(lake, [0, 0], [CELL, CELL], 0.4, "lake");
    floodAll(lake, [0, 0], [CELL, 40], 1.5, "lake");
    const water = cast(lake);
    const fowl = Arr.filter(water, (animal) => animal.ground === "afloat");
    expect(fowl.length).toBeGreaterThanOrEqual(2);
    expect(Arr.contains(CAST.fowl, fowl[0].kind)).toBe(true);
    const waders = Arr.filter(many(lake), (animal) => animal.ground === "bank");
    expect(waders.length).toBeGreaterThan(0);
    expect(Arr.contains(CAST.waders, waders[0].kind)).toBe(true);
    const sea = plainOf(2);
    floodAll(sea, [0, 0], [CELL, CELL], 6, "sea");
    const birds = many(sea);
    expect(birds.length).toBeGreaterThan(0);
    expect(
      Arr.every(birds, (animal) => Arr.contains(CAST.seabirds, animal.kind))
    ).toBe(true);
    expect(birds.length).toBeLessThan(40 * 2);
  });

  it("moves a herd as a herd: each wanders about the middle of its pack and none strays", () => {
    const land = coveredBy("meadow");
    const start: readonly Dweller[] = Arr.filter(
      cast(land),
      (animal) => animal.pack === 0
    );
    const walked = Arr.reduce(Arr.range(0, 1500), start, (herd) =>
      roamed(land, herd, { blocked: open, dt: 0.1, others: [], threats: [] })
    );
    expect(spreadOf(walked)).toBeLessThan(12);
    expect(walked).not.toEqual(start);
    expect(Arr.every(walked, (animal) => animal.steps > 3)).toBe(true);
    for (const animal of walked) {
      expect(
        Arr.some(walked, (other) => other !== animal && touches(animal, other))
      ).toBe(false);
    }
  });

  it("runs a grazer straight away from the fox, faster than it strolls, and leaves a bold animal where it is", () => {
    const land = plainOf(2);
    const deer = { ...dwellerAt(speciesOf("deer"), 10, 10), rest: 2 };
    const step = { blocked: open, dt: 0.1, others: [] };
    const fled = roamed(land, [deer], { ...step, threats: [foxAt(8, 10)] })[0];
    expect(fled.rest).toBe(0);
    expect(fled.x).toBeCloseTo(10 + 1.6 * 2.6 * 0.1, 6);
    expect(fled.z).toBe(10);
    expect([fled.tx, fled.tz]).toEqual([17, 10]);
    // A fox on the very spot still sends it somewhere.
    const under = roamed(land, [deer], {
      ...step,
      threats: [foxAt(10, 10)],
    })[0];
    expect(Number.isFinite(under.x)).toBe(true);
    // Beyond five blocks it takes no notice; an elephant never does; a hen runs.
    const calm = roamed(land, [deer], { ...step, threats: [foxAt(2, 10)] })[0];
    expect([calm.x, calm.rest]).toEqual([10, 1.9]);
    const bold = { ...dwellerAt(speciesOf("elephant"), 10, 10), rest: 2 };
    expect(
      roamed(land, [bold], { ...step, threats: [foxAt(8, 10)] })[0].rest
    ).toBe(1.9);
    const hen = { ...dwellerAt("hen", 10, 10), rest: 2 };
    expect(
      roamed(land, [hen], { ...step, threats: [foxAt(8, 10)] })[0].x
    ).toBeGreaterThan(10);
  });

  it("stands a stroked animal still, facing the fox, until the moment has passed", () => {
    const land = plainOf(2);
    const hen = { ...dwellerAt("hen", 10, 10), pet: PET, tx: 14 };
    const step = { blocked: open, dt: 0.1, others: [] };
    const held = roamed(land, [hen], { ...step, threats: [foxAt(10, 6)] })[0];
    expect(held.pet).toBeCloseTo(PET - 0.1, 6);
    expect([held.x, held.z]).toEqual([10, 10]);
    expect(held.rest).toBeGreaterThan(0);
    expect(Math.atan2(held.tx - held.x, held.tz - held.z)).toBeCloseTo(
      Math.PI,
      6
    );
    const alone = roamed(land, [hen], { ...step, threats: [] })[0];
    expect([alone.tx, alone.tz, alone.x]).toEqual([10, 10, 10]);
    const last = roamed(land, [{ ...hen, pet: 0.05 }], {
      ...step,
      threats: [],
    });
    expect(last[0].pet).toBe(0);
  });
});
