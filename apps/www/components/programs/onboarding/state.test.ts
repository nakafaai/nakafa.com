import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeOnboardingFocusValue,
  decodeOnboardingRoleValue,
  decodeOnboardingValue,
} from "@/components/programs/onboarding/state";

describe("components/programs/onboarding/state", () => {
  it("decodes a complete program onboarding value", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        focusKey: "student-exam",
        interests: ["exam-prep", "assessment-prep"],
        primaryProgramKey: "snbt-2026",
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
      primaryProgramKey: "snbt-2026",
      role: "student",
    });
  });

  it("rejects incomplete program onboarding values", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        primaryProgramKey: "snbt-2026",
      }).pipe(Effect.either)
    );

    expect(Either.isLeft(result)).toBe(true);
  });

  it("decodes route-owned role and focus step values", () => {
    const role = Effect.runSync(
      decodeOnboardingRoleValue({ role: "teacher" }).pipe(Effect.either)
    );
    const focus = Effect.runSync(
      decodeOnboardingFocusValue({ focusKey: "teacher-practice" }).pipe(
        Effect.either
      )
    );

    expect(Either.isRight(role)).toBe(true);
    expect(Either.isRight(focus)).toBe(true);
  });
});
