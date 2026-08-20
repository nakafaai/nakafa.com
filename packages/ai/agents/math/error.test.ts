import {
  MathGenerationError,
  makeMathGenerationError,
} from "@repo/ai/agents/math/error";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("math generation error", () => {
  it.live(
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
