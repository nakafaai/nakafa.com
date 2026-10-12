import { describe, expect, it } from "@effect/vitest";
import { HEAD, LEANS } from "@repo/mascot/nina/body";
import { cubic } from "@repo/mascot/nina/limb";
import type { Place } from "@repo/mascot/nina/point";
import { Array as Arr } from "effect";

const NUMBER = /-?\d+(\.\d+)?/gu;
const COMMAND = /[MCLZ]/gu;
/** The head ends at her chin, above this line. */
const CHIN = 124;
/** The farthest that any part of her head may come from the middle of a round tile of 100. */
const TILE_REACH = 93;
/** The room that her head keeps beside the window over an edge. */
const EDGE_ROOM = 2;

type Lean = (typeof LEANS)[keyof typeof LEANS];

const ORIGIN: Place = [0, 0];

/** The places along the outline of a path of moves, lines and cubic curves. */
function outline(path: string): readonly Place[] {
  const numbers = Arr.map(Arr.fromIterable(path.matchAll(NUMBER)), ([text]) =>
    Number(text)
  );
  return Arr.reduce(
    Arr.map(Arr.fromIterable(path.matchAll(COMMAND)), ([text]) => text),
    { at: 0, pen: ORIGIN, places: Arr.empty<Place>() },
    ({ at, pen, places }, command) => {
      if (command === "C") {
        const [x1, y1, x2, y2, x3, y3] = Arr.take(Arr.drop(numbers, at), 6);
        const curve = Arr.makeBy(
          12,
          (i): Place => [
            cubic(pen[0], x1, x2, x3, (i + 1) / 12),
            cubic(pen[1], y1, y2, y3, (i + 1) / 12),
          ]
        );
        const end: Place = [x3, y3];
        return { at: at + 6, pen: end, places: [...places, ...curve] };
      }
      if (command === "Z") {
        return { at, pen, places };
      }
      const end: Place = [numbers[at], numbers[at + 1]];
      return { at: at + 2, pen: end, places: [...places, end] };
    }
  ).places;
}

const HEAD_ONLY = Arr.filter(outline(HEAD), ([, y]) => y <= CHIN);

/** How far her head reaches from the middle of a tile, standing as `lean` says, mirrored or not. */
function reach(lean: Lean, mirrored: boolean) {
  const a = (lean.turn * Math.PI) / 180;
  return Arr.reduce(HEAD_ONLY, 0, (far, [hx, y]) => {
    const x = mirrored ? 204 - hx : hx;
    const dx = (x - 102) * lean.size;
    const dy = (y - 200) * lean.size;
    const px = 100 + lean.x + dx * Math.cos(a) - dy * Math.sin(a);
    const py = 200 + lean.y + dx * Math.sin(a) + dy * Math.cos(a);
    return Math.max(far, Math.hypot(px - 100, py - 100));
  });
}

/** The left and right edge of her head over an edge, in a window of 200. */
function span(lean: Lean) {
  const xs = Arr.map(HEAD_ONLY, ([x]) => (x - 102) * lean.size + 100 + lean.x);
  return [Math.min(...xs), Math.max(...xs)] as const;
}

describe("her frame", () => {
  it("keeps her whole head inside a round tile, in all three ways she stands and mirrored", () => {
    const reaches = Arr.flatMap(
      [LEANS.right, LEANS.left, LEANS.center],
      (lean) => [reach(lean, false), reach(lean, true)]
    );
    expect(Math.max(...reaches)).toBeLessThanOrEqual(TILE_REACH);
  });

  it("keeps her head clear of the sides of the window over an edge", () => {
    const [left, right] = span(LEANS.peek);
    expect(left).toBeGreaterThan(EDGE_ROOM);
    expect(right).toBeLessThan(200 - EDGE_ROOM);
  });

  it("notices a head that the frame would cut", () => {
    expect(
      reach({ ...LEANS.center, y: LEANS.center.y + 40 }, false)
    ).toBeGreaterThan(TILE_REACH);
    expect(span({ ...LEANS.peek, x: 20 })[1]).toBeGreaterThan(200 - EDGE_ROOM);
  });
});
