import { describe, expect, it } from "@effect/vitest";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr } from "effect";
import {
  chimneysOf,
  firefliesOf,
  flyAt,
  PUFFS_PER_CHIMNEY,
  puffAt,
} from "@/lib/island/life";

/** One placement with the fields a test does not care about filled in. */
const placed = (
  fields: Pick<Placement, "item" | "stage" | "x" | "y"> & Partial<Placement>
): Placement => ({ growth: 0, paid: 0, rotation: 0, z: 0, ...fields });

describe("island life", () => {
  it("smokes from the cottage's chimney, which turns with the house, and never from the hut", () => {
    expect(
      chimneysOf([
        placed({ item: "house", stage: 0, x: 5, y: 5 }),
        placed({ item: "house", stage: 1, x: 1, y: 2 }),
        placed({ item: "house", rotation: 1, stage: 1, x: 1, y: 2 }),
      ])
    ).toEqual([
      { x: 2.375, y: 2.5, z: 2.5 },
      { x: 2.5, y: 2.5, z: 3.375 },
    ]);
  });

  it("raises each puff from the chimney, growing as it drifts, a third of a life apart", () => {
    const chimney = { x: 1, y: 2, z: 3 };
    expect(puffAt(chimney, 0, 0)).toEqual({ frame: 0, x: 1, y: 2, z: 3 });
    const old = puffAt(chimney, 0, 3.5);
    expect(old.frame).toBe(2);
    expect(old.y).toBeGreaterThan(2.8);
    expect(old.x).toBeGreaterThan(1.25);
    expect(puffAt(chimney, 1, 0).frame).toBe(1);
    expect(PUFFS_PER_CHIMNEY).toBe(3);
  });

  it("sends three fireflies round a grown tree and one round each bush and bed of flowers", () => {
    const flies = firefliesOf([
      placed({ item: "tree", stage: 2, x: 0, y: 0 }),
      placed({ item: "tree", stage: 1, x: 4, y: 4 }),
      placed({ item: "flowers", stage: 1, x: 2, y: 3, z: 1 }),
      placed({ item: "bush", stage: 0, x: 3, y: 1 }),
      placed({ item: "house", stage: 1, x: 6, y: 6 }),
    ]);
    expect(flies).toHaveLength(5);
    expect(Arr.map(flies, (fly) => [fly.x, fly.z])).toEqual([
      [0.5, 0.5],
      [0.5, 0.5],
      [0.5, 0.5],
      [2.5, 3.5],
      [3.5, 1.5],
    ]);
    expect(flies[3].y).toBeCloseTo(1.4);
    expect(Arr.every(flies, (fly) => fly.phase >= 0 && fly.phase < 1)).toBe(
      true
    );
  });

  it("lets a firefly wander near its plant and blink now and then", () => {
    const fly = { phase: 0, x: 2, y: 1, z: 3 };
    const moments = Arr.map(Arr.range(0, 40), (step) =>
      flyAt(fly, step * 0.25)
    );
    expect(
      Arr.every(
        moments,
        (moment) =>
          Math.abs(moment.x - 2) <= 0.4 &&
          Math.abs(moment.z - 3) <= 0.4 &&
          Math.abs(moment.y - 1) <= 0.12
      )
    ).toBe(true);
    expect(Arr.some(moments, (moment) => moment.glowing)).toBe(true);
    expect(Arr.some(moments, (moment) => !moment.glowing)).toBe(true);
  });
});
