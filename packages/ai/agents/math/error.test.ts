import { describe, expect, it } from "@effect/vitest";
import {
  MathGenerationError,
  makeMathGenerationError,
} from "@repo/ai/agents/math/error";
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
});
