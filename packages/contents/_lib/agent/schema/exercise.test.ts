import { NakafaAgentExerciseOptionsSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentExerciseOptionsSchema", () => {
  it("accepts graph content refs and leaves section validation to readers", () => {
    const exerciseOptions = Schema.decodeUnknownSync(
      NakafaAgentExerciseOptionsSchema
    )({
      content_ref:
        "asset:id:exercise:high-school:snbt:general-reasoning:exercise-set:snbt:general-reasoning:try-out:2026:set-3",
    });

    expect(exerciseOptions.content_ref).toBe(
      "asset:id:exercise:high-school:snbt:general-reasoning:exercise-set:snbt:general-reasoning:try-out:2026:set-3"
    );

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentExerciseOptionsSchema)({
        content_ref: "",
      })
    ).toThrow();
  });
});
