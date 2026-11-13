// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, HashSet, Option } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import { groundOf } from "@/lib/island/life";
import { STRIDE } from "@/lib/island/mesh";
import { terrainOf } from "@/lib/island/terrain";
import { roam, wildOf, wildVertices } from "@/lib/island/wild";
import { SEA_LEVEL } from "@/lib/island/world";

const DAY = 20_400;

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

  it("walks a walker toward its goal, rests it, and picks a new goal on its ground; flyers and swimmers keep their loops", () => {
    const cells = terrainOf(11, 52);
    const wild = wildOf(cells, 11, 52, DAY);
    const walker = Arr.findFirst(
      wild,
      (creature) => SPECIES[creature.index].home === "land"
    );
    const flyer = Arr.findFirst(
      wild,
      (creature) => SPECIES[creature.index].home === "sky"
    );
    expect(Option.isSome(walker) && Option.isSome(flyer)).toBe(true);
    if (Option.isNone(walker) || Option.isNone(flyer)) {
      return;
    }
    expect(roam(cells, flyer.value, 11, 1)).toBe(flyer.value);
    expect(roam(cells, { ...walker.value, rest: 2 }, 11, 0.5).rest).toBe(1.5);
    const walking = roam(
      cells,
      { ...walker.value, tx: walker.value.x + 6 },
      11,
      0.5
    );
    expect(walking.x).toBeGreaterThan(walker.value.x);
    const arrived = roam(cells, walker.value, 11, 0.5);
    expect(arrived.steps).toBe(1);
    expect(arrived.rest).toBeGreaterThan(0);
    const stuck = roam(
      cells,
      { ...walker.value, tx: 1.5, tz: 1.5, x: 1.5, z: 1.5 },
      11,
      0.5
    );
    expect([stuck.tx, stuck.tz]).toEqual([1.5, 1.5]);
  });

  it("draws walkers and flyers standing at their real height and swimmers flat on the sea", () => {
    const cells = terrainOf(11, 52);
    const wild = wildOf(cells, 11, 52, DAY);
    const vertices = wildVertices(cells, wild, 52, 0.7, 12);
    expect(vertices).toHaveLength(wild.length * 4 * STRIDE);
    Arr.forEach(wild, (creature, quad) => {
      const y = (corner: number) => vertices[(quad * 4 + corner) * STRIDE + 1];
      if (SPECIES[creature.index].home === "sea") {
        expect(y(0)).toBeCloseTo(SEA_LEVEL - 0.08);
        expect(y(2)).toBeCloseTo(SEA_LEVEL - 0.08);
      } else {
        expect(y(2)).toBeGreaterThan(y(0));
      }
    });
  });

  it("stands a walker on the sea's level once the ground under it is dug away", () => {
    const cells = terrainOf(11, 52);
    const walker = Arr.findFirst(
      wildOf(cells, 11, 52, DAY),
      (creature) => SPECIES[creature.index].home === "land"
    );
    expect(Option.isSome(walker)).toBe(true);
    if (Option.isNone(walker)) {
      return;
    }
    const dug = new Uint8Array(cells.length);
    const vertices = wildVertices(dug, [walker.value], 52, 0.7, 12);
    expect(vertices[1]).toBeCloseTo(SEA_LEVEL);
  });
});
