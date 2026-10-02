import { describe, expect, it } from "@effect/vitest";
import { readOutcome } from "@repo/backend/confect/tryouts/response/outcome";

describe("tryouts/response/outcome", () => {
  it("reads the stored outcome before the legacy correctness flag", () => {
    expect(
      readOutcome({ isCorrect: false, outcome: { status: "pending" } })
    ).toEqual({ status: "pending" });
    expect(
      readOutcome({
        isCorrect: false,
        outcome: { points: 2, status: "partial" },
      })
    ).toEqual({ points: 2, status: "partial" });
  });

  it("reads rows written before outcomes from their correctness flag", () => {
    expect(readOutcome({ isCorrect: true })).toEqual({ status: "correct" });
    expect(readOutcome({ isCorrect: false })).toEqual({ status: "incorrect" });
  });
});
