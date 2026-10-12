import { describe, expect, it } from "@effect/vitest";
import { isMoving, REST } from "@repo/design-system/lib/toy/flight";
import {
  carry,
  drag,
  follow,
  grab,
  type Hold,
  release,
  sendHome,
  still,
} from "@repo/design-system/lib/toy/hand";
import {
  FRAME_SECONDS,
  fly,
  INSIDE,
  MIDDLE,
  TOP_SPEED,
  within,
} from "@repo/design-system/test/toy";
import { Array as Arr, Effect, Option, Random } from "effect";

const SCROLL = { x: 0, y: 0 };

/** Where the pointer was, in the window, at a time in milliseconds. */
function at(t: number, x: number, y: number) {
  return { t, x, y };
}

/** A toy taken at (400, 400) and moved for one frame, so that it leaves at a speed. */
function thrown(vx: number, vy: number) {
  return drag(
    grab(MIDDLE, at(0, 400, 400), SCROLL),
    at(16, 400 + vx * FRAME_SECONDS, 400 + vy * FRAME_SECONDS),
    SCROLL,
    Option.none()
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

describe("a toy sent home while a hand holds it", () => {
  it("stays under the hand, which keeps dragging it", () => {
    const sent = sendHome(thrown(800, -300));
    expect(sent.home).toBe(true);
    expect(sent.toy).toMatchObject({ mode: "held" });
    const further = drag(sent, at(32, 380, 280), SCROLL, INSIDE);
    expect(further.home).toBe(true);
    expect(further.toy).toMatchObject({ mode: "held", x: 80, y: -20 });
  });

  it("goes home from where it is let go, at the speed of the hand, whether it was dragged or not", () => {
    const leaving = release(sendHome(thrown(800, -300)), 16, false);
    expect(leaving.mode).toBe("home");
    expect(leaving.vx).toBeCloseTo(800, 6);
    const pressed = sendHome(grab(MIDDLE, at(0, 400, 300), SCROLL));
    expect(release(pressed, 5, false)).toMatchObject({
      mode: "home",
      vx: 0,
      vy: 0,
      x: 100,
      y: 100,
    });
  });

  it("goes home at once for a person who asked for less motion", () => {
    expect(release(sendHome(thrown(800, -300)), 16, true)).toBe(REST);
  });

  it("is put at rest by a hold that is made still: upright, at no speed, with nowhere to go, and under the hand", () => {
    const leaning = sendHome(thrown(800, -300));
    expect(leaning.toy.tilt).not.toBe(0);
    const calmed = still(leaning);
    expect(calmed.home).toBe(false);
    expect(calmed.toy).toMatchObject({
      mode: "held",
      tilt: 0,
      vx: 0,
      vy: 0,
      x: leaning.toy.x,
      y: leaning.toy.y,
    });
    expect(release(calmed, 16, false)).toMatchObject({
      mode: "free",
      vx: 0,
      vy: 0,
    });
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

/** A path of the hand: 120 readings of the pointer, and how far the page is scrolled at each. */
const wander = Effect.forEach(Arr.range(1, 120), (index) =>
  Effect.all({
    scroll: Random.nextBetween(0, 3000),
    t: Effect.succeed(16 * index),
    x: Random.nextBetween(-2000, 2400),
    y: Random.nextBetween(-2000, 2400),
  })
);

describe("a toy carried and thrown along any path", () => {
  it.effect("never leaves its walls, nor passes the top speed", () =>
    Effect.gen(function* () {
      for (const path of Arr.range(1, 40)) {
        const readings = yield* wander.pipe(Random.withSeed(`path ${path}`));
        const holds = Arr.scan(
          readings,
          grab(MIDDLE, at(0, 400, 400), SCROLL),
          (hold, { scroll, t, x, y }) =>
            drag(hold, at(t, x, y), { x: 0, y: scroll }, INSIDE)
        );
        expect(
          Arr.every(holds, (hold) => within(hold.toy)),
          `path ${path}`
        ).toBe(true);
        const last = Arr.lastNonEmpty(holds);
        const flight = fly(release(last, last.time + 10, false), INSIDE);
        expect(Arr.every(flight, within), `throw ${path}`).toBe(true);
        expect(
          Arr.every(
            flight,
            ({ vx, vy }) =>
              Math.abs(vx) <= TOP_SPEED && Math.abs(vy) <= TOP_SPEED
          ),
          `speed ${path}`
        ).toBe(true);
      }
    })
  );
});
