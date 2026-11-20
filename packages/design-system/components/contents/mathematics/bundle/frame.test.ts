// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { deskFrame } from "@repo/design-system/components/contents/mathematics/bundle/frame";
import type { Point } from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  boxesAt,
  planRun,
  stickAt,
  traysAt,
} from "@repo/design-system/components/contents/mathematics/bundle/staging";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr } from "effect";

/** Counts and bases whose frames the tests read, the largest each base allows among them. */
const CASES = [
  [237, 5],
  [300, 8],
  [300, 7],
  [127, 4],
  [7, 8],
  [15, 2],
] as const;

/** Whether `point` lies inside `frame`, give or take a hair. */
function holds(frame: CoordinateFrame, point: Point) {
  const inside = (axis: "x" | "y" | "z") =>
    point[axis] >= frame[axis].min - 1e-9 &&
    point[axis] <= frame[axis].max + 1e-9;
  return inside("x") && inside("y") && inside("z");
}

describe("bundle frame", () => {
  it("frames the finished desk at rest, with a margin round it", () => {
    for (const [count, base] of CASES) {
      const run = planRun(count, base);
      const frame = deskFrame(count, base, false);
      const outside = Arr.filter(
        Arr.range(0, count - 1),
        (stick) => !holds(frame, stickAt(run, stick, run.duration).at)
      );
      expect(outside).toEqual([]);
      expect(
        Arr.every(traysAt(run, run.duration), (at) => holds(frame, at))
      ).toBe(true);
    }
    const left = deskFrame(237, 5, false);
    const width = left.x.max - left.x.min;
    expect(left.y.min).toBe(0);
    expect(left.z.max).toBeGreaterThan(0.06);
    expect(width).toBeGreaterThan(0.6);
    expect(width).toBeLessThan(0.8);
  });

  it("holds the heap and everything that moves while the rounds run", () => {
    for (const [count, base] of CASES) {
      const run = planRun(count, base);
      const frame = deskFrame(count, base, true);
      const times = Arr.makeBy(Math.ceil(run.duration / 0.2) + 1, (step) =>
        Math.min(step * 0.2, run.duration)
      );
      const outside = Arr.flatMap(times, (time) =>
        Arr.filter(
          Arr.appendAll(
            Arr.map(
              Arr.range(0, count - 1),
              (stick) => stickAt(run, stick, time).at
            ),
            boxesAt(run, time)
          ),
          (at) => !holds(frame, at)
        )
      );
      expect(outside).toEqual([]);
    }
    const resting = deskFrame(237, 5, false);
    const running = deskFrame(237, 5, true);
    expect(running.z.min).toBeLessThan(resting.z.min);
    expect(running.y.max).toBeGreaterThan(resting.y.max);
  });
});
