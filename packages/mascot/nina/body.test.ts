import { describe, expect, it } from "@effect/vitest";
import { HEAD, LEANS } from "@repo/mascot/nina/body";
import { outlineOf } from "@repo/mascot/nina/test.hit";
import { Array as Arr } from "effect";

/** The head ends at her chin, above this line. */
const CHIN = 124;
/** The farthest that any part of her head may come from the middle of a round tile of 100. */
const TILE_REACH = 93;
/** The room that her head keeps beside the window over an edge. */
const EDGE_ROOM = 2;

type Lean = (typeof LEANS)[keyof typeof LEANS];

const HEAD_ONLY = Arr.filter(outlineOf(HEAD), ([, y]) => y <= CHIN);

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
