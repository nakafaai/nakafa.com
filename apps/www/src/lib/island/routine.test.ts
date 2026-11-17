// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { type Animal, suitsOf } from "@/lib/island/life";
import { isAsleep, keepDay, spotOf, stepToward } from "@/lib/island/routine";
import { terrainOf } from "@/lib/island/terrain";
import { SPOTS } from "@/lib/island/village";
import { cellOf, SEA_LEVEL } from "@/lib/island/world";

const CELLS = terrainOf(7, 52);
const MIDDLE = SPAN / 2;

/** A villager of this kind standing still in the middle of a cell. */
const villager = (kind: Animal["kind"], x: number, z: number): Animal => ({
  kind,
  rest: 0,
  steps: 0,
  tx: x + 0.5,
  tz: z + 0.5,
  x: x + 0.5,
  z: z + 0.5,
});

/** A villager after `seconds` of its day at `hour`, a quarter second a step. */
const lived = (
  cells: Uint8Array,
  start: Animal,
  hour: number,
  seconds: number
) =>
  Arr.reduce(
    Arr.makeBy(seconds * 4, (step) => step),
    start,
    (animal) => keepDay(cells, animal, { hour, index: 0 }, 7, 0.25)
  );

describe("island/routine", () => {
  it("keeps each villager's day by the hour: home at night, by the well morning and evening, at work by day, each a little apart", () => {
    expect(spotOf(0, 2)).toEqual({
      asleep: true,
      x: SPOTS.homes[0][0],
      z: SPOTS.homes[0][1],
    });
    expect(spotOf(0, 7)).toEqual({
      asleep: false,
      x: SPOTS.plaza[0][0],
      z: SPOTS.plaza[0][1],
    });
    expect(spotOf(1, 12)).toEqual({
      asleep: false,
      x: SPOTS.work[1][0],
      z: SPOTS.work[1][1],
    });
    expect(spotOf(2, 19).asleep).toBe(false);
    expect(spotOf(2, 23).asleep).toBe(true);
    // The bear keeps its hours later than the cat: at six the cat is up and the bear still sleeps.
    expect(spotOf(0, 6.1).asleep).toBe(false);
    expect(spotOf(2, 6.1).asleep).toBe(true);
  });

  it("lays every spot of the day on the village's paths", () => {
    Arr.forEach([...SPOTS.homes, ...SPOTS.plaza, ...SPOTS.work], ([x, z]) =>
      expect(suitsOf("cat", CELLS, x + 0.5, z + 0.5)).toBe(true)
    );
  });

  it("walks the shortest way along the paths, one path cell at a time, to any spot", () => {
    const route = Arr.reduce(
      Arr.makeBy(40, (step) => step),
      [[MIDDLE, MIDDLE - 12] as const],
      (cells, _) => {
        const here = Option.getOrThrow(Arr.last(cells));
        return Option.match(
          stepToward(CELLS, here, [SPOTS.homes[2][0], SPOTS.homes[2][1]]),
          {
            onNone: () => cells,
            onSome: (next) => [...cells, next],
          }
        );
      }
    );
    const [lastX, lastZ] = Option.getOrThrow(Arr.last(route));
    expect([lastX, lastZ]).toEqual([SPOTS.homes[2][0], SPOTS.homes[2][1]]);
    Arr.forEach(Arr.zip(route, Arr.drop(route, 1)), ([[ax, az], [bx, bz]]) =>
      expect(Math.abs(ax - bx) + Math.abs(az - bz)).toBe(1)
    );
    Arr.forEach(route, ([x, z]) =>
      expect(suitsOf("cat", CELLS, x + 0.5, z + 0.5)).toBe(true)
    );
    // No way leads to a spot off the paths, nor from a cell with no path beside it.
    expect(stepToward(CELLS, [MIDDLE, MIDDLE - 12], [0, 0])).toEqual(
      Option.none()
    );
    expect(stepToward(CELLS, [2, 2], [MIDDLE, MIDDLE - 12])).toEqual(
      Option.none()
    );
  });

  it("walks a villager home at night, where it goes inside and sleeps, and out to the well in the morning", () => {
    const [px, pz] = SPOTS.plaza[0];
    const home = lived(CELLS, villager("cat", px, pz), 23, 60);
    expect(isAsleep(home, 23)).toBe(true);
    expect(
      Math.hypot(
        home.x - SPOTS.homes[0][0] - 0.5,
        home.z - SPOTS.homes[0][1] - 0.5
      )
    ).toBeLessThan(0.7);
    // Asleep it stays put; with the morning it is no longer asleep and heads out.
    expect(lived(CELLS, home, 23, 5)).toMatchObject({ x: home.x, z: home.z });
    const morning = lived(CELLS, home, 7, 30);
    expect(isAsleep(morning, 7)).toBe(false);
    expect(Math.hypot(morning.x - px - 0.5, morning.z - pz - 0.5)).toBeLessThan(
      0.7
    );
    // Only a villager sleeps in a cottage.
    expect(
      isAsleep(villager("hen", SPOTS.homes[0][0], SPOTS.homes[0][1]), 23)
    ).toBe(false);
  });

  it("lets a villager wander as the other creatures do where the learner has built over its way", () => {
    const blocked = Uint8Array.from(CELLS);
    const [hx, hz] = SPOTS.homes[0];
    blocked[cellOf(hx, SEA_LEVEL + 1, hz)] = idOf("stone");
    const start = villager("cat", MIDDLE, MIDDLE - 12);
    const later = lived(blocked, start, 23, 20);
    expect(later.steps).toBeGreaterThan(0);
    expect(isAsleep(later, 23)).toBe(false);
  });
});
