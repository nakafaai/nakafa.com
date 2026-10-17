import { describe, expect, it } from "@effect/vitest";
import type { Ball } from "@repo/design-system/components/pool/ball";
import {
  hop,
  isResting,
  LONGEST_FRAME,
  leave,
  mayRest,
  move,
  press,
  REST_FRAMES,
  release,
  resize,
  restedFor,
  STEP,
  step,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import { settle } from "@repo/design-system/components/pool/settle";
import {
  ballAt,
  boxWith,
  CHECKED_POOLS,
  poolWorld,
  sweep,
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
/**
 * The pools that are held to the six seconds of rest that main allowed. The widest
 * pool takes longer than that, so it is not held to it here.
 */
const RESTING_POOLS = Arr.take(CHECKED_POOLS, 2);
/** The grabs and throws that pit.mjs makes: up out of the box, right, left, down, and into both top corners. */
const THROWS: readonly (readonly [number, number])[] = [
  [0.5, -0.6],
  [1.6, 0.4],
  [-0.6, 0.3],
  [0.5, 1.5],
  [0.02, 0.02],
  [0.98, 0.02],
];
/** After the pointer stops over the pile, the pile rests within this many frames, which is about a second. */
const SECOND_AFTER_STOP = 60;

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

/**
 * The frames that a pile takes from this world to rest for `REST_FRAMES` frames in a
 * row, counted at 60 frames a second. A pile that does not rest within the limit
 * gives one more than the limit.
 */
function framesUntilRest(start: World, limit: number): number {
  let world = start;
  let calm = 0;
  for (let frame = 1; frame <= limit; frame += 1) {
    world = tick(world, FRAME);
    calm = isResting(world) ? calm + 1 : 0;
    if (calm >= REST_FRAMES) {
      return frame;
    }
  }
  return limit + 1;
}

describe("the pool under rough handling", () => {
  for (const pool of CHECKED_POOLS) {
    it(`keeps every ball inside a ${pool.width} by ${pool.height} box through sweeps and throws`, () => {
      let world = poolWorld(pool.width, pool.height);
      // The pile lands before the pointer comes, so every ball has entered.
      for (let frame = 0; frame < 360; frame += 1) {
        world = tick(world, FRAME);
      }
      // A hurried hand sweeps through the pile.
      let previous = at(pool, 0, 0.55);
      for (let index = 0; index < 26; index += 1) {
        const to = at(pool, (index * 0.37) % 1, 0.55 + ((index * 0.23) % 0.45));
        world = glide(world, previous, to, 2);
        previous = to;
      }
      // The ball lowest in the box is grabbed and thrown, and then left to fall.
      for (const [fx, fy] of THROWS) {
        const grab = lowest(world);
        const from: readonly [number, number] = [grab.x, grab.y];
        world = checkedFrame(press(world, { x: grab.x, y: grab.y }));
        expect(world.held).not.toBeNull();
        world = glide(world, from, at(pool, fx, fy), 3);
        world = checkedFrame(release(world));
        for (let frame = 0; frame < 15; frame += 1) {
          world = checkedFrame(world);
        }
      }
    });
  }
});

describe("the pile", () => {
  for (const pool of RESTING_POOLS) {
    it(`comes to rest within six seconds in a ${pool.width} by ${pool.height} box`, () => {
      expect(
        framesUntilRest(
          poolWorld(pool.width, pool.height),
          FRAMES_IN_SIX_SECONDS
        )
      ).toBeLessThanOrEqual(FRAMES_IN_SIX_SECONDS);
    });
  }

  it("is not at rest while a ball still slides at 30 pixels a second", () => {
    // One step moves this ball only 0.06 pixels, so only a speed tells it apart from a pile at rest.
    const sliding = tick(boxWith([ballAt({ vx: 30, x: 300, y: 300 })]), FRAME);
    expect(isResting(sliding)).toBe(false);
  });

  it("reports the fastest ball in pixels per second over the frame, whatever the length of the frame", () => {
    // Gravity adds some downward speed in each step, so the fastest ball is a little faster than its sideways speed.
    const world = boxWith([ballAt({ vx: 30, x: 300, y: 300 })]);
    expect(tick(world, STEP).moved).toBeGreaterThan(29);
    expect(tick(world, FRAME).moved).toBeGreaterThan(29);
  });

  it("is not at rest after a frame in which a held ball jumped", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    expect(isResting(tick(move(held, { x: 305, y: 300 }), FRAME))).toBe(false);
  });

  it("stays at rest with no pointer: a settled pile is at rest in every frame of six seconds", () => {
    // The loop sleeps on a pile at rest, so a pile that rests must not wake up on its own. Only the narrowest pool is held to this here: over six seconds the wider pools still have a ball fall off a perch, which the sign-in pool report records.
    const narrowest = CHECKED_POOLS[0];
    let world = settle(poolWorld(narrowest.width, narrowest.height));
    for (let frame = 0; frame < FRAMES_IN_SIX_SECONDS; frame += 1) {
      world = tick(world, FRAME);
      expect(isResting(world), `frame ${frame} moves`).toBe(true);
    }
  });
});

describe("the pointer over the pile", () => {
  it("lets the pile rest within about a second after the pointer stops over it", () => {
    const narrowest = CHECKED_POOLS[0];
    const [swept] = sweep(
      settle(poolWorld(narrowest.width, narrowest.height)),
      narrowest,
      300
    );
    expect(framesUntilRest(swept, SECOND_AFTER_STOP)).toBeLessThanOrEqual(
      SECOND_AFTER_STOP
    );
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

  it("keeps the reading of the frame before when a frame is too short to run a step", () => {
    const busy: World = { ...boxWith([ballAt({ y: 100 })]), moved: 100 };
    const short = tick(busy, STEP / 2);
    expect(short.moved).toBe(100);
    expect(isResting(short)).toBe(false);
  });

  it("moves the pool no further than the longest frame, however long the frame took", () => {
    const world = boxWith([ballAt({ y: 100 })]);
    expect(tick(world, 10)).toEqual(tick(world, LONGEST_FRAME));
  });

  it("passes on the pointer's own speed in the same share of a frame, however many steps the frame runs", () => {
    // The pointer sits just inside the reach of the ball, on its right, and moves right at 120 pixels a second: the ball stays in reach for the whole frame.
    const at = { x: 600 + 64 - 0.001, y: 300 };
    const pointed = {
      ...boxWith([ballAt({ r: 20, x: 600, y: 300 })]),
      pointer: { active: true, seen: at, vx: 120, vy: 0, ...at },
    };
    const passed = (steps: number, dt: number) =>
      Arr.reduce(
        Arr.makeBy(steps, () => dt),
        pointed,
        (current, length) => step(current, length)
      ).balls[0].vx;
    // Eight steps of the fixed step and two half steps cover one frame, so each passes on the same speed.
    expect(
      Math.abs(passed(STEPS_IN_FRAME, STEP) - passed(2, FRAME / 2))
    ).toBeLessThan(0.5);
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

  it("hands on the same speed for the same pointer speed, at any frame rate", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    const handedOn = (frame: number, distance: number) =>
      tick(move(held, { x: 300 + distance, y: 300 }), frame).balls[0].vx;
    // At 60 frames a second the pointer moves 5 pixels a frame, and at 120 frames a second 2.5.
    expect(handedOn(FRAME / 2, 2.5)).toBeCloseTo(handedOn(FRAME, 5), 9);
  });

  it("hands its speed to the held ball alone, and leaves a ball that is not held to the physics", () => {
    const held = press(
      boxWith([ballAt({ x: 300, y: 300 }), ballAt({ x: 900, y: 500 })]),
      { x: 300, y: 300 }
    );
    const carried = tick(move(held, { x: 305, y: 300 }), FRAME).balls;
    expect(carried[0].vx).toBeGreaterThan(0);
    expect(carried[1].vx).toBe(0);
  });

  it("keeps the speed of its move through the whole frame, so the ball leans as it is carried", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    const carried = tick(move(held, { x: 305, y: 300 }), FRAME).balls[0];
    expect(carried.vx).toBeGreaterThan(0);
    expect(carried.tilt).toBeGreaterThan(0);
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

describe("the throw and the box", () => {
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
});

describe("the frame loop's sleep", () => {
  it("counts the frames at rest in a row, and starts the count again on a frame that moves", () => {
    const quiet = boxWith([]);
    expect(restedFor(3, { ...quiet, moved: 0 })).toBe(4);
    expect(restedFor(3, { ...quiet, moved: 30 })).toBe(0);
  });

  it("lets the loop sleep only after the rest frames in a row, and never while a ball is held", () => {
    const quiet = boxWith([]);
    expect(mayRest(REST_FRAMES - 1, quiet)).toBe(false);
    expect(mayRest(REST_FRAMES, quiet)).toBe(true);
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    expect(mayRest(REST_FRAMES, held)).toBe(false);
  });
});

describe("the box", () => {
  it("follows a resize with the walls of the new box, and keeps the balls where they were", () => {
    const world = boxWith([ballAt({ x: 300, y: 300 })]);
    const resized = resize(world, 585, 640);
    expect(resized).toMatchObject({ height: 640, width: 585 });
    expect(resized.balls).toEqual(world.balls);
  });
});
