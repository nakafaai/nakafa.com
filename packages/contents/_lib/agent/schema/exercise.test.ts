import { NakafaAgentExerciseOptionsSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentExerciseOptionsSchema", () => {
  it("accepts only exercise content refs for structured exercise reads", () => {
    const exerciseOptions = Schema.decodeUnknownSync(
      NakafaAgentExerciseOptionsSchema
    )({
      content_ref:
        "id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3",
    });

    expect(exerciseOptions.content_ref).toBe(
      "id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-3"
    );
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentExerciseOptionsSchema)({
        content_ref:
          "id/subject/high-school/11/mathematics/function-modeling/rational-function",
      })
    ).toThrow(
      'Expected a Nakafa exercise content reference with section "exercises".'
    );
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentExerciseOptionsSchema)({
        content_ref: "not-a-nakafa-content-ref",
      })
    ).toThrow(
      'Expected a Nakafa exercise content reference with section "exercises".'
    );
  });
});
