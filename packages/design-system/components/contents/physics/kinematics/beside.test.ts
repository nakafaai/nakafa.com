import { describe, expect, it } from "@effect/vitest";
import { besideArrow } from "@repo/design-system/components/contents/physics/kinematics/beside";

describe("besideArrow", () => {
  it("stands left of an upright arrow whose triangle lies to its right", () => {
    expect(besideArrow([0, 0], [0, 4], [3, 4])).toStrictEqual({
      anchorX: "right",
      anchorY: "middle",
      middle: [0, 2],
    });
  });

  it("stands right of an upright arrow whose triangle lies to its left", () => {
    expect(besideArrow([0, 0], [0, 4], [-3, 4])).toStrictEqual({
      anchorX: "left",
      anchorY: "middle",
      middle: [0, 2],
    });
  });

  it("stands over a level arrow whose triangle lies under it", () => {
    expect(besideArrow([0, 4], [3, 4], [0, 0])).toStrictEqual({
      anchorX: "center",
      anchorY: "bottom",
      middle: [1.5, 4],
    });
  });

  it("stands under a level arrow whose triangle lies over it", () => {
    expect(besideArrow([0, 0], [3, 0], [3, 4])).toStrictEqual({
      anchorX: "center",
      anchorY: "top",
      middle: [1.5, 0],
    });
  });

  it("puts the labels of two nearly parallel sides on opposite sides of a thin triangle", () => {
    const own = besideArrow([0, 0], [3.5, 2], [6.5, 2]);
    const sum = besideArrow([0, 0], [6.5, 2], [3.5, 2]);

    expect(own.anchorY).toBe("bottom");
    expect(sum.anchorY).toBe("top");
  });
});
