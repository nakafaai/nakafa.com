import { describe, expect, it } from "@effect/vitest";
import type { Ball } from "@repo/design-system/components/pool/ball";
import { poolWorld } from "@repo/design-system/components/pool/member";
import {
  createWorld,
  hop,
  isResting,
  LONGEST_FRAME,
  leave,
  move,
  press,
  release,
  resize,
  STEP,
  settle,
  step,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import {
  ballAt,
  boxWith,
} from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";

/** A frame of the pool at 60 frames a second. */
const FRAME = 1 / 60;
/** The steps in one frame at 60 frames a second. */
const STEPS_IN_FRAME = Math.round(FRAME / STEP);
/** A step short enough that gravity and damping barely change a speed. */
const SHORT = 0.0001;
/** Float noise that a wall may leave behind, in pixels or pixels per second. */
const NOISE = 1e-9;
/** The top speed, in pixels per second, of anything that is not held. */
const TOP_SPEED = 760;
/** The frames in six seconds at 60 frames a second. */
const FRAMES_IN_SIX_SECONDS = 360;
/** The loop sleeps once the pile has been at rest this many frames in a row. */
const CALM_FRAMES = 20;
/** The two boxes of the stress test: a wide sign-in column, and a phone. */
const BOXES = [
  { height: 640, width: 1200 },
  { height: 800, width: 390 },
];
/** The grabs and throws that pit.mjs makes: up out of the box, right, left, down, and into both top corners. */
const THROWS: readonly (readonly [number, number])[] = [
  [0.5, -0.6],
  [1.6, 0.4],
  [-0.6, 0.3],
  [0.5, 1.5],
  [0.02, 0.02],
  [0.98, 0.02],
];

/** How far a ball lies outside the box, in pixels. The top counts once the ball has entered. */
function outsideBy(world: Pick<World, "height" | "width">, ball: Ball) {
  const above = ball.inside ? ball.r - ball.y : 0;
  return Math.max(
    0,
    ball.r - ball.x,
    ball.x + ball.r - world.width,
    above,
    ball.y + ball.r - world.height
  );
}

/** Steps the pool, then checks every ball: none may lie outside the box, and no free ball may be faster than the top speed. */
function checkedStep(world: World, dt: number): World {
  const next = step(world, dt);
  Arr.forEach(next.balls, (ball, index) => {
    expect(
      outsideBy(next, ball),
      `ball ${index} lies outside`
    ).toBeLessThanOrEqual(NOISE);
    if (index !== next.held) {
      expect(
        Math.hypot(ball.vx, ball.vy),
        `free ball ${index} is faster than the top speed`
      ).toBeLessThanOrEqual(TOP_SPEED + NOISE);
    }
  });
  return next;
}

/** One frame of the pool at 60 frames a second, as checked steps. */
function checkedFrame(world: World): World {
  return Arr.reduce(
    Arr.makeBy(STEPS_IN_FRAME, () => STEP),
    world,
    (current, dt) => checkedStep(current, dt)
  );
}

/** Moves the pointer from `from` to `to` in `steps` parts, with a checked frame after each part. */
function glide(
  world: World,
  from: readonly [number, number],
  to: readonly [number, number],
  steps: number
): World {
  return Arr.reduce(
    Arr.makeBy(steps, (part) => part + 1),
    world,
    (current, part) => {
      const fraction = part / steps;
      return checkedFrame(
        move(current, {
          x: from[0] + (to[0] - from[0]) * fraction,
          y: from[1] + (to[1] - from[1]) * fraction,
        })
      );
    }
  );
}

/** The point at a fraction of the box. */
function at(
  box: Pick<World, "height" | "width">,
  fx: number,
  fy: number
): readonly [number, number] {
  return [fx * box.width, fy * box.height];
}

/** The ball that lies lowest in the box. */
function lowest(world: World): Ball {
  return Arr.reduce(world.balls, world.balls[0], (low, ball) =>
    ball.y > low.y ? ball : low
  );
}

describe("the pool under rough handling", () => {
  for (const box of BOXES) {
    it(`keeps every ball inside a ${box.width} by ${box.height} box through sweeps and throws`, () => {
      let world = poolWorld(box.width, box.height);
      // The pile lands before the pointer comes, so every ball has entered.
      for (let frame = 0; frame < 360; frame += 1) {
        world = tick(world, FRAME);
      }
      // A hurried hand sweeps through the pile.
      let previous = at(box, 0, 0.55);
      for (let index = 0; index < 26; index += 1) {
        const to = at(box, (index * 0.37) % 1, 0.55 + ((index * 0.23) % 0.45));
        world = glide(world, previous, to, 2);
        previous = to;
      }
      // The ball lowest in the box is grabbed and thrown, and then left to fall.
      for (const [fx, fy] of THROWS) {
        const grab = lowest(world);
        const from: readonly [number, number] = [grab.x, grab.y];
        world = checkedFrame(press(world, { x: grab.x, y: grab.y }));
        expect(world.held).not.toBeNull();
        world = glide(world, from, at(box, fx, fy), 3);
        world = checkedFrame(release(world));
        for (let frame = 0; frame < 15; frame += 1) {
          world = checkedFrame(world);
        }
      }
    });
  }
});

describe("the pile", () => {
  for (const box of BOXES) {
    it(`comes to rest within six seconds in a ${box.width} by ${box.height} box`, () => {
      let world = poolWorld(box.width, box.height);
      let calm = 0;
      for (
        let frame = 0;
        frame < FRAMES_IN_SIX_SECONDS && calm < CALM_FRAMES;
        frame += 1
      ) {
        world = tick(world, FRAME);
        calm = isResting(world) ? calm + 1 : 0;
      }
      expect(calm).toBeGreaterThanOrEqual(CALM_FRAMES);
    });
  }

  it("is at rest only when no ball traveled as far as 0.05 pixels", () => {
    const world = boxWith([]);
    expect(isResting({ ...world, moved: 0.049 })).toBe(true);
    expect(isResting({ ...world, moved: 0.05 })).toBe(false);
  });

  it("settles to a standstill with no sideways speed and no lean", () => {
    const settled = settle(
      boxWith([
        ballAt({ tilt: 4, vx: 300, vy: 50, x: 500, y: 600 }),
        ballAt({ tilt: -3, vx: -200, vy: 0, x: 700, y: 600 }),
      ]),
      10
    );
    expect(Arr.map(settled.balls, (ball) => ball.vx)).toEqual([0, 0]);
    expect(Arr.map(settled.balls, (ball) => ball.tilt)).toEqual([0, 0]);
  });

  it("moves a free ball under gravity in one frame", () => {
    const next = tick(boxWith([ballAt({ y: 100 })]), FRAME);
    expect(next.balls[0].y).toBeGreaterThan(100);
    expect(next.balls[0].vy).toBeGreaterThan(0);
  });

  it("fades the pointer's own speed by 0.8 in each frame", () => {
    const base = boxWith([]);
    const next = tick(
      { ...base, pointer: { ...base.pointer, vx: 100, vy: -50 } },
      FRAME
    );
    expect(next.pointer.vx).toBeCloseTo(80, 10);
    expect(next.pointer.vy).toBeCloseTo(-40, 10);
  });
});

describe("the frames and their steps", () => {
  it("runs eight steps of the fixed step in a frame at 60 frames a second", () => {
    const world = boxWith([ballAt({ y: 100 })]);
    const eight = Arr.reduce(
      Arr.makeBy(STEPS_IN_FRAME, () => STEP),
      world,
      (current, dt) => step(current, dt)
    );
    expect(tick(world, FRAME).balls).toEqual(eight.balls);
  });

  it("keeps the time that does not fill a whole step for the next frame", () => {
    const world = boxWith([ballAt({ y: 100 })]);
    const short = tick(world, STEP * 0.6);
    expect(short.balls).toEqual(world.balls);
    expect(short.carry).toBeCloseTo(STEP * 0.6, 12);
    const rest = tick(short, STEP * 0.6);
    expect(rest.balls).toEqual(step(world, STEP).balls);
    expect(rest.carry).toBeCloseTo(STEP * 0.2, 12);
  });

  it("moves the pool no further than the longest frame, however long the frame took", () => {
    const world = boxWith([ballAt({ y: 100 })]);
    expect(tick(world, 10)).toEqual(tick(world, LONGEST_FRAME));
  });
});

describe("the top speed", () => {
  it("keeps a free ball at the top speed when a collision pushes it", () => {
    const next = step(
      boxWith([
        ballAt({ vy: TOP_SPEED, x: 500, y: 300 }),
        ballAt({ vx: -TOP_SPEED, x: 530, y: 300 }),
      ]),
      SHORT
    );
    Arr.forEach(next.balls, (ball) => {
      expect(Math.hypot(ball.vx, ball.vy)).toBeLessThanOrEqual(
        TOP_SPEED + NOISE
      );
    });
  });
});

describe("holding a ball", () => {
  it("takes the topmost ball under the point", () => {
    const pressed = press(
      boxWith([
        ballAt({ x: 300, y: 300 }),
        ballAt({ x: 320, y: 300 }),
        ballAt({ x: 900, y: 500 }),
      ]),
      { x: 310, y: 300 }
    );
    expect(pressed.held).toBe(1);
  });

  it("holds nothing when the press lands on empty space, and still records the pointer", () => {
    const pressed = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 50,
      y: 50,
    });
    expect(pressed.held).toBeNull();
    expect(pressed.pointer).toMatchObject({ x: 50, y: 50 });
  });

  it("changes nothing on a second press while one ball is held", () => {
    const pressed = press(
      boxWith([ballAt({ x: 300, y: 300 }), ballAt({ x: 900, y: 500 })]),
      { x: 300, y: 300 }
    );
    expect(press(pressed, { x: 900, y: 500 })).toEqual(pressed);
  });

  it("lets go on release, and on leave, which also stops the pointer", () => {
    const pressed = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    expect(release(pressed).held).toBeNull();
    const left = leave(move(pressed, { x: 300, y: 300 }));
    expect(left.held).toBeNull();
    expect(left.pointer.active).toBe(false);
  });

  it("moves a held ball to the pointer, keeping its grip", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 310,
      y: 300,
    });
    const next = step(move(held, { x: 340, y: 300 }), SHORT);
    expect(next.balls[0].x).toBeCloseTo(330, 6);
  });

  it("keeps a held ball inside the box while the pointer is outside it, and lets it fall back in once released", () => {
    let current = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    current = glide(current, [300, 300], [1500, 300], 4);
    expect(current.balls[0].x + current.balls[0].r).toBeLessThanOrEqual(
      1200 + NOISE
    );
    current = checkedFrame(leave(current));
    for (let frame = 0; frame < 120; frame += 1) {
      current = checkedFrame(current);
    }
    expect(current.balls[0].x + current.balls[0].r).toBeLessThanOrEqual(
      1200 + NOISE
    );
  });
});

describe("the throw, the box and the start", () => {
  it("throws the chosen ball up with a sideways push from its draws, and leaves the others as they were", () => {
    const world = boxWith([
      ballAt({ x: 100 }),
      ballAt({ x: 500 }),
      ballAt({ x: 900 }),
    ]);
    const thrown = hop(world, 1, 0.5, 1);
    expect(thrown.balls[1].vy).toBeCloseTo(-350, 10);
    expect(thrown.balls[1].vx).toBeCloseTo(45, 10);
    expect(thrown.balls[0]).toEqual(world.balls[0]);
    expect(thrown.balls[2]).toEqual(world.balls[2]);
  });

  it("follows a resize with the walls of the new box", () => {
    const resized = resize(boxWith([]), 390, 800);
    expect(resized.width).toBe(390);
    expect(resized.height).toBe(800);
  });

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
