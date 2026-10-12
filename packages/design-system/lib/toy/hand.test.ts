import { describe, expect, it } from "@effect/vitest";
import {
  type Bounds,
  isMoving,
  REST,
  step,
  type Toy,
} from "@repo/design-system/lib/toy/flight";
import {
  carry,
  drag,
  follow,
  grab,
  type Hold,
  release,
} from "@repo/design-system/lib/toy/hand";
import { Array as Arr, Option } from "effect";

const SCROLL = { x: 0, y: 0 };
const WALLS: Bounds = { maxX: 300, maxY: 250, minX: -100, minY: -50 };
const INSIDE = Option.some(WALLS);
const FRAME = 0.016;
const TOP_SPEED = 2200;
/** A toy at rest in the middle of its box. */
const MIDDLE: Toy = { ...REST, x: 100, y: 100 };

/** Where the pointer was, in the window, at a time in milliseconds. */
function at(t: number, x: number, y: number) {
  return { t, x, y };
}

/** A toy taken at (400, 400) and moved for one frame, so that it leaves at a speed. */
function thrown(vx: number, vy: number) {
  return drag(
    grab(MIDDLE, at(0, 400, 400), SCROLL),
    at(16, 400 + vx * FRAME, 400 + vy * FRAME),
    SCROLL,
    Option.none()
  );
}

function within(toy: Toy) {
  return (
    toy.x >= WALLS.minX &&
    toy.x <= WALLS.maxX &&
    toy.y >= WALLS.minY &&
    toy.y <= WALLS.maxY
  );
}

describe("a toy in a hand", () => {
  it("follows from the point where it was taken and never jumps under the pointer", () => {
    const taken = grab(MIDDLE, at(0, 400, 300), SCROLL);
    expect(taken.toy).toMatchObject({
      mode: "held",
      vx: 0,
      vy: 0,
      x: 100,
      y: 100,
    });
    const moved = drag(taken, at(16, 430, 360), SCROLL, INSIDE);
    expect(moved.toy).toMatchObject({ x: 130, y: 160 });
    const further = drag(moved, at(32, 380, 280), SCROLL, INSIDE);
    expect(further.toy).toMatchObject({ x: 80, y: 80 });
  });

  it("follows the page when it scrolls under a hand that does not move", () => {
    const moved = drag(
      grab(MIDDLE, at(0, 400, 300), SCROLL),
      at(16, 430, 360),
      SCROLL,
      INSIDE
    );
    const scrolled = follow(moved, { x: 0, y: 40 }, INSIDE);
    expect(scrolled.toy).toMatchObject({ x: 130, y: 200 });
  });

  it("is not dragged until the pointer has travelled five pixels", () => {
    const taken = grab(MIDDLE, at(0, 400, 300), SCROLL);
    const near = drag(taken, at(16, 402, 302), SCROLL, INSIDE);
    expect(near).toBe(taken);
    expect(near.dragged).toBe(false);
    const far = drag(taken, at(16, 403, 302), SCROLL, INSIDE);
    expect(far.dragged).toBe(true);
    expect(far.toy).toMatchObject({ x: 103, y: 102 });
  });

  it("keeps dragging once it began, however short the next stretch", () => {
    const began = drag(
      grab(MIDDLE, at(0, 400, 300), SCROLL),
      at(16, 420, 300),
      SCROLL,
      INSIDE
    );
    const next = drag(began, at(32, 421, 300), SCROLL, INSIDE);
    expect(next.dragged).toBe(true);
    expect(next.toy.x).toBe(121);
  });

  it("keeps the speed of the last stretch and leans into it", () => {
    const held = thrown(1000, -500);
    expect(held.toy.vx).toBeCloseTo(1000, 6);
    expect(held.toy.vy).toBeCloseTo(-500, 6);
    // A lean of 14 degrees at most, of which a hand takes three tenths at once.
    expect(held.toy.tilt).toBeCloseTo(14 * 0.3, 6);
  });

  it("never reads a stretch as shorter than a millisecond", () => {
    const began = drag(
      grab(MIDDLE, at(0, 400, 300), SCROLL),
      at(0, 410, 300),
      SCROLL,
      INSIDE
    );
    expect(began.toy.vx).toBe(10 / 0.001);
  });
});

describe("letting go", () => {
  it("throws a toy at the speed of the hand", () => {
    const flying = release(thrown(800, -300), 16, false);
    expect(flying.mode).toBe("free");
    expect(flying.vx).toBeCloseTo(800, 6);
    expect(flying.vy).toBeCloseTo(-300, 6);
  });

  it("caps a throw at the top speed on each axis", () => {
    const flying = release(thrown(9000, -9000), 16, false);
    expect(flying.vx).toBe(TOP_SPEED);
    expect(flying.vy).toBe(-TOP_SPEED);
  });

  it("throws nothing when the hand rested more than 80 milliseconds before letting go", () => {
    const held = thrown(900, 900);
    expect(release(held, 16 + 80, false).vx).toBeCloseTo(900, 6);
    expect(release(held, 16 + 81, false)).toMatchObject({
      mode: "free",
      vx: 0,
      vy: 0,
    });
  });

  it("throws nothing for a press that never moved, and drops the lean", () => {
    const pressed = grab({ ...MIDDLE, tilt: 7 }, at(0, 400, 300), SCROLL);
    expect(release(pressed, 5, false)).toEqual({
      ...MIDDLE,
      mode: "free",
      tilt: 0,
    });
  });

  it("throws nothing for a person who asked for less motion", () => {
    const flying = release(thrown(900, 900), 16, true);
    expect(flying).toMatchObject({ mode: "free", tilt: 0, vx: 0, vy: 0 });
    expect(isMoving(flying)).toBe(false);
  });
});

describe("a toy that pulls the page", () => {
  const dragged: Hold = drag(
    grab(MIDDLE, at(0, 400, 300), SCROLL),
    at(16, 420, 300),
    SCROLL,
    INSIDE
  );
  const heldAt = (y: number): Hold => ({ ...dragged, point: { x: 420, y } });

  it("pulls it up near the top, down near the bottom, and not at all between", () => {
    expect(carry(heldAt(0), 800, 0.016)).toBeCloseTo(-900 * 0.016, 9);
    expect(carry(heldAt(42), 800, 0.016)).toBeCloseTo(-450 * 0.016, 9);
    expect(carry(heldAt(400), 800, 0.016)).toBe(0);
    expect(carry(heldAt(758), 800, 0.016)).toBeCloseTo(450 * 0.016, 9);
    expect(carry(heldAt(800), 800, 0.016)).toBeCloseTo(900 * 0.016, 9);
  });

  it("pulls no faster outside the window than at its edge", () => {
    expect(carry(heldAt(-300), 800, 0.016)).toBeCloseTo(-900 * 0.016, 9);
    expect(carry(heldAt(1200), 800, 0.016)).toBeCloseTo(900 * 0.016, 9);
  });

  it("pulls nothing while the hand has not dragged", () => {
    expect(carry(grab(MIDDLE, at(0, 400, 790), SCROLL), 800, 0.016)).toBe(0);
  });
});

/** The n-th number, from `low` up to `high`, of a fixed sequence: every run takes the same paths. */
function spread(n: number, low: number, high: number) {
  const noise = Math.sin(n * 12.9898) * 43_758.5453;
  return low + (noise - Math.floor(noise)) * (high - low);
}

describe("a toy carried and thrown along any path", () => {
  it("never leaves its walls, nor passes the top speed", () => {
    for (const path of Arr.range(1, 40)) {
      const holds = Arr.scan(
        Arr.makeBy(120, (index) => index + 1),
        grab(MIDDLE, at(0, 400, 400), SCROLL),
        (hold, index) => {
          const base = path * 1000 + index * 3;
          return drag(
            hold,
            at(
              16 * index,
              spread(base, -2000, 2400),
              spread(base + 1, -2000, 2400)
            ),
            { x: 0, y: spread(base + 2, 0, 3000) },
            INSIDE
          );
        }
      );
      expect(
        Arr.every(holds, (hold) => within(hold.toy)),
        `path ${path}`
      ).toBe(true);
      const last = Arr.lastNonEmpty(holds);
      const flight = Arr.scan(
        Arr.makeBy(600, () => FRAME),
        release(last, last.time + 10, false),
        (toy, dt) => (isMoving(toy) ? step(toy, dt, INSIDE) : toy)
      );
      expect(Arr.every(flight, within), `throw ${path}`).toBe(true);
      expect(
        Arr.every(
          flight,
          ({ vx, vy }) => Math.abs(vx) <= TOP_SPEED && Math.abs(vy) <= TOP_SPEED
        ),
        `speed ${path}`
      ).toBe(true);
    }
  });
});
