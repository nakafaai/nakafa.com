import { describe, expect, it } from "@effect/vitest";
import { press } from "@repo/design-system/components/pool/physics";
import { createWorld, fit } from "@repo/design-system/components/pool/place";
import {
  ballAt,
  boxWith,
} from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";

describe("the start of the balls", () => {
  it("starts every ball above the box, spread across its width by its fractions", () => {
    const world = createWorld(390, 800, [
      { fx: 0, fy: 0, r: 20, vx: 0 },
      { fx: 1, fy: 1, r: 20, vx: 10 },
    ]);
    expect(world.balls[0].x).toBe(20);
    expect(world.balls[1].x).toBeCloseTo(370, 10);
    expect(world.balls[0].y).toBe(-20);
    expect(world.balls[1].y).toBeCloseTo(-20 - 800 * 1.2, 10);
    expect(Arr.every(world.balls, (ball) => !ball.inside)).toBe(true);
  });
});

describe("the count of a pool that changes", () => {
  it("keeps the balls that stay in place, with their speed, and takes the radius of their start", () => {
    const world = boxWith([
      ballAt({ r: 20, vx: 50, x: 100, y: 300 }),
      ballAt({ r: 20, vy: -30, x: 200, y: 300 }),
    ]);
    const fitted = fit(world, [
      { fx: 0.1, fy: 0.1, r: 30, vx: 0 },
      { fx: 0.2, fy: 0.2, r: 20, vx: 0 },
    ]);
    expect(fitted.balls).toEqual([
      { ...world.balls[0], r: 30 },
      world.balls[1],
    ]);
  });

  it("adds a ball above the box for each start past the balls there are", () => {
    const fitted = fit(boxWith([ballAt({ x: 100, y: 300 })]), [
      { fx: 0.1, fy: 0.1, r: 20, vx: 0 },
      { fx: 0.5, fy: 0.5, r: 20, vx: 0 },
    ]);
    expect(fitted.balls).toHaveLength(2);
    expect(fitted.balls[1].inside).toBe(false);
    expect(fitted.balls[1].y).toBeLessThan(0);
    expect(fitted.balls[1].x).toBeCloseTo(20 + 0.5 * 1160, 10);
  });

  it("drops the balls past the last start, and lets go of a held ball that is dropped", () => {
    const held = press(
      boxWith([ballAt({ x: 100, y: 300 }), ballAt({ x: 900, y: 300 })]),
      { x: 900, y: 300 }
    );
    const start = { fx: 0.1, fy: 0.1, r: 20, vx: 0 };
    const dropped = fit(held, [start]);
    expect(dropped.balls).toHaveLength(1);
    expect(dropped.held).toBeNull();
    expect(fit(held, [start, start]).held).toBe(1);
  });
});
