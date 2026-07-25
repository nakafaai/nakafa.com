import {
  makeNakafaGenerationError,
  NakafaGenerationError,
} from "@repo/ai/agents/nakafa/error";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa generation error", () => {
  it("maps unknown provider failures into the capability error channel", async () => {
    const cause = new Error("provider unavailable");
    const error = await Effect.runPromise(
      Effect.fail(makeNakafaGenerationError(cause)).pipe(Effect.flip)
    );

    expect(error).toBeInstanceOf(NakafaGenerationError);
    expect(error).toMatchObject({
      _tag: "NakafaGenerationError",
      cause,
      message: "Nakafa generation failed.",
    });
  });
});
