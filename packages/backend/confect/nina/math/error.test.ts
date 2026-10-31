import { describe, expect, it } from "@effect/vitest";
import {
  MathGenerationError,
  MathStepLimitError,
  makeMathGenerationError,
  mathRunFailure,
} from "@repo/backend/confect/nina/math/error";
import { ToolChoiceViolationError } from "ai";
import { Effect } from "effect";

describe("math generation error", () => {
  it.effect(
    "maps unknown provider failures into the capability error channel",
    () =>
      Effect.gen(function* () {
        const cause = new Error("provider unavailable");
        const error = yield* Effect.fail(makeMathGenerationError(cause)).pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(MathGenerationError);
        expect(error).toMatchObject({
          _tag: "MathGenerationError",
          cause,
          message: "Math generation failed.",
        });
      })
  );

  it("ends a run whose last step called a tool at its step limit, and maps any other failure as a generation error", () => {
    const violation = new ToolChoiceViolationError({
      content: [],
      finishReason: "tool-calls",
      modelId: "math-model",
      provider: "math-provider",
      toolChoice: { type: "none" },
    });
    expect(mathRunFailure(violation)).toBeInstanceOf(MathStepLimitError);
    expect(mathRunFailure(new Error("provider unavailable"))).toBeInstanceOf(
      MathGenerationError
    );
  });
});
