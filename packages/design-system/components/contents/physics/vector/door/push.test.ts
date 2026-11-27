import { describe, expect, it } from "@effect/vitest";
import {
  pushVectors,
  swingPeriod,
} from "@repo/design-system/components/contents/physics/vector/door/push";
import { swingAngle } from "@repo/design-system/components/contents/physics/vector/door/swing";

describe("pushVectors", () => {
  it("puts the hand on the door at the arm's length from the hinge", () => {
    expect(pushVectors(0.8, 90, 0.5).hand).toEqual([0.8, 0]);
  });

  it("makes the whole push turn the door when it is square to it", () => {
    const push = pushVectors(0.8, 90, 0.5);
    expect(push.force[0]).toBeCloseTo(0, 9);
    expect(push.force[1]).toBeCloseTo(-0.5, 9);
    expect(push.square[1]).toBeCloseTo(-0.5, 9);
  });

  it("leaves nothing square to the door for a push along it", () => {
    const push = pushVectors(0.8, 0, 0.5);
    expect(push.force[0]).toBeCloseTo(0.5, 9);
    expect(Math.abs(push.square[1])).toBeCloseTo(0, 9);
  });

  it("keeps F sin θ square to the door at a slant", () => {
    const push = pushVectors(0.6, 30, 0.5);
    expect(push.square).toEqual([0, push.force[1]]);
    expect(push.square[1]).toBeCloseTo(-0.25, 9);
    expect(Math.hypot(push.force[0], push.force[1])).toBeCloseTo(0.5, 9);
  });
});

describe("swingPeriod", () => {
  it("lasts until the door is wide open, then rests", () => {
    const period = swingPeriod(Math.PI);
    expect(period).toBeCloseTo(1 + 1.2, 9);
    expect(swingAngle(Math.PI, period - 1.2)).toBeCloseTo(90, 9);
  });

  it("does not wait for a push that barely turns the door", () => {
    expect(swingPeriod(0)).toBeCloseTo(8 + 1.2, 9);
  });
});
