import { describe, expect, it } from "@effect/vitest";
import {
  AIM_ANGLE,
  aimOutcome,
  aimPlaces,
  TARGET,
} from "@repo/design-system/components/contents/physics/kinematics/hunter/aim";

describe("aim", () => {
  it("points the launcher straight at the can", () => {
    expect(Math.tan(AIM_ANGLE)).toBeCloseTo(TARGET.height / TARGET.distance);
  });

  it("meets the can at its line, where both have fallen the same height", () => {
    const outcome = aimOutcome(10);
    const places = aimPlaces(10, outcome.meet);
    expect(outcome.hit).toBe(true);
    expect(places.ball.x).toBeCloseTo(TARGET.distance);
    expect(places.ball.y).toBeCloseTo(places.can.y);
    expect(outcome.drop).toBeCloseTo(1, 1);
  });

  it("misses when the ball is so slow the can lands first", () => {
    expect(aimOutcome(5).hit).toBe(false);
    expect(aimPlaces(5, 2).can.y).toBe(0);
    expect(aimPlaces(5, 2).ball.y).toBe(0);
  });
});
