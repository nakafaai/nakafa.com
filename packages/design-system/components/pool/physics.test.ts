import { describe, expect, it } from "@effect/vitest";
import type { Ball } from "@repo/design-system/components/pool/ball";
import {
  hop,
  isResting,
  LONGEST_FRAME,
  leave,
  move,
  press,
  REST_FRAMES,
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
  poolWorld,
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
 * The frames in seven seconds at 60 frames a second. The damping of 3 gives a free
 * ball a terminal speed of 500 pixels a second, so a pile of 65 animals in a box
 * of 1200 by 640 rests after 366 frames, which is about six seconds, measured.
 */
const FRAMES_IN_SEVEN_SECONDS = 420;
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
/** A pointer sweep at this speed or faster moves no ball faster than a third of the top speed. */
const GENTLE_SPEED = TOP_SPEED / 3;
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
  const next = step(world, dt, FRAME);
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

/** The fastest that any free ball of a world moves, in pixels per second. */
function fastestFree(world: World): number {
  return Arr.reduce(world.balls, 0, (fastest, ball, index) =>
    index === world.held
      ? fastest
      : Math.max(fastest, Math.hypot(ball.vx, ball.vy))
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

/**
 * Sweeps the pointer across the middle of a settled pool at this speed, in pixels
 * per second. Returns the pool at the end of the sweep, and the fastest free ball.
 */
function sweep(
  world: World,
  box: Pick<World, "height" | "width">,
  speed: number
): readonly [World, number] {
  const distance = box.width;
  const frames = Math.ceil(distance / (speed / FRAME));
  const y = box.height * 0.6;
  let current = world;
  let fastest = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const x = Math.min(distance, frame * speed * FRAME);
    current = tick(move(current, { x, y }), FRAME);
    fastest = Math.max(fastest, fastestFree(current));
  }
  return [current, fastest];
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
    it(`comes to rest within seven seconds in a ${box.width} by ${box.height} box`, () => {
      expect(
        framesUntilRest(
          poolWorld(box.width, box.height),
          FRAMES_IN_SEVEN_SECONDS
        )
      ).toBeLessThanOrEqual(FRAMES_IN_SEVEN_SECONDS);
    });
  }

  it("is at rest only when no ball moved faster than the rest speed", () => {
    const world = boxWith([]);
    expect(isResting({ ...world, moved: 0 })).toBe(true);
    expect(isResting({ ...world, moved: 30 })).toBe(false);
  });

  it("is not at rest while a ball still slides at 30 pixels a second", () => {
    // One step moves this ball only 0.06 pixels, so only a speed tells it apart from a pile at rest.
    const sliding = tick(boxWith([ballAt({ vx: 30, x: 300, y: 300 })]), FRAME);
    expect(isResting(sliding)).toBe(false);
  });

  it("reports the fastest ball in pixels per second, whatever the length of the step", () => {
    // Gravity adds some downward speed in each step, so the fastest ball is a little faster than its sideways speed.
    const world = boxWith([ballAt({ vx: 30, x: 300, y: 300 })]);
    expect(step(world, SHORT, FRAME).moved).toBeGreaterThan(29);
    expect(step(world, STEP, FRAME).moved).toBeGreaterThan(29);
  });

  it("is not at rest after a frame in which a held ball jumped, even when its last step stood still", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    expect(isResting(tick(move(held, { x: 305, y: 300 }), FRAME))).toBe(false);
  });

  it("settles to a standstill with no sideways speed and no lean", () => {
    const settled = settle(
      boxWith([
        ballAt({ tilt: 4, vx: 300, vy: 50, x: 500, y: 600 }),
        ballAt({ tilt: -3, vx: -200, vy: 0, x: 700, y: 600 }),
      ])
    );
    expect(Arr.map(settled.balls, (ball) => ball.vx)).toEqual([0, 0]);
    expect(Arr.map(settled.balls, (ball) => ball.tilt)).toEqual([0, 0]);
  });

  it("settles a pile until it has rested, and no longer", () => {
    const settled = settle(poolWorld(1200, 640));
    expect(isResting(tick(settled, FRAME))).toBe(true);
  });

  it("stays at rest with no pointer: a settled pile is at rest in every frame of six seconds", () => {
    // The loop sleeps on a pile at rest, so a pile that rests must not wake up on its own.
    let world = settle(poolWorld(1200, 640));
    for (let frame = 0; frame < FRAMES_IN_SIX_SECONDS; frame += 1) {
      world = tick(world, FRAME);
      expect(isResting(world), `frame ${frame} moves`).toBe(true);
    }
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

describe("the pointer over the pile", () => {
  for (const speed of [300, 1200]) {
    it(`moves no ball faster than a third of the top speed when the pointer sweeps at ${speed} pixels a second`, () => {
      const box = { height: 640, width: 1200 };
      const settled = settle(poolWorld(box.width, box.height));
      const [, fastest] = sweep(settled, box, speed);
      expect(fastest).toBeLessThanOrEqual(GENTLE_SPEED);
    });
  }

  it("lets the pile rest within about a second after the pointer stops over it", () => {
    const box = { height: 640, width: 1200 };
    const [swept] = sweep(settle(poolWorld(box.width, box.height)), box, 300);
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
      (current, dt) => step(current, dt, FRAME)
    );
    expect(tick(world, FRAME).balls).toEqual(eight.balls);
  });

  it("keeps the time that does not fill a whole step for the next frame", () => {
    const world = boxWith([ballAt({ y: 100 })]);
    const short = tick(world, STEP * 0.6);
    expect(short.balls).toEqual(world.balls);
    expect(short.carry).toBeCloseTo(STEP * 0.6, 12);
    const rest = tick(short, STEP * 0.6);
    expect(rest.balls).toEqual(step(world, STEP, STEP * 0.6).balls);
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
    // The pointer sits just inside the reach of the ball, on its right, and moves right: the ball stays in reach for the whole frame.
    const pointed = {
      ...boxWith([ballAt({ r: 20, x: 600, y: 300 })]),
      pointer: { active: true, vx: 2, vy: 0, x: 600 + 64 - 0.001, y: 300 },
    };
    const passed = (steps: number, dt: number) =>
      Arr.reduce(
        Arr.makeBy(steps, () => dt),
        pointed,
        (current, length) => step(current, length, FRAME)
      ).balls[0].vx;
    // Eight steps of the fixed step and two half steps cover one frame, so each passes on the same speed.
    expect(
      Math.abs(passed(STEPS_IN_FRAME, STEP) - passed(2, FRAME / 2))
    ).toBeLessThan(0.5);
  });
});

describe("the top speed", () => {
  it("keeps a free ball at the top speed when a collision pushes it", () => {
    const next = step(
      boxWith([
        ballAt({ vy: TOP_SPEED, x: 500, y: 300 }),
        ballAt({ vx: -TOP_SPEED, x: 530, y: 300 }),
      ]),
      SHORT,
      FRAME
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
    const next = step(move(held, { x: 340, y: 300 }), SHORT, FRAME);
    expect(next.balls[0].x).toBeCloseTo(330, 6);
  });

  it("hands on the same speed for the same pointer speed, at any frame rate", () => {
    const held = press(boxWith([ballAt({ x: 300, y: 300 })]), {
      x: 300,
      y: 300,
    });
    const handedOn = (frame: number, distance: number) =>
      step(move(held, { x: 300 + distance, y: 300 }), STEP, frame).balls[0].vx;
    // At 60 frames a second the pointer moves 5 pixels a frame, and at 120 frames a second 2.5.
    expect(handedOn(FRAME / 2, 2.5)).toBeCloseTo(handedOn(FRAME, 5), 9);
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

  it("follows a resize with the walls of the new box", () => {
    const resized = resize(boxWith([]), 390, 800);
    expect(resized.width).toBe(390);
    expect(resized.height).toBe(800);
  });
});
