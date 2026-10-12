import { describe, expect, it } from "@effect/vitest";
import {
  frameSeconds,
  homeward,
  isMoving,
  REST,
  step,
  type Toy,
  transformOf,
} from "@repo/design-system/lib/toy/flight";
import {
  FRAME_SECONDS,
  fly,
  INSIDE,
  MIDDLE,
  PEN,
  within,
} from "@repo/design-system/test/toy";
import { Array as Arr, Option } from "effect";

describe("a toy in flight", () => {
  it("slows down and comes to rest where it landed", () => {
    const frames = fly({ ...MIDDLE, vx: 600, vy: 200 }, Option.none());
    const rested = Arr.lastNonEmpty(frames);
    expect(rested).toMatchObject({ mode: "free", tilt: 0, vx: 0, vy: 0 });
    expect(rested.x).toBeGreaterThan(MIDDLE.x);
    // The speed only falls from one frame to the next.
    const speeds = Arr.map(frames, ({ vx }) => Math.abs(vx));
    expect(
      Arr.every(Arr.zip(speeds, Arr.drop(speeds, 1)), ([a, b]) => b <= a)
    ).toBe(true);
  });

  it("leans with its speed and settles upright", () => {
    const toy: Toy = { ...MIDDLE, vx: 1500 };
    expect(step(toy, FRAME_SECONDS, Option.none()).tilt).toBeGreaterThan(0);
    expect(Arr.lastNonEmpty(fly(toy, Option.none())).tilt).toBe(0);
  });

  it("turns back at a wall with part of its speed", () => {
    const bounced = step({ ...REST, vx: 1000, x: 299 }, FRAME_SECONDS, INSIDE);
    expect(bounced.x).toBe(PEN.maxX);
    expect(bounced.vx).toBeCloseTo(
      -1000 * Math.exp(-3.4 * FRAME_SECONDS) * 0.45,
      6
    );
  });

  it("leaves a toy that is in a hand alone", () => {
    const held: Toy = { ...MIDDLE, mode: "held" };
    expect(step(held, FRAME_SECONDS, INSIDE)).toBe(held);
  });

  it("goes where it is sent when its parent cannot be measured", () => {
    const frames = fly({ ...REST, vx: 2000 }, Option.none());
    expect(Arr.lastNonEmpty(frames).x).toBeGreaterThan(PEN.maxX);
  });

  it.each([
    { name: "right", vx: 2200, vy: 0 },
    { name: "left", vx: -2200, vy: 0 },
    { name: "bottom", vx: 0, vy: 2200 },
    { name: "top", vx: 0, vy: -2200 },
    { name: "bottom right corner", vx: 1700, vy: 1700 },
    { name: "top left corner", vx: -1700, vy: -1700 },
  ])(
    "keeps a toy thrown at the $name wall inside it, and brings it to rest",
    ({ vx, vy }) => {
      const frames = fly({ ...MIDDLE, vx, vy }, INSIDE);
      expect(Arr.every(frames, within)).toBe(true);
      const walls = {
        x: [PEN.minX, PEN.maxX],
        y: [PEN.minY, PEN.maxY],
      };
      expect(
        Arr.some(
          frames,
          ({ x, y }) => Arr.contains(walls.x, x) || Arr.contains(walls.y, y)
        )
      ).toBe(true);
      expect(isMoving(Arr.lastNonEmpty(frames))).toBe(false);
    }
  );

  it("meets both walls in turn when it is larger than its parent", () => {
    const tight = Option.some({ maxX: 0, maxY: 0, minX: 10, minY: 10 });
    const squeezed = step(
      { ...REST, vx: 100, vy: 100, x: 5, y: 5 },
      FRAME_SECONDS,
      tight
    );
    expect(squeezed).toMatchObject({ x: 0, y: 0 });
    expect(squeezed.vx).toBeLessThan(0);
    expect(squeezed.vy).toBeLessThan(0);
  });
});

describe("a toy sent home", () => {
  it("springs back to its place, overshoots as a spring does, and rests there exactly", () => {
    const frames = fly(homeward({ ...REST, x: 180, y: -120 }, false), INSIDE);
    expect(Arr.lastNonEmpty(frames)).toEqual(REST);
    expect(Arr.some(frames, ({ x }) => x < 0)).toBe(true);
    expect(Arr.every(Arr.take(frames, 5), ({ x }) => x !== 0)).toBe(true);
  });

  it("goes home at once for a person who asked for less motion", () => {
    expect(homeward({ ...REST, x: 180, y: -120 }, true)).toBe(REST);
  });
});

describe("the frames", () => {
  it("measures a frame in seconds and never longer than 32 milliseconds", () => {
    expect(frameSeconds(1016, 1000)).toBeCloseTo(0.016, 9);
    expect(frameSeconds(2000, 1000)).toBe(0.032);
  });

  it("takes a step of zero for a frame that is not after the moment the loop woke up, never a negative step and never a whole frame", () => {
    expect(frameSeconds(1000, 1000)).toBe(0);
    expect(frameSeconds(990, 1000)).toBe(0);
    expect(frameSeconds(-5000, 1000)).toBe(0);
  });
});

describe("the transform of a toy", () => {
  it("moves and leans it to one decimal", () => {
    expect(transformOf({ ...REST, tilt: 0.34, x: 12.25, y: -3.04 })).toBe(
      "translate3d(12.3px,-3.0px,0) rotate(0.3deg)"
    );
    expect(transformOf(REST)).toBe("translate3d(0.0px,0.0px,0) rotate(0.0deg)");
  });
});
