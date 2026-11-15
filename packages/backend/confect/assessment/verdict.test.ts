import { describe, expect, it } from "@effect/vitest";
import { verdictOf } from "@repo/backend/confect/assessment/verdict";

describe("verdictOf", () => {
  it.each([
    ["every point", 4, "correct"],
    ["some points", 2, "partial"],
    ["no point", 0, "incorrect"],
  ] as const)(
    "reads a score that earns %s as %s",
    (_case, category, verdict) => {
      expect(verdictOf({ category, ceiling: 4, status: "scored" })).toBe(
        verdict
      );
    }
  );

  it("reads an answer that waits for a person as pending", () => {
    expect(verdictOf({ ceiling: 4, status: "pending" })).toBe("pending");
  });
});
