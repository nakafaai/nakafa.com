import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeOnboardingValue } from "@/components/programs/onboarding/state";

describe("components/programs/onboarding/state", () => {
  it("decodes a complete program onboarding value", () => {
    const result = Effect.runSync(
      decodeOnboardingValue({
        interests: ["exam-prep", "nakafa-path"],
        primaryProgramKey: "snbt-2026",
        stage: "kelas-12",
      }).pipe(Effect.either)
    );

    expect(Either.isRight(result)).toBe(true);
    if (!Either.isRight(result)) {
      return;
    }

    expect(result.right).toEqual({
      interests: ["exam-prep", "nakafa-path"],
      primaryProgramKey: "snbt-2026",
      stage: "kelas-12",
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
});
