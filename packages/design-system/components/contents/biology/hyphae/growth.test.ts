// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  coverOf,
  growOf,
  lengthOf,
  sporesOf,
  TEMPEH,
} from "@repo/design-system/components/contents/biology/hyphae/growth";
import { Array as Arr } from "effect";

describe("tempeh mould", () => {
  it("grows each tip 1 mm an hour", () => {
    const spores = sporesOf(3);
    const { segments, tips } = growOf(spores, 0.5, 1);
    expect(tips).toHaveLength(3);
    expect(lengthOf(segments)).toBeCloseTo(1.5);
  });

  it("branches every 2 mm until the tray is full", () => {
    const run = Arr.reduce(
      Arr.range(1, 40),
      { length: 0, tips: sporesOf(4) },
      (state, hour) => {
        const next = growOf(state.tips, 1, hour);
        return {
          length: state.length + lengthOf(next.segments),
          tips: next.tips,
        };
      }
    );
    expect(run.tips.length).toBe(TEMPEH.tips);
    expect(run.length).toBeGreaterThan(1000);
  });

  it("keeps every tip on the tray and turns it back from the edge", () => {
    const edge = [{ heading: 0, id: 0, travelled: 0, x: 14.9, y: 0 }];
    const { tips } = growOf(edge, 1, 1);
    const [tip] = tips;
    expect(tip && Math.abs(tip.x)).toBeLessThanOrEqual(TEMPEH.size / 2);
    expect(tip && Math.cos(tip.heading)).toBeLessThan(0);
  });

  it("measures how much of the tray the hyphae reach", () => {
    expect(coverOf([], 10)).toBe(0);
    expect(coverOf([[0, 0, 15, 15]], 2)).toBe(0.25);
    expect(
      coverOf(
        [
          [0, 0, -15, -15],
          [0, 0, 1, 1],
        ],
        2
      )
    ).toBe(0.5);
  });
});
