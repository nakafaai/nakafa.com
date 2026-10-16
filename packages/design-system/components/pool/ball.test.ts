import { describe, expect, it } from "@effect/vitest";
import {
  fastest,
  fence,
  tiltOf,
} from "@repo/design-system/components/pool/ball";
import { ballAt } from "@repo/design-system/components/pool/test.fixture";

/** The width and height of the box of these tests. */
const WIDTH = 1200;
const HEIGHT = 640;

describe("the walls", () => {
  it("turns a ball that hits the left wall back, with 0.45 of its speed", () => {
    const next = fence(ballAt({ vx: -200, x: 5 }), WIDTH, HEIGHT);
    expect(next.x).toBe(20);
    expect(next.vx).toBeCloseTo(90, 9);
  });

  it("turns a ball that hits the right wall back, with 0.45 of its speed", () => {
    const next = fence(ballAt({ vx: 200, x: 1195 }), WIDTH, HEIGHT);
    expect(next.x).toBe(1180);
    expect(next.vx).toBeCloseTo(-90, 9);
  });

  it("leaves a ball that is past a wall but moving away from it at its speed", () => {
    const next = fence(ballAt({ vx: 200, x: 5 }), WIDTH, HEIGHT);
    expect(next.x).toBe(20);
    expect(next.vx).toBe(200);
  });

  it("turns a ball that lands on the floor back with 0.32 of its speed, and keeps 0.9 of its sideways speed", () => {
    const next = fence(ballAt({ vx: 100, vy: 400, y: 635 }), WIDTH, HEIGHT);
    expect(next.y).toBe(620);
    expect(next.vy).toBeCloseTo(-128, 9);
    expect(next.vx).toBeCloseTo(90, 9);
  });

  it("stops a ball that lands on the floor too slowly to bounce", () => {
    const next = fence(ballAt({ vy: 20, y: 635 }), WIDTH, HEIGHT);
    expect(next.vy).toBe(0);
  });

  it("keeps the speed of a ball on the floor that is moving up", () => {
    const next = fence(ballAt({ vy: -50, y: 630 }), WIDTH, HEIGHT);
    expect(next.y).toBe(620);
    expect(next.vy).toBe(-50);
  });

  it("does not turn back a ball that falls in from above the top edge", () => {
    const next = fence(
      ballAt({ inside: false, vy: -100, y: -40 }),
      WIDTH,
      HEIGHT
    );
    expect(next.inside).toBe(false);
    expect(next.y).toBe(-40);
    expect(next.vy).toBe(-100);
  });

  it("counts a ball as inside once its top edge is in the box", () => {
    const next = fence(ballAt({ inside: false, y: 25 }), WIDTH, HEIGHT);
    expect(next.inside).toBe(true);
  });

  it("turns back a ball that has been inside and rises into the top wall, with 0.4 of its speed", () => {
    const next = fence(ballAt({ vy: -100, y: 5 }), WIDTH, HEIGHT);
    expect(next.y).toBe(20);
    expect(next.vy).toBeCloseTo(40, 9);
  });

  it("keeps the speed of a ball that has been inside and is already sinking at the top wall", () => {
    const next = fence(ballAt({ vy: 50, y: 5 }), WIDTH, HEIGHT);
    expect(next.y).toBe(20);
    expect(next.vy).toBe(50);
  });
});

describe("the top speed", () => {
  it("limits a fast velocity to 760 pixels per second, and keeps its direction", () => {
    const capped = fastest(3000, 4000);
    expect(capped.vx).toBeCloseTo(456, 9);
    expect(capped.vy).toBeCloseTo(608, 9);
  });

  it("leaves a velocity under the top speed as it is", () => {
    expect(fastest(300, 400)).toEqual({ vx: 300, vy: 400 });
  });
});

describe("the lean", () => {
  it("leans a ball toward its sideways speed, by a fifth of the way each frame", () => {
    expect(tiltOf(ballAt({ vx: 200 }), false)).toBeCloseTo(1.2, 10);
  });

  it("limits the lean to ten degrees either way", () => {
    expect(tiltOf(ballAt({ vx: 1000 }), false)).toBeCloseTo(2, 10);
    expect(tiltOf(ballAt({ tilt: 10, vx: -1000 }), false)).toBeCloseTo(6, 10);
  });

  it("brings a leaning ball back upright at rest, to 0.6 of its lean", () => {
    expect(tiltOf(ballAt({ vx: 200 }), true)).toBeCloseTo(0.72, 10);
  });
});
