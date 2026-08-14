import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  LearningInterestSchema,
} from "@repo/contents/_types/learner/preferences";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("learner preferences", () => {
  it("maps learner interests to current Aksara program kinds", () => {
    expect(LEARNING_INTEREST_PROGRAM_KIND_MATCHES).toEqual({
      "assessment-prep": ["assessment", "admission-exam"],
      "exam-prep": ["admission-exam"],
      "school-curriculum": ["school-curriculum"],
    });
    expect(Schema.is(LearningInterestSchema)("exam-prep")).toBe(true);
    expect(Schema.is(LearningInterestSchema)("legacy-program")).toBe(false);
  });
});
