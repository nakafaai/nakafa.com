import { describe, expect, it } from "@effect/vitest";
import {
  jetDrop,
  jetShape,
} from "@repo/design-system/components/contents/physics/kinematics/fountain/jet";

describe("jetShape", () => {
  it("reaches farthest at 45 degrees: v squared over g", () => {
    expect(jetShape(8, 45).range).toBeCloseTo(6.4);
    expect(jetShape(8, 45).top).toBeCloseTo(1.6);
  });

  it("lands complementary angles at the same spot", () => {
    expect(jetShape(8, 30).range).toBeCloseTo(jetShape(8, 60).range);
    expect(jetShape(8, 15).range).toBeCloseTo(jetShape(8, 75).range);
  });

  it("sends a vertical jet straight up and back, highest of all", () => {
    expect(jetShape(8, 90).range).toBeCloseTo(0);
    expect(jetShape(8, 90).top).toBeCloseTo(3.2);
    expect(jetShape(8, 90).flight).toBeCloseTo(1.6);
  });
});

describe("jetDrop", () => {
  it("brings a drop back to the ground after its flight time", () => {
    const { flight, range } = jetShape(8, 30);
    const landing = jetDrop(8, 30, flight);
    expect(landing.y).toBeCloseTo(0);
    expect(landing.x).toBeCloseTo(range);
  });
});
