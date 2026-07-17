import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeOnboardingRoleValue,
  decodeOnboardingValue,
} from "@/components/programs/onboarding/state";

describe("components/programs/onboarding/state", () => {
  it("decodes a complete program onboarding value", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        focusKey: "student-exam",
        interests: ["exam-prep", "assessment-prep"],
        primaryProgramKey: "snbt",
        role: "student",
      }).pipe(Effect.either)
    );

    expect(Either.isRight(result)).toBe(true);
    if (!Either.isRight(result)) {
      return;
    }

    expect(result.right).toEqual({
      focusKey: "student-exam",
      interests: ["exam-prep", "assessment-prep"],
      primaryProgramKey: "snbt",
      role: "student",
    });
  });

  it("rejects incomplete program onboarding values", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        primaryProgramKey: "snbt",
      }).pipe(Effect.either)
    );

    expect(Either.isLeft(result)).toBe(true);
  });

  it("decodes a route-owned role step value", () => {
    const role = Effect.runSync(
      decodeOnboardingRoleValue({ role: "teacher" }).pipe(Effect.either)
    );

    expect(Either.isRight(role)).toBe(true);
  });
});
