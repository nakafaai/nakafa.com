// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";
import {
  type Animal,
  groundOf,
  herdOf,
  suitsOf,
  wander,
} from "@/lib/island/life";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf, emptyCells } from "@/lib/island/world";

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
    expect(suitsOf("cow", cells, 4.5, 4.5)).toBe(true);
    expect(suitsOf("cow", cells, 6.5, 6.5)).toBe(false);
    expect(suitsOf("hen", cells, 6.5, 6.5)).toBe(false);
    expect(suitsOf("duck", cells, 6.5, 6.5)).toBe(true);
    expect(suitsOf("hen", cells, 8.5, 8.5)).toBe(false);
    expect(suitsOf("duck", cells, 20.5, 20.5)).toBe(false);
  });

  it("opens a game with three hens and three cows on the island, two ducks on the water and three villagers on the paths", () => {
    const cells = terrainOf(11, 44);
    const herd = herdOf(cells, 11, 44);
    expect(Arr.map(herd, (animal) => animal.kind)).toEqual([
      "hen",
      "hen",
      "hen",
      "cow",
      "cow",
      "cow",
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
    // Within a few rolls it picks a new goal, and only on ground that suits it.
    const moved = Arr.findFirst(
      Arr.makeBy(24, (steps) => wander(cells, { ...hen, steps }, 11, 0, 1)),
      (next) => next.tx !== hen.tx || next.tz !== hen.tz
    );
    expect(Option.isSome(moved)).toBe(true);
    Option.map(moved, (next) =>
      expect(suitsOf("hen", cells, next.tx, next.tz)).toBe(true)
    );
    // A duck set down on dry land, with no water within its reach, keeps its goal.
    const isDry = (animal: typeof hen) =>
      Arr.every(
        Arr.makeBy(49, (cell) => cell),
        (cell) =>
          !suitsOf(
            "duck",
            cells,
            animal.tx - 3 + (cell % 7),
            animal.tz - 3 + Math.floor(cell / 7)
          )
      );
    const landed = Arr.findFirst(herdOf(cells, 11, 44), isDry);
    expect(Option.isSome(landed)).toBe(true);
    Option.map(landed, (animal) => {
      const stuck = wander(cells, { ...animal, kind: "duck" }, 11, 0, 1);
      expect([stuck.tx, stuck.tz]).toEqual([animal.tx, animal.tz]);
    });
  });

  it("stops an animal before a wall or another body instead of passing through, and lets it pick a new way", () => {
    const cells = emptyCells();
    for (let z = 0; z < 12; z += 1) {
      for (let x = 0; x < 12; x += 1) {
        cells[cellOf(x, 8, z)] = idOf("grass");
      }
      cells[cellOf(6, 9, z)] = idOf("stone");
      cells[cellOf(6, 10, z)] = idOf("stone");
    }
    const cat: Animal = {
      kind: "cat",
      rest: 0,
      steps: 0,
      tx: 9.5,
      tz: 3.5,
      x: 5.2,
      z: 3.5,
    };
    const stopped = wander(cells, cat, 11, 0, 0.5);
    expect([stopped.x, stopped.z]).toEqual([5.2, 3.5]);
    expect(stopped.rest).toBeGreaterThan(0);
    expect([stopped.tx, stopped.tz]).toEqual([5.2, 3.5]);
    const free: Animal = { ...cat, tx: 2.5, x: 4.5 };
    expect(wander(cells, free, 11, 0, 0.5).x).toBeLessThan(4.5);
    const bear: Animal = { ...free, kind: "bear", tx: 4.5, x: 3.2 };
    const blocked = wander(cells, free, 11, 0, 0.5, [free, bear]);
    expect(blocked.x).toBe(4.5);
    const away = wander(cells, { ...free, tx: 5.4 }, 11, 0, 0.2, [free, bear]);
    expect(away.x).toBeGreaterThan(4.5);
  });
});
