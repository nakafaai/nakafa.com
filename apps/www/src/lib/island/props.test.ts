// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableHashMap, Option } from "effect";
import { keyOf } from "@/lib/island/land/chunk";
import { KINDS, looseAt } from "@/lib/island/loose";
import {
  bodyOf,
  dropOf,
  FRUIT_CAP,
  gathered,
  touchedAt,
  withBalls,
} from "@/lib/island/props";
import { FACE, flood, PLAIN, plainOf } from "@/lib/island/test.plain";

describe("island/props", () => {
  it("drops a shaken tree's own fruit from where it hangs, a little out from the trunk and moving outward", () => {
    const foot = [10, PLAIN, 20] as const;
    for (const [tree, fruit, most] of [
      ["mango", "mango", 2],
      ["tree", "mango", 2],
      ["palm", "coconut", 2],
      ["banana", "banana", 1],
    ] as const) {
      const drops = Arr.flatMap(Arr.range(0, 30), (shakes) =>
        dropOf(7, shakes, tree, foot)
      );
      expect(Arr.dedupe(Arr.map(drops, (drop) => drop.kind))).toEqual([fruit]);
      expect(drops.length).toBeGreaterThanOrEqual(31);
      expect(drops.length).toBeLessThanOrEqual(31 * most);
      for (const drop of drops) {
        const out = Math.hypot(drop.x - foot[0], drop.z - foot[2]);
        expect(out).toBeGreaterThan(0.3);
        expect(out).toBeLessThan(2.4);
        expect(drop.y).toBeGreaterThan(PLAIN + 1.5);
        expect(
          drop.speedX * (drop.x - foot[0]) + drop.speedZ * (drop.z - foot[2])
        ).toBeGreaterThan(0);
      }
    }
    expect(dropOf(7, 3, "palm", foot)[0].y).toBeGreaterThan(
      dropOf(7, 3, "mango", foot)[0].y + 3
    );
  });

  it("drops the same fruit for the same shake and nothing from a tree that bears none", () => {
    const foot = [0, PLAIN, 0] as const;
    expect(dropOf(7, 4, "mango", foot)).toEqual(dropOf(7, 4, "mango", foot));
    expect(dropOf(7, 4, "mango", foot)).not.toEqual(
      dropOf(7, 5, "mango", foot)
    );
    expect(dropOf(7, 4, "pine", foot)).toEqual([]);
    expect(dropOf(7, 4, "cottage", foot)).toEqual([]);
    const keys = Arr.flatMap(Arr.range(0, 20), (shakes) =>
      Arr.map(dropOf(7, shakes, "mango", foot), (drop) => drop.key)
    );
    expect(Arr.dedupe(keys).length).toBe(keys.length);
  });

  it("keeps at most fourteen loose fruit, the oldest leaving first, and never loses a ball to them", () => {
    const fruit = (from: number, count: number) =>
      Arr.makeBy(count, (index) =>
        looseAt("mango", `fruit-${from + index}`, [index, PLAIN, 0])
      );
    const ball = looseAt("ball", "ball-0-0-5", [1, PLAIN, 1]);
    const few = gathered([ball, ...fruit(0, 3)], fruit(3, 2));
    expect(few.length).toBe(6);
    const many = gathered([...fruit(0, 6), ball, ...fruit(6, 6)], fruit(12, 5));
    expect(Arr.filter(many, (item) => item.kind === "mango").length).toBe(
      FRUIT_CAP
    );
    expect(many).toContainEqual(ball);
    expect(Arr.map(many, (item) => item.key)).not.toContain("fruit-2");
    expect(Arr.map(many, (item) => item.key)).toContain("fruit-3");
    expect(Option.map(Arr.last(many), (item) => item.key)).toEqual(
      Option.some("fruit-16")
    );
  });

  it("makes every ball set down near the fox a loose thing where it lies, and keeps one that rolled where it rolled", () => {
    const land = plainOf(2);
    flood(land, 40, 8, 2);
    MutableHashMap.set(land.things, keyOf(0, 0), [
      { at: 10 * 64 + 12, kind: "ball", turn: 0 },
      { at: 20 * 64 + 20, kind: "bench", turn: 0 },
    ]);
    MutableHashMap.set(land.things, keyOf(1, 0), [
      { at: 16 * 64 + 16, kind: "ball", turn: 0 },
    ]);
    MutableHashMap.set(land.things, keyOf(-2, 2), [
      { at: 0, kind: "ball", turn: 0 },
    ]);
    const mango = looseAt("mango", "fruit-1", [3, PLAIN, 3]);
    const first = withBalls(land, [mango], 0, 0);
    expect(first.length).toBe(3);
    expect(first).toContainEqual(
      looseAt("ball", "ball-0-0-652", [6, PLAIN + KINDS.ball.radius, 5])
    );
    // A ball set down on water lies on its face.
    const afloat = Option.getOrThrow(
      Arr.findFirst(first, (item) => item.key === "ball-1-0-1040")
    );
    expect([afloat.x, afloat.z]).toEqual([40, 8]);
    expect(afloat.y).toBeCloseTo(FACE + KINDS.ball.radius, 5);
    expect(first).toContainEqual(mango);
    const rolled = Arr.map(first, (item) =>
      item.key === "ball-0-0-652" ? { ...item, x: 9 } : item
    );
    const again = withBalls(land, rolled, 0, 0);
    expect(Arr.filter(again, (item) => item.x === 9).length).toBe(1);
    // A ball whose thing was taken away goes; so does one the fox walked far from.
    MutableHashMap.set(land.things, keyOf(0, 0), []);
    expect(Arr.map(withBalls(land, again, 0, 0), (item) => item.key)).toEqual([
      "ball-1-0-1040",
      "fruit-1",
    ]);
    expect(Arr.map(withBalls(land, again, -1, 1), (item) => item.key)).toEqual([
      "ball--2-2-0",
      "fruit-1",
    ]);
  });

  it("finds the loose thing a press touches: the nearest within a hand's reach, and none past it", () => {
    const loose = [
      looseAt("ball", "a", [5, PLAIN, 5]),
      looseAt("mango", "b", [5.5, PLAIN, 5]),
      looseAt("coconut", "c", [9, PLAIN, 9]),
    ];
    expect(touchedAt(loose, 5.1, 5)).toEqual(Option.some(0));
    expect(touchedAt(loose, 5.4, 5.1)).toEqual(Option.some(1));
    expect(touchedAt(loose, 9.3, 9.4)).toEqual(Option.some(2));
    expect(touchedAt(loose, 7, 7)).toEqual(Option.none());
    expect(touchedAt([], 7, 7)).toEqual(Option.none());
  });

  it("hands the painter a fruit at its middle and the ball so that it turns about its own middle as it rolls", () => {
    const mango = {
      ...looseAt("mango", "m", [3, 12.5, 4]),
      heading: 1,
      roll: 2,
    };
    expect(bodyOf(mango)).toEqual([3, 12.5, 4, 1, 0, -2]);
    const radius = KINDS.ball.radius;
    for (const [heading, roll] of [
      [0, 0],
      [0.7, 1.3],
      [-2, 9],
    ] as const) {
      const ball = { ...looseAt("ball", "b", [3, 12.5, 4]), heading, roll };
      const [x, y, z, yaw, gait, pitch] = bodyOf(ball);
      // The body program tips a model about its origin, then turns it: the ball's middle, a radius over its origin, must land on the ball's own middle.
      const up = radius * Math.cos(pitch);
      const back = -radius * Math.sin(pitch);
      expect(x + back * Math.sin(yaw)).toBeCloseTo(3, 9);
      expect(y + up).toBeCloseTo(12.5, 9);
      expect(z + back * Math.cos(yaw)).toBeCloseTo(4, 9);
      expect(yaw).toBe(heading);
      expect(gait).toBe(0);
      expect(Math.cos(pitch)).toBeCloseTo(Math.cos(roll), 9);
      expect(Math.sin(pitch)).toBeCloseTo(-Math.sin(roll), 9);
    }
  });
});
