import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  decodeOnboardingRoleValue,
  decodeOnboardingValue,
} from "@/components/programs/onboarding/state";

describe("components/programs/onboarding/state", () => {
  it.effect("decodes a complete program onboarding value", () =>
    Effect.gen(function* () {
      const result = yield* decodeOnboardingValue({
        focusKey: "student-exam",
        interest: "exam-prep",
        programKey: "snbt",
        role: "student",
      }).pipe(Effect.result);
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
    })
  );
  it.effect("rejects incomplete program onboarding values", () =>
    Effect.gen(function* () {
      const result = yield* decodeOnboardingValue({
        programKey: "snbt",
      }).pipe(Effect.result);
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect("decodes a route-owned role step value", () =>
    Effect.gen(function* () {
      const role = yield* decodeOnboardingRoleValue({ role: "teacher" }).pipe(
        Effect.result
      );
      expect(Result.isSuccess(role)).toBe(true);
    })
  );
});
