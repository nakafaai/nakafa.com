// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import type { Standing } from "@/lib/island/collide";
import { BRIDGE } from "@/lib/island/collide";
import type { Land } from "@/lib/island/land/ground";
import {
  cover,
  FACE,
  flood,
  PLAIN,
  plainOf,
  raise,
} from "@/lib/island/test.plain";
import type { Drive, Walker } from "@/lib/island/walker";
import {
  BODY,
  jumped,
  PACE,
  REST,
  stepWalker,
  walkerAt,
} from "@/lib/island/walker";

const OPEN: Standing = { blockers: [], decks: [] };
const FRAME = 1 / 60;
const EAST: Drive = { speed: PACE.walk, x: 1, z: 0 };

const speedOf = (walker: Walker) => Math.hypot(walker.speedX, walker.speedZ);

/** A walker after `seconds` of one drive, a frame at a time, with every footstep it took and every frame it was blocked in. */
function walked(
  land: Land,
  from: Walker,
  drive: Drive,
  seconds: number,
  standing = OPEN
) {
  return Arr.reduce(
    Arr.range(1, Math.round(seconds / FRAME)),
    {
      blocked: 0,
      footsteps: Arr.empty<string>(),
      highest: from.y,
      walker: from,
    },
    (so) => {
      const next = stepWalker(land, so.walker, drive, standing, FRAME);
      return {
        blocked: so.blocked + (next.blocked ? 1 : 0),
        footsteps: Arr.appendAll(so.footsteps, Option.toArray(next.footstep)),
        highest: Math.max(so.highest, next.walker.y),
        walker: next.walker,
      };
    }
  );
}

/** A plain with a wall across it: the ground climbs `rise` blocks between x = 20 and x = 21 and stays up beyond. */
function walled(rise: number) {
  const land = plainOf(1);
  for (const i of Arr.range(21, 31)) {
    for (const j of Arr.range(-32, 63)) {
      raise(land, i, j, PLAIN + rise);
    }
  }
  return land;
}

/** A plain with a pool `depth` blocks deep from x = `from` to x = `to`, a lake or a river. */
function pooled(
  depth: number,
  water: "lake" | "river" = "lake",
  [from, to]: readonly [number, number] = [10, 30]
) {
  const land = plainOf(1);
  for (const i of Arr.range(from, to)) {
    for (const j of Arr.range(-20, 20)) {
      flood(land, i, j, depth, water);
    }
  }
  return land;
}

describe("island/walker", () => {
  it("gathers speed with weight: a held direction reaches a walk in about a third of a second, never at once and never past it", () => {
    const land = plainOf(1);
    const start = walkerAt(land, 0, 0);
    const first = stepWalker(land, start, EAST, OPEN, FRAME).walker;
    expect(speedOf(first)).toBeLessThan(PACE.walk * 0.1);
    expect(speedOf(walked(land, start, EAST, 0.1).walker)).toBeLessThan(
      PACE.walk * 0.5
    );
    const third = walked(land, start, EAST, 0.34).walker;
    expect(speedOf(third)).toBeCloseTo(PACE.walk, 5);
    expect(speedOf(walked(land, start, EAST, 2).walker)).toBeCloseTo(
      PACE.walk,
      5
    );
    expect(
      walked(land, start, { ...EAST, speed: PACE.run }, 2).walker.x
    ).toBeGreaterThan(walked(land, start, EAST, 2).walker.x * 1.4);
  });

  it("slows by friction when nothing is held, sliding a little before it stands", () => {
    const land = plainOf(1);
    const moving = walked(land, walkerAt(land, 0, 0), EAST, 1).walker;
    const soon = stepWalker(land, moving, REST, OPEN, FRAME).walker;
    expect(speedOf(soon)).toBeGreaterThan(PACE.walk * 0.9);
    const stopped = walked(land, moving, REST, 0.3).walker;
    expect(speedOf(stopped)).toBe(0);
    expect(stopped.x - moving.x).toBeGreaterThan(0.3);
    expect(stopped.x - moving.x).toBeLessThan(0.6);
  });

  it("turns to face the way it moves at a limited rate, the short way round", () => {
    const land = plainOf(1);
    const start = walkerAt(land, 0, 0, -3);
    const first = walked(land, start, EAST, 0.1).walker;
    expect(first.yaw).toBeLessThan(-3);
    expect(first.yaw).toBeGreaterThan(-3 - 9 * 0.1 - 1e-9);
    const turned = walked(land, start, EAST, 1).walker;
    expect(Math.sin(turned.yaw)).toBeCloseTo(1, 5);
    // A fox that stands still keeps the way it faced.
    expect(walked(land, start, REST, 0.5).walker.yaw).toBe(-3);
  });

  it("walks slower up a hill and a little quicker down it", () => {
    const land = plainOf(1);
    for (const i of Arr.range(0, 40)) {
      for (const j of Arr.range(-10, 10)) {
        raise(land, i, j, PLAIN + i * 0.5);
      }
    }
    const up = walked(land, walkerAt(land, 5, 0), EAST, 2).walker;
    expect(up.y).toBeGreaterThan(PLAIN + 3);
    expect(speedOf(up)).toBeCloseTo(PACE.walk * (1 - 0.5 * 0.85), 2);
    const down = walked(
      land,
      walkerAt(land, 30, 0),
      { ...EAST, x: -1 },
      2
    ).walker;
    expect(speedOf(down)).toBeCloseTo(PACE.walk * 1.18, 2);
  });

  it("stops at ground too steep to climb without gaining height, and slides along it instead of sticking", () => {
    const land = walled(6);
    const stopped = walked(land, walkerAt(land, 15, 0), EAST, 4);
    expect(stopped.walker.x).toBeLessThan(21);
    expect(stopped.highest).toBeLessThan(PLAIN + 0.4);
    expect(stopped.blocked).toBeGreaterThan(60);
    expect(speedOf(stopped.walker)).toBeLessThan(0.2);
    const sliding = walked(
      land,
      stopped.walker,
      { speed: PACE.walk, x: Math.SQRT1_2, z: Math.SQRT1_2 },
      2
    );
    expect(sliding.walker.z).toBeGreaterThan(1.5);
    expect(sliding.walker.x).toBeLessThan(21);
    expect(sliding.highest).toBeLessThan(PLAIN + 0.4);
    expect(sliding.blocked).toBe(0);
  });

  it("gains no height when it is let go on a slope it cannot climb, whichever way it is driven", () => {
    const land = walled(1.6);
    const start = walkerAt(land, 20.5, 0);
    expect(start.y).toBeCloseTo(PLAIN + 0.8, 5);
    expect(walked(land, start, REST, 1).walker).toEqual(start);
    for (const drive of [
      EAST,
      { speed: PACE.run, x: 0.8, z: 0.6 },
      { speed: PACE.walk, x: 0.6, z: -0.8 },
    ]) {
      expect(walked(land, start, drive, 3).highest).toBeLessThan(
        start.y + 0.01
      );
    }
    // The same slope is walked down.
    const down = walked(land, start, { ...EAST, x: -1 }, 1).walker;
    expect(down.y).toBe(PLAIN);
    expect(down.x).toBeLessThan(19);
  });

  it("never walks off a cliff: at its edge it keeps to the height it stands at", () => {
    const land = walled(6);
    const top = walked(land, walkerAt(land, 25, 0), { ...EAST, x: -1 }, 4);
    expect(top.walker.y).toBeGreaterThan(PLAIN + 5.6);
    expect(top.walker.x).toBeGreaterThan(20.5);
  });

  it("wades shallow water at its own pace and swims where the water is deep, slower, bobbing at the water's face", () => {
    const shallow = pooled(0.3);
    const waded = walked(shallow, walkerAt(shallow, 5, 0), EAST, 4);
    expect(waded.walker.swims).toBe(false);
    expect(waded.walker.x).toBeGreaterThan(17);
    expect(waded.footsteps).toContain("water");
    const deep = pooled(2);
    const swum = walked(deep, walkerAt(deep, 5, 0), EAST, 5);
    expect(swum.walker.swims).toBe(true);
    expect(speedOf(swum.walker)).toBeCloseTo(PACE.swim, 5);
    expect(swum.walker.y).toBeGreaterThan(FACE - 0.32 - 0.05);
    expect(swum.walker.y).toBeLessThan(FACE - 0.32 + 0.05);
    const heights = Arr.map(
      Arr.range(1, 30),
      (frames) => walked(deep, swum.walker, REST, frames * FRAME * 2).walker.y
    );
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.05);
    expect(swum.footsteps).toContain("water");
    expect(walkerAt(deep, 20, 0).swims).toBe(true);
    // A swimmer cannot jump.
    expect(jumped(swum.walker)).toBe(swum.walker);
  });

  it("is carried gently by a river while it swims, and by nothing on its bank", () => {
    const land = pooled(2, "river");
    const start = walkerAt(land, 15, 0);
    const carried = walked(land, start, REST, 2).walker;
    expect(carried.x - start.x).toBeGreaterThan(1);
    expect(carried.x - start.x).toBeLessThan(1.6);
    expect(carried.z).toBe(0);
    expect(speedOf(carried)).toBeCloseTo(0, 6);
    const bank = walkerAt(land, 2, 0);
    expect(walked(land, bank, REST, 1).walker.x).toBe(2);
  });

  it("slides around a trunk in its way and is stopped by a wall it walks straight into", () => {
    const land = plainOf(1);
    const trunk: Standing = {
      blockers: [{ _tag: "round", radius: 0.5, x: 6, z: 0.2 }],
      decks: [],
    };
    const around = walked(land, walkerAt(land, 2, 0), EAST, 3, trunk);
    expect(around.walker.x).toBeGreaterThan(8);
    expect(around.walker.z).toBeLessThan(-0.3);
    const wall: Standing = {
      blockers: [{ _tag: "box", deep: 10, wide: 0.5, x: 6, z: 0 }],
      decks: [],
    };
    const held = walked(land, walkerAt(land, 2, 0), EAST, 3, wall);
    expect(held.walker.x).toBeCloseTo(5.5 - BODY, 5);
    expect(speedOf(held.walker)).toBeLessThan(0.2);
    expect(held.blocked).toBeGreaterThan(60);
    // A fox that finds itself inside something is let out, and gains no speed from it.
    const inside = stepWalker(land, walkerAt(land, 6, 0), REST, trunk, FRAME);
    expect(Math.hypot(inside.walker.x - 6, inside.walker.z - 0.2)).toBeCloseTo(
      0.5 + BODY,
      5
    );
    expect(speedOf(inside.walker)).toBe(0);
  });

  it("jumps under gravity, keeps its speed in the air, and lands on the ground with a footstep", () => {
    const land = plainOf(1);
    const running = walked(land, walkerAt(land, 0, 0), EAST, 1).walker;
    const leapt = jumped(running);
    expect(leapt.airborne).toBe(true);
    expect(jumped(leapt)).toBe(leapt);
    const flight = walked(land, leapt, REST, 0.3);
    expect(flight.walker.airborne).toBe(true);
    expect(flight.highest - PLAIN).toBeGreaterThan(0.6);
    expect(flight.highest - PLAIN).toBeLessThan(0.75);
    expect(flight.footsteps).toEqual([]);
    // In the air nothing takes its speed as the ground would.
    expect(speedOf(flight.walker)).toBeGreaterThan(PACE.walk * 0.7);
    const landed = walked(land, leapt, REST, 0.7);
    expect(landed.walker.airborne).toBe(false);
    expect(landed.walker.y).toBe(PLAIN);
    expect(landed.walker.rise).toBe(0);
    expect(landed.footsteps).toEqual(["grass"]);
  });

  it("treads once a stride on what its paws land on, with a longer stride at a run", () => {
    const land = plainOf(1);
    for (const i of Arr.range(-2, 40)) {
      cover(land, i, 4, "path");
    }
    const start = walked(land, walkerAt(land, 0, 0), EAST, 1).walker;
    const walk = walked(land, start, EAST, 2);
    expect(walk.footsteps.length).toBeGreaterThanOrEqual(14);
    expect(walk.footsteps.length).toBeLessThanOrEqual(16);
    expect(Arr.dedupe(walk.footsteps)).toEqual(["grass"]);
    const path = walked(land, walkerAt(land, 0, 4), EAST, 2);
    expect(Arr.dedupe(path.footsteps)).toEqual(["gravel"]);
    const fast = walked(
      land,
      walked(land, start, { ...EAST, speed: PACE.run }, 1).walker,
      { ...EAST, speed: PACE.run },
      2
    );
    expect(fast.footsteps.length).toBeGreaterThanOrEqual(17);
    expect(fast.footsteps.length).toBeLessThanOrEqual(19);
  });

  it("walks over a bridge's deck instead of swimming under it, on boards", () => {
    const land = pooled(2, "lake", [12, 16]);
    const bridge: Standing = {
      blockers: [],
      decks: [{ lengthwise: "x", x: 14, y: PLAIN, z: 0 }],
    };
    const over = walked(land, walkerAt(land, 7, 0), EAST, 2.5, bridge);
    expect(over.walker.swims).toBe(false);
    expect(over.highest).toBeGreaterThan(PLAIN + BRIDGE.rise);
    expect(over.footsteps).toContain("wood");
    expect(over.walker.x).toBeGreaterThan(13);
  });

  it("stays as it is when no time passes", () => {
    const land = plainOf(0);
    const start = walkerAt(land, 8, 8);
    expect(stepWalker(land, start, EAST, OPEN, 0)).toEqual({
      blocked: false,
      footstep: Option.none(),
      walker: start,
    });
  });
});
