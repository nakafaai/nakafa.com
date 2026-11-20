// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import type { Blocker, Deck } from "@/lib/island/collide";
import {
  BRIDGE,
  blocksAt,
  clearOf,
  deckAt,
  groundAt,
} from "@/lib/island/collide";
import { FACE, flood, PLAIN, plainOf } from "@/lib/island/test.plain";

const TRUNK: Blocker = { _tag: "round", radius: 0.5, x: 10, z: 10 };
const WALL: Blocker = { _tag: "box", deep: 1, wide: 3, x: 20, z: 20 };
const BODY = 0.35;

describe("island/collide", () => {
  it("moves a body out of a trunk along the shortest way and leaves one that stands clear", () => {
    const [x, z] = clearOf([TRUNK], 10.3, 10.4, BODY);
    expect(Math.hypot(x - 10, z - 10)).toBeCloseTo(0.85, 6);
    expect((x - 10) / (z - 10)).toBeCloseTo(0.75, 6);
    expect(clearOf([TRUNK], 11, 10, BODY)).toEqual([11, 10]);
    // On the very middle no way is the shortest; it is let out along +x.
    expect(clearOf([TRUNK], 10, 10, BODY)).toEqual([10.85, 10]);
  });

  it("moves a body off a wall's side, off its corner, and out through its nearest side from inside", () => {
    expect(clearOf([WALL], 21, 21.2, BODY)).toEqual([21, 21.35]);
    const [x, z] = clearOf([WALL], 23.1, 21.1, BODY);
    expect(Math.hypot(x - 23, z - 21)).toBeCloseTo(BODY, 6);
    expect(clearOf([WALL], 24, 22, BODY)).toEqual([24, 22]);
    expect(clearOf([WALL], 20.5, 20.8, BODY)).toEqual([20.5, 21.35]);
    expect(clearOf([WALL], 20.5, 19.4, BODY)).toEqual([20.5, 18.65]);
    expect(clearOf([WALL], 22.9, 20.2, BODY)).toEqual([23.35, 20.2]);
    expect(clearOf([WALL], 17.1, 19.8, BODY)).toEqual([16.65, 19.8]);
  });

  it("clears a body of everything at once, so it rests beside two things that stand together", () => {
    const [x, z] = clearOf(
      [TRUNK, { _tag: "round", radius: 0.5, x: 11.2, z: 10 }],
      10.6,
      10.05,
      BODY
    );
    expect(Math.hypot(x - 11.2, z - 10)).toBeGreaterThanOrEqual(0.85 - 1e-9);
  });

  it("tells where a body would stand in something", () => {
    expect(blocksAt([TRUNK, WALL], 10.6, 10.5, BODY)).toBe(true);
    expect(blocksAt([TRUNK, WALL], 11, 11, BODY)).toBe(false);
    expect(blocksAt([TRUNK, WALL], 23.2, 21.2, BODY)).toBe(true);
    expect(blocksAt([TRUNK, WALL], 23.4, 20, BODY)).toBe(false);
    expect(blocksAt([TRUNK, WALL], 20, 21.4, BODY)).toBe(false);
  });

  it("arches a bridge's deck from its ends up to mid span, along the way it runs, and nowhere beside it", () => {
    const across: Deck = { lengthwise: "x", x: 30, y: PLAIN, z: 5 };
    const deep: Deck = { lengthwise: "z", x: 50, y: PLAIN + 2, z: 5 };
    expect(deckAt([across, deep], 30, 5)).toEqual(
      Option.some(PLAIN + BRIDGE.foot + BRIDGE.rise)
    );
    expect(
      Option.getOrThrow(deckAt([across, deep], 30 + BRIDGE.half, 5.5))
    ).toBeCloseTo(PLAIN + BRIDGE.foot, 6);
    expect(deckAt([across, deep], 30, 5 + BRIDGE.walk + 0.1)).toEqual(
      Option.none()
    );
    expect(deckAt([across, deep], 30 + BRIDGE.half + 0.1, 5)).toEqual(
      Option.none()
    );
    expect(deckAt([across, deep], 50.5, 5 - BRIDGE.half + 0.01)).toEqual(
      Option.some(expect.closeTo(PLAIN + 2 + BRIDGE.foot, 1))
    );
    expect(deckAt([across, deep], 50 + BRIDGE.half - 0.1, 5)).toEqual(
      Option.none()
    );
    // Where two decks cross, the higher one is walked on.
    const over: Deck = { lengthwise: "z", x: 30, y: PLAIN + 1, z: 5 };
    expect(deckAt([over, across], 30, 5)).toEqual(
      Option.some(PLAIN + 1 + BRIDGE.foot + BRIDGE.rise)
    );
    expect(deckAt([across, over], 30, 5)).toEqual(
      Option.some(PLAIN + 1 + BRIDGE.foot + BRIDGE.rise)
    );
  });

  it("rests a walker on the land, and on a deck where one crosses water or ground below it", () => {
    const land = plainOf(0);
    for (const i of [8, 9, 10, 11, 12]) {
      for (const j of [3, 4, 5, 6, 7]) {
        flood(land, i, j, 2);
      }
    }
    const deck: Deck = { lengthwise: "x", x: 10, y: PLAIN, z: 5 };
    expect(groundAt(land, [], 20, 20)).toBe(PLAIN);
    expect(groundAt(land, [], 10, 5)).toBeLessThan(FACE);
    expect(groundAt(land, [deck], 10, 5)).toBeCloseTo(
      PLAIN + BRIDGE.foot + BRIDGE.rise,
      6
    );
    // A deck sunk under the ground is not stood on.
    expect(
      groundAt(land, [{ ...deck, x: 20, y: PLAIN - 5, z: 20 }], 20, 20)
    ).toBe(PLAIN);
  });
});
