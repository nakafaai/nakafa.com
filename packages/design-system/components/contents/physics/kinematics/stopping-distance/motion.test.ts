// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  brakingDistance,
  brakingTime,
  reactionDistance,
  stopPhase,
  stopPosition,
  stoppingDistance,
  stoppingTime,
  stopSpeed,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";

const lesson = { deceleration: 5, reaction: 1, speed: 20 };

describe("stopping motion", () => {
  it("reproduces the lesson's 20 m + 40 m = 60 m stop", () => {
    expect(reactionDistance(lesson)).toBe(20);
    expect(brakingDistance(lesson)).toBe(40);
    expect(stoppingDistance(lesson)).toBe(60);
    expect(brakingTime(lesson)).toBe(4);
    expect(stoppingTime(lesson)).toBe(5);
  });

  it("keeps the speed through the reaction, then loses b every second", () => {
    expect(stopPosition(lesson, -1)).toBe(0);
    expect(stopPosition(lesson, 0.5)).toBe(10);
    expect(stopPosition(lesson, 1)).toBe(20);
    // Two seconds into braking: 20·2 − 5·2²/2 = 30 m past the reaction.
    expect(stopPosition(lesson, 3)).toBe(50);
    expect(stopPosition(lesson, 9)).toBe(60);
    expect(stopSpeed(lesson, 1)).toBe(20);
    expect(stopSpeed(lesson, 3)).toBe(10);
    expect(stopSpeed(lesson, 9)).toBe(0);
  });

  it("names the part of the stop at every moment", () => {
    expect(stopPhase(lesson, 0.2)).toBe("reaction");
    expect(stopPhase(lesson, 2)).toBe("braking");
    expect(stopPhase(lesson, 5)).toBe("rest");
  });

  it("quadruples the braking distance when the speed doubles", () => {
    const fast = { ...lesson, speed: 40 };
    expect(brakingDistance(fast) / brakingDistance(lesson)).toBe(4);
    expect(reactionDistance(fast) / reactionDistance(lesson)).toBe(2);
  });
});
