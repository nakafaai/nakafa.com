// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import type { Land } from "@/lib/island/land/ground";
import type { Loose } from "@/lib/island/loose";
import {
  bumped,
  KINDS,
  LooseKind,
  looseAt,
  stepLoose,
  tapped,
} from "@/lib/island/loose";
import {
  cover,
  FACE,
  flood,
  PLAIN,
  plainOf,
  raise,
} from "@/lib/island/test.plain";

const FRAME = 1 / 60;
const BALL = KINDS.ball.radius;

/** A loose thing after `seconds`, a frame at a time, with the highest it rose on the way. */
function rolled(land: Land, from: Loose, seconds: number) {
  return Arr.reduce(
    Arr.range(1, Math.round(seconds / FRAME)),
    { highest: from.y, loose: from },
    (so) => {
      const loose = stepLoose(land, so.loose, FRAME);
      return { highest: Math.max(so.highest, loose.y), loose };
    }
  );
}

/** A ball lying on a plain at a place. */
function ballAt(x: number, z: number, y = PLAIN + BALL) {
  return looseAt("ball", "ball", [x, y, z]);
}

/** A fox at a walk toward +x, at a place. */
const FOX = { speedX: 3.4, speedZ: 0, x: 0, y: PLAIN, z: 0 };

describe("island/loose", () => {
  it("lets a ball lie still on flat grass, and puts it to sleep", () => {
    const land = plainOf(1);
    const lain = rolled(land, ballAt(4, 4), 2).loose;
    expect([lain.x, lain.y, lain.z]).toEqual([4, PLAIN + BALL, 4]);
    expect(lain.still).toBeGreaterThan(1.2);
    expect(stepLoose(land, lain, FRAME)).toBe(lain);
    expect(stepLoose(land, ballAt(4, 4), 0)).toEqual(ballAt(4, 4));
  });

  it("sends a ball the fox walks into a few blocks over flat grass, where it stops", () => {
    const land = plainOf(1);
    const kicked = Option.getOrThrow(bumped(ballAt(0.4, 0), FOX, 0.35));
    expect(kicked.speedX).toBeGreaterThan(FOX.speedX);
    expect(kicked.speedY).toBeGreaterThan(2);
    const soon = rolled(land, kicked, 0.5).loose;
    expect(soon.x).toBeGreaterThan(2);
    const rest = rolled(land, kicked, 8).loose;
    expect(rest.x).toBeGreaterThan(3.5);
    expect(rest.x).toBeLessThan(9);
    expect(Math.hypot(rest.speedX, rest.speedZ)).toBe(0);
    expect(rest.y).toBeCloseTo(PLAIN + BALL, 5);
    expect(rest.still).toBeGreaterThan(1.2);
    // It turned as it rolled, the way it went: once round for every 2 pi of its radius.
    expect(rest.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(rest.roll).toBeGreaterThan((rest.x - 0.4) / BALL - 0.5);
    // A run sends it farther than a walk.
    const hard = Option.getOrThrow(
      bumped(ballAt(0.4, 0), { ...FOX, speedX: 5.6 }, 0.35)
    );
    expect(rolled(land, hard, 10).loose.x).toBeGreaterThan(rest.x + 2);
  });

  it("is kicked only by a fox that moves, touches it, and stands at its height", () => {
    expect(bumped(ballAt(0.4, 0), { ...FOX, speedX: 0.2 }, 0.35)).toEqual(
      Option.none()
    );
    expect(bumped(ballAt(0.7, 0), FOX, 0.35)).toEqual(Option.none());
    expect(bumped(ballAt(0.4, 0, PLAIN + 2), FOX, 0.35)).toEqual(Option.none());
    // A ball right under the fox still flies off, the way the fox goes.
    const under = Option.getOrThrow(bumped(ballAt(0, 0), FOX, 0.35));
    expect(under.speedX).toBeGreaterThan(0);
    expect(under.speedZ).toBe(0);
  });

  it("kicks a tapped ball away from the fox with a hop, when the fox stands within reach of it", () => {
    const kicked = Option.getOrThrow(tapped(ballAt(2, 0), [0, 0]));
    expect([kicked.speedX, kicked.speedY, kicked.speedZ]).toEqual([5, 3.5, 0]);
    expect(tapped(ballAt(3.2, 0), [0, 0])).toEqual(Option.none());
    expect(Option.getOrThrow(tapped(ballAt(1, 1), [1, 1])).speedY).toBe(3.5);
    const still = { ...ballAt(0, 2), still: 5 };
    expect(Option.getOrThrow(tapped(still, [0, 0])).still).toBe(0);
  });

  it("bounces a dropped ball lower each time, and a mango hardly at all", () => {
    const land = plainOf(1);
    const dropped = ballAt(4, 4, PLAIN + 3);
    const fall = rolled(land, dropped, 0.8).loose;
    expect(fall.speedY).toBeGreaterThan(2);
    const first = rolled(land, fall, 1).highest - PLAIN;
    expect(first).toBeGreaterThan(0.8);
    expect(first).toBeLessThan(2);
    const rest = rolled(land, dropped, 8).loose;
    expect(rest.y).toBeCloseTo(PLAIN + BALL, 5);
    const mango = looseAt("mango", "m", [4, PLAIN + 3, 4]);
    const landed = rolled(land, mango, 0.78).loose;
    expect(rolled(land, landed, 1).highest - PLAIN).toBeLessThan(0.5);
    // However fast a thing falls, it never passes through the ground.
    const shot = { ...ballAt(4, 4, PLAIN + 3), speedY: -60 };
    expect(stepLoose(land, shot, FRAME).y).toBeGreaterThanOrEqual(PLAIN + BALL);
  });

  it("rolls a ball down a hill and keeps it on a gentle slope", () => {
    const sloped = (rise: number) => {
      const land = plainOf(1);
      for (const i of Arr.range(-20, 40)) {
        for (const j of Arr.range(-10, 10)) {
          raise(land, i, j, PLAIN + i * rise);
        }
      }
      return land;
    };
    const hill = sloped(0.3);
    const down = rolled(hill, ballAt(20, 0, PLAIN + 6 + BALL), 3).loose;
    expect(down.x).toBeLessThan(16);
    expect(down.speedX).toBeLessThan(-1);
    expect(down.y).toBeLessThan(PLAIN + 6);
    const gentle = sloped(0.05);
    const held = rolled(gentle, ballAt(20, 0, PLAIN + 1 + BALL), 3).loose;
    expect(held.x).toBeCloseTo(20, 2);
    expect(held.still).toBeGreaterThan(1.2);
  });

  it("rolls farther along a path than over turf", () => {
    const land = plainOf(1);
    for (const i of Arr.range(-2, 40)) {
      cover(land, i, 8, "path");
    }
    const push = (z: number) => ({ ...ballAt(0, z), speedX: 6 });
    const turf = rolled(land, push(0), 10).loose.x;
    const path = rolled(land, push(8), 10).loose.x;
    expect(path).toBeGreaterThan(turf * 1.3);
  });

  it("floats on water, each kind as deep as it lies, and is carried along by a river", () => {
    const pool = (water: "lake" | "river") => {
      const land = plainOf(1);
      for (const i of Arr.range(-20, 40)) {
        for (const j of Arr.range(-10, 10)) {
          flood(land, i, j, 2, water);
        }
      }
      return land;
    };
    const lake = pool("lake");
    for (const kind of LooseKind.literals) {
      const afloat = rolled(
        lake,
        looseAt(kind, kind, [0, PLAIN + 2, 0]),
        6
      ).loose;
      const { draft, radius } = KINDS[kind];
      expect(afloat.afloat).toBe(true);
      expect(afloat.y).toBeCloseTo(FACE + radius * (1 - 2 * draft), 2);
      expect(afloat.y - radius).toBeGreaterThan(FACE - 2);
    }
    // A ball rides high, most of it over the water.
    const ball = rolled(lake, ballAt(0, 0, PLAIN + 2), 6).loose;
    expect(ball.y).toBeGreaterThan(FACE);
    expect(ball.still).toBeGreaterThan(1.2);
    // A push on still water dies away; a river keeps carrying.
    const pushed = rolled(lake, { ...ball, speedX: 3, still: 0 }, 6).loose;
    expect(Math.abs(pushed.speedX)).toBeLessThan(0.01);
    const river = pool("river");
    const carried = rolled(river, ballAt(0, 0, PLAIN + 1), 6).loose;
    expect(carried.speedX).toBeCloseTo(1.5, 1);
    expect(carried.x).toBeGreaterThan(5);
    expect(carried.still).toBe(0);
  });
});
