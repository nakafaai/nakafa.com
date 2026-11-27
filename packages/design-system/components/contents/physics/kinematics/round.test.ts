import { describe, expect, it } from "@effect/vitest";
import {
  ball,
  dome,
} from "@repo/design-system/components/contents/physics/kinematics/round";

describe("ball", () => {
  const outline = ball(2);

  it("runs from the lower pole to the upper pole, both on the axis", () => {
    expect(outline.at(0)).toStrictEqual([0, 0]);
    expect(outline.at(-1)).toStrictEqual([0, 4]);
  });

  it("keeps every point one radius from the ball's middle and passes its equator once", () => {
    for (const [across, up] of outline) {
      expect(Math.hypot(across, up - 2)).toBeCloseTo(2, 9);
    }
    expect(outline.filter(([across]) => across === 2)).toHaveLength(1);
  });
});

describe("dome", () => {
  const outline = dome(3, 1.5);

  it("stands on its rim and closes on the axis at its height", () => {
    expect(outline.at(0)?.[0]).toBeCloseTo(3, 9);
    expect(outline.at(0)?.[1]).toBeCloseTo(0, 9);
    expect(outline.at(-1)).toStrictEqual([0, 1.5]);
  });

  it("rises all the way from the rim to the pole", () => {
    for (let index = 1; index < outline.length; index += 1) {
      expect(outline[index]?.[1]).toBeGreaterThan(outline[index - 1]?.[1] ?? 0);
    }
  });
});
