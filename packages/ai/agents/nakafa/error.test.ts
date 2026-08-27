import { describe, expect, it } from "@effect/vitest";
import {
  makeNakafaGenerationError,
  NakafaGenerationError,
} from "@repo/ai/agents/nakafa/error";
import { Effect } from "effect";

describe("Nakafa generation error", () => {
  it.effect(
    "maps unknown provider failures into the capability error channel",
    () =>
      Effect.gen(function* () {
        const cause = new Error("provider unavailable");
        const error = yield* Effect.fail(makeNakafaGenerationError(cause)).pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(NakafaGenerationError);
        expect(error).toMatchObject({
          _tag: "NakafaGenerationError",
          cause,
          message: "Nakafa generation failed.",
        });
      })
  );
});
