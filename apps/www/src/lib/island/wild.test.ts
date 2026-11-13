// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, HashMap, HashSet, Option } from "effect";
import { BODY_STRIDE, NO_SHADOW, whaleAt } from "@/lib/island/bodies";
import { SPECIES } from "@/lib/island/fauna/species";
import { groundOf } from "@/lib/island/life";
import { speciesFaces } from "@/lib/island/models/catalog";
import { bodyFaces } from "@/lib/island/models/kinds";
import { boundsOf } from "@/lib/island/models/parts";
import { terrainOf } from "@/lib/island/terrain";
import { roam, wildBodies, wildOf } from "@/lib/island/wild";
import { type Cells, cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

const DAY = 20_400;

/** The first species of the catalog that matches, by its index. */
const speciesWhere = (
  matches: (species: (typeof SPECIES)[number]) => boolean
) => Option.getOrThrow(Arr.findFirstIndex(SPECIES, matches));

/** A wild creature of a species at (x, z) heading for (tx, tz). */
const creature = (index: number, x: number, z: number, tx = x, tz = z) => ({
  index,
  phase: 1,
  rest: 0,
  steps: 0,
  tx,
  tz,
  x,
  z,
});

/** A world laid with one block across every column at height `y`, and water over it up to the sea when asked. */
const floored = (block: string, y: number, flooded = false) => {
  const cells: Cells = emptyCells();
  for (const x of Arr.makeBy(SPAN, (index) => index)) {
    for (const z of Arr.makeBy(SPAN, (index) => index)) {
      cells[cellOf(x, y, z)] = idOf(block);
      for (let water = y + 1; water < SEA_LEVEL; water += 1) {
        cells[cellOf(x, water, z)] = flooded ? idOf("water") : 0;
      }
    }
  }
  return cells;
};

/** The numbers of a creature's bodies, as one plain list. */
const placesOf = (
  cells: Cells,
  wild: ReturnType<typeof creature>,
  time = 12
) => {
  const [[model, places]] = wildBodies(cells, [wild], 52, time);
  expect(model).toEqual({ _tag: "species", index: wild.index });
  expect(places.length % BODY_STRIDE).toBe(0);
  return Array.from(places);
};

describe("island/wild", () => {
  it("brings a day's visitors of every home, walkers on their own ground, different species another day", () => {
    const cells = terrainOf(11, 52);
    const wild = wildOf(cells, 11, 52, DAY);
    const homes = Arr.map(wild, (creature) => SPECIES[creature.index].home);
    expect(Arr.filter(homes, (home) => home === "land")).toHaveLength(6);
    expect(Arr.filter(homes, (home) => home === "shore")).toHaveLength(3);
    expect(Arr.filter(homes, (home) => home === "sky")).toHaveLength(5);
    expect(Arr.filter(homes, (home) => home === "sea")).toHaveLength(6);
    expect(Arr.filter(homes, (home) => home === "bloom")).toHaveLength(4);
    for (const creature of wild) {
      const home = SPECIES[creature.index].home;
      if (home === "land" || home === "shore") {
        const ground = groundOf(
          cells,
          Math.floor(creature.x),
          Math.floor(creature.z)
        );
        expect(
          Option.exists(ground, ({ block }) =>
            home === "land"
              ? block === idOf("grass") || block === idOf("dirt")
              : block === idOf("sand")
          )
        ).toBe(true);
      }
    }
    const later = wildOf(cells, 11, 52, DAY + 1);
    expect(
      HashSet.fromIterable(Arr.map(later, (creature) => creature.index))
    ).not.toEqual(
      HashSet.fromIterable(Arr.map(wild, (creature) => creature.index))
    );
  });

  it("walks a walker toward its goal, stops it at a step or a wall, rests it, and picks a new goal on its ground; flyers and swimmers keep their loops", () => {
    const meadow = floored("grass", 8);
    const walker = speciesWhere((species) => species.home === "land");
    const flyer = creature(
      speciesWhere((species) => species.home === "sky"),
      5.5,
      5.5
    );
    expect(roam(meadow, flyer, 11, 1)).toBe(flyer);
    const resting = { ...creature(walker, 5.5, 5.5), rest: 2 };
    expect(roam(meadow, resting, 11, 0.5).rest).toBe(1.5);
    // Each step here reaches three quarters of a block, into the next column.
    const dt = 0.75 / Math.min(1.6, 0.4 + SPECIES[walker].height);
    const walking = roam(meadow, creature(walker, 6.5, 5.5, 9.5), 11, dt);
    expect(walking.x).toBeCloseTo(7.25);
    const step = floored("grass", 8);
    step[cellOf(7, 9, 5)] = idOf("dirt");
    const wall = floored("grass", 8);
    wall[cellOf(7, 9, 5)] = idOf("stone");
    wall[cellOf(7, 10, 5)] = idOf("stone");
    for (const blocked of [step, wall]) {
      const stopped = roam(blocked, creature(walker, 6.5, 5.5, 9.5), 11, dt);
      expect([stopped.x, stopped.tx, stopped.rest]).toEqual([6.5, 6.5, 1]);
    }
    const arrived = roam(meadow, creature(walker, 5.5, 5.5), 11, 0.5);
    expect(arrived.steps).toBe(1);
    expect(arrived.rest).toBeGreaterThan(0);
    const stuck = roam(emptyCells(), creature(walker, 1.5, 1.5), 11, 0.5);
    expect([stuck.tx, stuck.tz]).toEqual([1.5, 1.5]);
  });

  it("draws a walker as its species' body on its ground, facing its goal, its shadow at its feet, bobbing only while it walks", () => {
    const meadow = floored("grass", 8);
    const walker = speciesWhere((species) => species.home === "land");
    const [x, y, z, yaw, bob, shadow] = placesOf(
      meadow,
      creature(walker, 5.5, 5.5, 8.5, 5.5)
    );
    expect([x, y, z, shadow]).toEqual([5.5, 9, 5.5, 9]);
    expect(bob).toBeCloseTo(0.04);
    expect(yaw).toBeCloseTo(Math.PI / 2);
    const still = placesOf(meadow, { ...creature(walker, 5.5, 5.5), rest: 2 });
    expect([still[3], still[4]]).toEqual([1, 0]);
    // With the ground dug away, it stands at the sea's level.
    expect(placesOf(emptyCells(), creature(walker, 5.5, 5.5))[1]).toBe(
      SEA_LEVEL
    );
  });

  it("flies a flyer on its loop facing its way, its shadow on the ground under it and none over water", () => {
    const flyer = creature(
      speciesWhere((species) => species.home === "sky"),
      5.5,
      5.5
    );
    const [x, y, z, yaw, , shadow] = placesOf(floored("grass", 8), flyer);
    expect(y).toBeGreaterThan(SEA_LEVEL + 10);
    expect(shadow).toBe(9);
    const [later] = wildBodies(floored("grass", 8), [flyer], 52, 12.05);
    const [lx, , lz] = Array.from(later[1]);
    expect(Math.atan2(lx - x, lz - z)).toBeCloseTo(yaw, 1);
    expect(placesOf(floored("sand", 4, true), flyer)[5]).toBe(NO_SHADOW);
    expect(placesOf(emptyCells(), flyer)[5]).toBe(NO_SHADOW);
  });

  it("floats a waterbird on the sea, walks a lobster on its floor, and swims fish in shoals between the floor and the surface", () => {
    // At time 0 every loop is a few cells inside the world, over its floor.
    const sea = floored("sand", 4, true);
    const of = (family: string) =>
      creature(
        speciesWhere(
          (species) => species.home === "sea" && species.family === family
        ),
        0,
        0
      );
    const bird = placesOf(sea, of("waterbird"), 0);
    expect(bird).toHaveLength(BODY_STRIDE);
    expect(bird[1]).toBeCloseTo(SEA_LEVEL - 0.2);
    expect(bird[5]).toBe(NO_SHADOW);
    expect(placesOf(sea, of("crab"), 0)[1]).toBe(5);
    const small = creature(
      speciesWhere(
        (species) =>
          species.home === "sea" &&
          species.family === "fish" &&
          species.height <= 0.2
      ),
      0,
      0
    );
    const shoal = placesOf(sea, small, 0);
    expect(shoal.length / BODY_STRIDE).toBeGreaterThan(4);
    expect(shoal.length / BODY_STRIDE).toBeLessThanOrEqual(9);
    Arr.forEach(Arr.chunksOf(shoal, BODY_STRIDE), ([, y, , , , shadow]) => {
      expect(y).toBeGreaterThan(5);
      expect(y).toBeLessThan(SEA_LEVEL);
      expect(shadow).toBe(NO_SHADOW);
    });
    expect(placesOf(sea, of("ray"), 0).length).toBe(BODY_STRIDE);
  });

  it("leaves out a swimmer with no water under it, and lets one swim free where no floor lies", () => {
    const fish = creature(
      speciesWhere(
        (species) => species.home === "sea" && species.family === "fish"
      ),
      0,
      0
    );
    expect(placesOf(floored("stone", SEA_LEVEL - 1), fish, 0)).toHaveLength(0);
    expect(placesOf(emptyCells(), fish, 0).length).toBeGreaterThan(0);
    const lobster = creature(
      speciesWhere(
        (species) => species.home === "sea" && species.family === "crab"
      ),
      0,
      0
    );
    expect(placesOf(emptyCells(), lobster, 0)[1]).toBeCloseTo(SEA_LEVEL - 0.9);
  });

  it("keeps the day's sea visitors apart from each other and inside the whale's flippers, on the largest island", () => {
    const cells = terrainOf(11, 64);
    const sea = Arr.filter(
      wildOf(cells, 11, 64, DAY),
      (visitor) => SPECIES[visitor.index].home === "sea"
    );
    /** How far a body of these faces reaches from its middle across the sea, at most. */
    const reachOf = (faces: ReturnType<typeof bodyFaces>) => {
      const bounds = boundsOf(faces);
      return (
        Math.hypot(bounds.x[1] - bounds.x[0], bounds.z[1] - bounds.z[0]) / 2
      );
    };
    const reaches = HashMap.fromIterable(
      Arr.map(sea, (visitor) => [
        visitor.index,
        reachOf(speciesFaces(visitor.index)),
      ])
    );
    const middle = SPAN / 2;
    const whale = whaleAt(0);
    const flippers =
      Math.hypot(whale.x - middle, whale.z - middle) -
      (boundsOf(bodyFaces("whale")).x[1] - boundsOf(bodyFaces("whale")).x[0]) /
        2;
    for (const time of [0, 7, 19]) {
      const bodies = Arr.flatMap(
        wildBodies(cells, sea, 64, time),
        ([model, places]) =>
          Arr.map(Arr.chunksOf(Array.from(places), BODY_STRIDE), (body) => ({
            index: model.index,
            reach: Option.getOrThrow(HashMap.get(reaches, model.index)),
            x: body[0],
            z: body[2],
          }))
      );
      for (const body of bodies) {
        expect(
          Math.hypot(body.x - middle, body.z - middle) + body.reach
        ).toBeLessThan(flippers);
        for (const other of bodies) {
          if (other.index !== body.index) {
            expect(
              Math.hypot(body.x - other.x, body.z - other.z)
            ).toBeGreaterThan(body.reach + other.reach);
          }
        }
      }
    }
  });
});
