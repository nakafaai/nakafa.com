// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";
import {
  groundOf,
  herdOf,
  herdQuads,
  ninaAt,
  suitsOf,
  wander,
} from "@/lib/island/life";
import { STRIDE } from "@/lib/island/mesh";
import { SCALE } from "@/lib/island/scale";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf, emptyCells, SEA_LEVEL } from "@/lib/island/world";

describe("island/life", () => {
  it("reads the top block of a column, none for an empty one", () => {
    const cells = emptyCells();
    cells[cellOf(4, 9, 4)] = idOf("grass");
    expect(groundOf(cells, 4, 4)).toEqual(
      Option.some({ block: idOf("grass"), y: 9 })
    );
    expect(groundOf(cells, 5, 5)).toEqual(Option.none());
  });

  it("lets hens stand on open ground, ducks on the sea and villagers on paths, nowhere else", () => {
    const cells = emptyCells();
    cells[cellOf(4, 9, 4)] = idOf("grass");
    cells[cellOf(6, 7, 6)] = idOf("water");
    cells[cellOf(8, 9, 8)] = idOf("planks");
    cells[cellOf(10, 9, 10)] = idOf("path");
    expect(suitsOf("cat", cells, 10.5, 10.5)).toBe(true);
    expect(suitsOf("bear", cells, 4.5, 4.5)).toBe(false);
    expect(suitsOf("hen", cells, 4.5, 4.5)).toBe(true);
    expect(suitsOf("hen", cells, 6.5, 6.5)).toBe(false);
    expect(suitsOf("duck", cells, 6.5, 6.5)).toBe(true);
    expect(suitsOf("hen", cells, 8.5, 8.5)).toBe(false);
    expect(suitsOf("duck", cells, 20.5, 20.5)).toBe(false);
  });

  it("opens a game with three hens on the island, two ducks on the water and three villagers on the paths", () => {
    const cells = terrainOf(11, 44);
    const herd = herdOf(cells, 11, 44);
    expect(Arr.map(herd, (animal) => animal.kind)).toEqual([
      "hen",
      "hen",
      "hen",
      "duck",
      "duck",
      "cat",
      "rabbit",
      "bear",
    ]);
    expect(
      Arr.every(herd, (animal) =>
        suitsOf(animal.kind, cells, animal.x, animal.z)
      )
    ).toBe(true);
  });

  it("rests, walks toward its goal, and picks a new goal that suits it once there", () => {
    const cells = terrainOf(11, 44);
    const [hen] = herdOf(cells, 11, 44);
    const resting = wander(cells, { ...hen, rest: 1 }, 11, 0, 0.4);
    expect(resting.rest).toBeCloseTo(0.6);
    expect(wander(cells, { ...hen, rest: 0.2 }, 11, 0, 0.4).rest).toBe(0);
    const walking = wander(cells, { ...hen, tx: hen.x + 3 }, 11, 0, 1);
    expect(walking.x).toBeCloseTo(hen.x + 1.1);
    const arrived = wander(cells, hen, 11, 0, 1);
    expect(arrived.steps).toBe(1);
    expect(arrived.rest).toBeGreaterThan(0);
    expect(suitsOf("hen", cells, arrived.tx, arrived.tz)).toBe(true);
    const stuck = wander(cells, { ...hen, kind: "duck" }, 11, 0, 1);
    expect([stuck.tx, stuck.tz]).toEqual([hen.tx, hen.tz]);
  });

  it("draws each animal as one quad facing the camera, stepping, bobbing, and mirrored when it walks left", () => {
    const cells = terrainOf(11, 44);
    const herd = herdOf(cells, 11, 44);
    const walking = Arr.map(herd, (animal, index) =>
      index === 0 ? { ...animal, tx: animal.x - 2 } : animal
    );
    const quads = herdQuads(cells, walking, 44, 0, 1 / 6);
    // Five fowl of one quad each, three villagers of two, and Nina.
    expect(quads.indices).toHaveLength(12 * 6);
    expect(quads.vertices).toHaveLength(12 * 4 * STRIDE);
    const bottom = (quad: number) => quads.vertices[quad * 4 * STRIDE + 1];
    const top = (quad: number) => quads.vertices[(quad * 4 + 2) * STRIDE + 1];
    // A villager's body and head stack two blocks tall; a hen stands half a block over her ground.
    expect(top(6) - bottom(5)).toBeCloseTo(SCALE.person);
    expect(bottom(6)).toBeCloseTo(top(5));
    expect((top(0) - bottom(0)) * (13 / 16)).toBeCloseTo(SCALE.fowl);
    const duckBase = quads.vertices[3 * 4 * STRIDE + 1];
    expect(duckBase).toBeLessThan(SEA_LEVEL);
    const still = herdQuads(cells, herd, 44, 0, 0);
    expect(still.vertices[3]).not.toBe(quads.vertices[3]);
    const nowhere = herdQuads(
      emptyCells(),
      [{ ...herd[0], x: 2.5, z: 2.5 }],
      44,
      0,
      0
    );
    expect(nowhere.vertices[1]).toBeCloseTo(SEA_LEVEL - 0.02);
  });

  it("swims Nina around the island past its footprint, facing along her loop, flat on the sea and beating her tail", () => {
    const middle = 32;
    for (const time of [0, 7, 19, 40, 83]) {
      const nina = ninaAt(32, time);
      const reach = Math.hypot(nina.x - middle, nina.z - middle);
      expect(reach).toBeGreaterThan(16 + 0.7);
      expect(reach).toBeLessThan(16 + 3.3);
      const later = ninaAt(32, time + 0.01);
      expect(Math.atan2(later.z - nina.z, later.x - nina.x)).toBeCloseTo(
        nina.heading,
        1
      );
    }
    const alone = herdQuads(emptyCells(), [], 32, 0, 0);
    expect(alone.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
    const heights = Arr.makeBy(
      4,
      (corner) => alone.vertices[corner * STRIDE + 1]
    );
    expect(Arr.every(heights, (y) => y === heights[0])).toBe(true);
    expect(heights[0]).toBeCloseTo(SEA_LEVEL - 0.06);
    const stroke = herdQuads(emptyCells(), [], 32, 0, 1 / 2);
    expect(stroke.vertices[3]).not.toBeCloseTo(alone.vertices[3]);
  });
});
