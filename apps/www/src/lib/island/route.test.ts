// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import type { Standing } from "@/lib/island/collide";
import { blocksAt } from "@/lib/island/collide";
import type { Land } from "@/lib/island/land/ground";
import { depthAt } from "@/lib/island/land/ground";
import { followed, REACH, routeOf } from "@/lib/island/route";
import { flood, PLAIN, plainOf, raise } from "@/lib/island/test.plain";
import { PACE, REST, SWIM, stepWalker, walkerAt } from "@/lib/island/walker";

const OPEN: Standing = { blockers: [], decks: [] };

/** Places every quarter block along a route from where the fox stands. */
function alongOf(
  from: readonly [number, number],
  route: readonly (readonly [number, number])[]
) {
  return Arr.flatMap(route, (to, index) => {
    const start = index === 0 ? from : route[index - 1];
    const parts = Math.ceil(
      Math.hypot(to[0] - start[0], to[1] - start[1]) / 0.25
    );
    return Arr.map(
      Arr.range(0, parts),
      (part) =>
        [
          start[0] + ((to[0] - start[0]) * part) / parts,
          start[1] + ((to[1] - start[1]) * part) / parts,
        ] as const
    );
  });
}

/** Whether a route swims anywhere. */
function swims(
  land: Land,
  from: readonly [number, number],
  route: readonly (readonly [number, number])[]
) {
  return Arr.some(alongOf(from, route), ([x, z]) => depthAt(land, x, z) > SWIM);
}

/** A plain with water two blocks deep from x = 9 to x = 11, as far either way along z as `half`. */
function moated(half: number) {
  const land = plainOf(1);
  for (const i of [9, 10, 11]) {
    for (const j of Arr.range(-half, half)) {
      flood(land, i, j, 2);
    }
  }
  return land;
}

describe("island/route", () => {
  it("walks straight to a place over open ground, as one stretch", () => {
    const land = plainOf(1);
    expect(routeOf(land, OPEN, [0.3, 0.4], [18.6, 7.2])).toEqual(
      Option.some([[18.6, 7.2]])
    );
    expect(routeOf(land, OPEN, [4.2, 4.1], [4.4, 4.3])).toEqual(
      Option.some([[4.4, 4.3]])
    );
  });

  it("goes around what stands in the way, in a few stretches that stay clear of it", () => {
    const land = plainOf(1);
    const wall: Standing = {
      blockers: [
        { _tag: "box", deep: 5, wide: 0.5, x: 10, z: 0 },
        { _tag: "round", radius: 0.6, x: 10, z: 6 },
      ],
      decks: [],
    };
    const from = [2, 0] as const;
    const route = Option.getOrThrow(routeOf(land, wall, from, [18, 0]));
    expect(Arr.last(route)).toEqual(Option.some([18, 0]));
    expect(route.length).toBeGreaterThan(1);
    expect(route.length).toBeLessThan(8);
    expect(
      Arr.some(alongOf(from, route), ([x, z]) =>
        blocksAt(wall.blockers, x, z, 0.29)
      )
    ).toBe(false);
    expect(Arr.some(route, ([, z]) => Math.abs(z) > 5)).toBe(true);
  });

  it("goes around a pond only while that is cheaper than swimming it", () => {
    const pond = moated(4);
    const from = [0, 0] as const;
    const dry = Option.getOrThrow(routeOf(pond, OPEN, from, [20, 0]));
    expect(swims(pond, from, dry)).toBe(false);
    expect(Arr.last(dry)).toEqual(Option.some([20, 0]));
    // A moat that reaches past everywhere the search may go leaves no dry way, and one far longer than it is wide is swum.
    const moat = moated(30);
    const wet = Option.getOrThrow(routeOf(moat, OPEN, from, [20, 0]));
    expect(swims(moat, from, wet)).toBe(true);
    const long = moated(12);
    const across = Option.getOrThrow(routeOf(long, OPEN, from, [20, 0]));
    expect(swims(long, from, across)).toBe(true);
    // The way into the water and the way out of it are stretches of their own, never one line from bank to bed.
    expect(across.length).toBeGreaterThan(2);
    // A ford a few blocks off is waded instead: wet paws cost less than a swim.
    for (const i of [9, 10, 11]) {
      for (const j of [5, 6, 7]) {
        flood(long, i, j, 0.3);
      }
    }
    const forded = Option.getOrThrow(routeOf(long, OPEN, from, [20, 0]));
    expect(swims(long, from, forded)).toBe(false);
    expect(
      Arr.some(alongOf(from, forded), ([x, z]) => depthAt(long, x, z) > 0.1)
    ).toBe(true);
  });

  it("finds no way through a cliff, and takes the way around a short one", () => {
    const cliff = plainOf(1);
    for (const j of Arr.range(-32, 60)) {
      for (const i of Arr.range(10, 14)) {
        raise(cliff, i, j, PLAIN + 6);
      }
    }
    expect(routeOf(cliff, OPEN, [2, 0], [22, 0])).toEqual(Option.none());
    const bluff = plainOf(1);
    for (const j of Arr.range(-4, 4)) {
      for (const i of Arr.range(10, 14)) {
        raise(bluff, i, j, PLAIN + 6);
      }
    }
    const from = [2, 0] as const;
    const around = Option.getOrThrow(routeOf(bluff, OPEN, from, [22, 0]));
    const heights = Arr.map(alongOf(from, around), ([x, z]) =>
      Math.abs(z) <= 4 && x >= 10 && x <= 14 ? 1 : 0
    );
    expect(Math.max(...heights)).toBe(0);
  });

  it("walks up a slope the fox climbs and none it cannot", () => {
    const ramp = (rise: number) => {
      const land = plainOf(1);
      for (const j of Arr.range(-32, 60)) {
        for (const i of Arr.range(10, 40)) {
          raise(land, i, j, PLAIN + Math.min(i - 9, 4) * rise);
        }
      }
      return land;
    };
    expect(Option.isSome(routeOf(ramp(0.8), OPEN, [2, 0], [20, 0]))).toBe(true);
    expect(routeOf(ramp(1.3), OPEN, [2, 0], [20, 0])).toEqual(Option.none());
    // Down the same slope is a way: it is within what the fox walks down.
    expect(Option.isSome(routeOf(ramp(1.3), OPEN, [20, 0], [2, 0]))).toBe(true);
    expect(routeOf(ramp(2.5), OPEN, [20, 0], [2, 0])).toEqual(Option.none());
  });

  it("answers none for a place too far, a place something stands on, and a place walled in", () => {
    const land = plainOf(3);
    expect(routeOf(land, OPEN, [0, 0], [REACH + 1, 0])).toEqual(Option.none());
    expect(Option.isSome(routeOf(land, OPEN, [0, 0], [REACH - 1, 0]))).toBe(
      true
    );
    const house: Standing = {
      blockers: [{ _tag: "box", deep: 3, wide: 3, x: 12, z: 0 }],
      decks: [],
    };
    expect(routeOf(land, house, [0, 0], [12, 0])).toEqual(Option.none());
    const yard: Standing = {
      blockers: [
        { _tag: "box", deep: 0.3, wide: 4, x: 12, z: -4 },
        { _tag: "box", deep: 0.3, wide: 4, x: 12, z: 4 },
        { _tag: "box", deep: 4, wide: 0.3, x: 8, z: 0 },
        { _tag: "box", deep: 4, wide: 0.3, x: 16, z: 0 },
      ],
      decks: [],
    };
    expect(routeOf(land, yard, [0, 0], [12, 0])).toEqual(Option.none());
  });

  it("lets the fox out of something it stands in, and stops beside a pressed place it cannot stand on", () => {
    const land = plainOf(1);
    const trunk: Standing = {
      blockers: [{ _tag: "round", radius: 0.6, x: 2, z: 2 }],
      decks: [],
    };
    expect(Option.isSome(routeOf(land, trunk, [2, 2], [10, 2]))).toBe(true);
    const post: Standing = {
      blockers: [{ _tag: "round", radius: 0.3, x: 10.5, z: 0.5 }],
      decks: [],
    };
    expect(
      Option.flatMap(routeOf(land, post, [2, 2], [10.45, 0.5]), Arr.last)
    ).toEqual(Option.some([10, 1]));
  });

  it("crosses water over a bridge's deck instead of swimming", () => {
    const land = moated(30);
    const bridge: Standing = {
      blockers: [],
      decks: [{ lengthwise: "x", x: 10, y: PLAIN, z: 0 }],
    };
    const from = [3, 0] as const;
    const route = Option.getOrThrow(routeOf(land, bridge, from, [17, 0]));
    expect(Arr.every(alongOf(from, route), ([, z]) => Math.abs(z) < 0.95)).toBe(
      true
    );
  });

  it("follows a route place by place: past the ones it reached, at a run while the way is long, slowing as it ends", () => {
    const route = [
      [1, 0],
      [1.2, 0],
      [31, 0],
      [31, 2],
    ] as const;
    const far = followed(route, 1.1, 0);
    expect(far.route).toEqual([
      [31, 0],
      [31, 2],
    ]);
    expect(far.drive).toEqual({ speed: PACE.run, x: 1, z: 0 });
    const near = followed(far.route, 21, 0);
    expect(near.drive.speed).toBe(PACE.walk);
    const last = followed(near.route, 31, 0.2);
    expect(last.route).toEqual([[31, 2]]);
    expect(last.drive).toEqual({ speed: PACE.walk, x: 0, z: 1 });
    expect(followed(last.route, 31, 1.2).drive.speed).toBeCloseTo(1.6, 6);
    expect(followed(last.route, 31, 1.6).drive.speed).toBe(1.4);
    expect(followed(last.route, 31, 1.9)).toEqual({ drive: REST, route: [] });
    expect(followed([], 0, 0)).toEqual({ drive: REST, route: [] });
  });

  it("is a way the fox really walks: around a wall and a bluff, it arrives where it was sent", () => {
    const land = plainOf(1);
    for (const j of Arr.range(-3, 3)) {
      for (const i of Arr.range(18, 21)) {
        raise(land, i, j, PLAIN + 5);
      }
    }
    const standing: Standing = {
      blockers: [
        { _tag: "box", deep: 4, wide: 0.4, x: 8, z: 0 },
        { _tag: "round", radius: 0.55, x: 12, z: 5.2 },
      ],
      decks: [],
    };
    const to = [28, 0] as const;
    const route = Option.getOrThrow(routeOf(land, standing, [0, 0], to));
    const arrived = Arr.reduce(
      Arr.range(1, 60 * 30),
      { route, walker: walkerAt(land, 0, 0) },
      (so) => {
        const along = followed(so.route, so.walker.x, so.walker.z);
        return {
          route: along.route,
          walker: stepWalker(land, so.walker, along.drive, standing, 1 / 60)
            .walker,
        };
      }
    );
    expect(arrived.route).toEqual([]);
    expect(
      Math.hypot(arrived.walker.x - to[0], arrived.walker.z - to[1])
    ).toBeLessThan(0.5);
    expect(arrived.walker.y).toBe(PLAIN);
  });
});
