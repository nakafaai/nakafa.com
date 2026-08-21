import { Effect, Result } from "effect";
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
        interest: "exam-prep",
        programKey: "snbt",
        role: "student",
      }).pipe(Effect.result)
    );
    expect(Result.isSuccess(result)).toBe(true);
    if (!Result.isSuccess(result)) {
      return;
    }
    expect(result.success).toEqual({
      focusKey: "student-exam",
      interest: "exam-prep",
      programKey: "snbt",
      role: "student",
    });
  });
  it("rejects incomplete program onboarding values", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        programKey: "snbt",
      }).pipe(Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
  });
  it("decodes a route-owned role step value", () => {
    const role = Effect.runSync(
      decodeOnboardingRoleValue({ role: "teacher" }).pipe(Effect.result)
    );
    expect(Result.isSuccess(role)).toBe(true);
  });
});
