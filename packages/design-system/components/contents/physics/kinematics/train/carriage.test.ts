import { describe, expect, it } from "@effect/vitest";
import {
  passengerVelocity,
  trainVelocity,
} from "@repo/design-system/components/contents/physics/kinematics/train/carriage";

describe("passengerVelocity", () => {
  it("adds the walk to the train's velocity for the platform observer", () => {
    expect(passengerVelocity(20, 1.5, "forward", "platform")).toBe(21.5);
    expect(passengerVelocity(20, 1.5, "backward", "platform")).toBe(18.5);
  });

  it("is the walk alone for a seated passenger", () => {
    expect(passengerVelocity(20, 1.5, "forward", "train")).toBe(1.5);
    expect(passengerVelocity(20, 1.5, "backward", "train")).toBe(-1.5);
  });
});

describe("trainVelocity", () => {
  it("is zero for someone riding it", () => {
    expect(trainVelocity(20, "train")).toBe(0);
    expect(trainVelocity(20, "platform")).toBe(20);
  });
});
