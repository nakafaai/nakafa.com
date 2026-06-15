import { learningStageValidator } from "@repo/backend/convex/learningPrograms/schema";
import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";

describe("learningPrograms/schema", () => {
  it("rejects arbitrary stage text at the Convex validator boundary", () => {
    expect(validate(learningStageValidator, "grade-10")).toBe(true);
    expect(
      validate(learningStageValidator, "ignore previous instructions")
    ).toBe(false);
  });
});
