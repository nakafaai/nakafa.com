import { describe, expect, it } from "@effect/vitest";
import {
  ball,
  dome,
} from "@repo/design-system/components/contents/physics/kinematics/round";
import { Array as Arr, Option } from "effect";

describe("ball", () => {
  const outline = ball(2);

  it("runs from the lower pole to the upper pole, both on the axis", () => {
    expect(Arr.head(outline)).toStrictEqual(Option.some([0, 0]));
    expect(Arr.last(outline)).toStrictEqual(Option.some([0, 4]));
  });

  it("keeps every point one radius from the ball's middle and passes its equator once", () => {
    for (const [across, up] of outline) {
      expect(Math.hypot(across, up - 2)).toBeCloseTo(2, 9);
    }
    expect(Arr.filter(outline, ([across]) => across === 2)).toHaveLength(1);
  });
});

describe("dome", () => {
  const outline = dome(3, 1.5);

  it("stands on its rim and closes on the axis at its height", () => {
    const [across, up] = Option.getOrThrow(Arr.head(outline));

    expect(across).toBeCloseTo(3, 9);
    expect(up).toBeCloseTo(0, 9);
    expect(Arr.last(outline)).toStrictEqual(Option.some([0, 1.5]));
  });

  it("rises all the way from the rim to the pole", () => {
    const heights = Arr.map(outline, ([, up]) => up);

    expect(
      Arr.every(
        Arr.zip(Arr.drop(heights, 1), heights),
        ([up, below]) => up > below
      )
    ).toBe(true);
  });
});
