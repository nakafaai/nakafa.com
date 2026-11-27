import { describe, expect, it } from "@effect/vitest";
import {
  planksAt,
  woodAt,
} from "@repo/design-system/components/three/surface/wood";
import { Array as Arr } from "effect";

/** The places down one column of a tile, `count` of them, evenly spaced. */
function down(count: number) {
  return Arr.makeBy(count, (row) => row / count);
}

describe("woodAt", () => {
  it("darkens and sinks at the late wood of a ring", () => {
    const column = Arr.map(down(1024), (y) => woodAt(0.25, y));
    const shades = Arr.map(column, (place) => place.shade);
    const heights = Arr.map(column, (place) => place.height);

    expect(Math.max(...shades) - Math.min(...shades)).toBeGreaterThan(0.4);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1);
  });

  it("meets itself across the edges of the tile", () => {
    expect(woodAt(0, 0.3).shade).toBeCloseTo(woodAt(1, 0.3).shade, 6);
  });
});

/** How many boards the planks under test lay across their tile. */
const BOARDS = 4;

describe("planksAt", () => {
  it("sinks to nothing in the groove between two boards", () => {
    const edges = Arr.makeBy(BOARDS, (board) =>
      planksAt(0.4, board / BOARDS, BOARDS)
    );

    expect(Arr.every(edges, (edge) => edge.height === 0)).toBe(true);
    expect(planksAt(0.4, 0.5 / BOARDS, BOARDS).height).toBeGreaterThan(0.8);
  });

  it("darkens the groove under the board beside it", () => {
    const middle = planksAt(0.4, 0.5 / BOARDS, BOARDS).shade;

    expect(planksAt(0.4, 0, BOARDS).shade).toBeLessThan(middle);
  });
});
