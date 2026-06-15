import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { submitOnboardingSelection } from "@/components/programs/onboarding/submit";

const validValue = {
  interests: ["school-curriculum", "exam-prep"],
  primaryProgramKey: "snbt-2026",
};

describe("components/programs/onboarding/submit", () => {
  it("returns success after the Convex selection mutation resolves", async () => {
    const submittedValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: (value) => {
          submittedValues.push(value);
          return Promise.resolve();
        },
        value: validValue,
      })
    );

    expect(result).toEqual({ status: "success" });
    expect(submittedValues).toEqual([validValue]);
  });

  it("returns validation state without calling the mutation", async () => {
    const submittedValues: unknown[] = [];
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: (value) => {
          submittedValues.push(value);
          return Promise.resolve();
        },
        value: {
          primaryProgramKey: "snbt-2026",
        },
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.invalid-selection",
      status: "error",
    });
    expect(submittedValues).toEqual([]);
  });

  it("returns mutation error state when the Convex selection fails", async () => {
    const result = await Effect.runPromise(
      submitOnboardingSelection({
        selectProgram: () => Promise.reject(new Error("Convex unavailable")),
        value: validValue,
      })
    );

    expect(result).toEqual({
      messageKey: "onboarding.save-error",
      status: "error",
    });
  });
});
