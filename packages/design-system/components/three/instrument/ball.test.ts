import { describe, expect, it } from "@effect/vitest";
import {
  ballOutline,
  studTop,
} from "@repo/design-system/components/three/instrument/ball";
import { Array as Arr, Option } from "effect";

describe("pendulum bob outline", () => {
  it("closes on the axis at the bottom of the ball and at the top of the stud", () => {
    const outline = ballOutline(0.19);

    expect(outline[0]).toEqual([0, -0.19]);
    expect(Arr.last(outline)).toEqual(Option.some([0, studTop(0.19)]));
  });

  it("keeps every point of the ball on its sphere, up to the seat of the stud", () => {
    const ball = Arr.take(ballOutline(0.27), 17);

    for (const [radius, height] of ball) {
      expect(Math.hypot(radius, height)).toBeCloseTo(0.27, 12);
    }
    expect(ball[16]?.[0]).toBeCloseTo(0.034, 12);
  });

  it("rises the same stud over a larger ball's higher seat", () => {
    expect(studTop(0.27)).toBeGreaterThan(studTop(0.19));
    expect(studTop(0.19)).toBeCloseTo(Math.sqrt(0.19 ** 2 - 0.034 ** 2) + 0.062, 12);
  });
});
