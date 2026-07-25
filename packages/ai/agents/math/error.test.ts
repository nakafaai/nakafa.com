import {
  MathGenerationError,
  makeMathGenerationError,
} from "@repo/ai/agents/math/error";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("math generation error", () => {
  it("maps unknown provider failures into the capability error channel", async () => {
    const cause = new Error("provider unavailable");
    const error = await Effect.runPromise(
      Effect.fail(makeMathGenerationError(cause)).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(MathGenerationError);
    expect(error).toMatchObject({
      _tag: "MathGenerationError",
      cause,
      message: "Math generation failed.",
    });
  });
});
