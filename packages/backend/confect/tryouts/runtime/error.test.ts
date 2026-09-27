import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

describe("tryouts/runtime/error", () => {
  it.each([
    new Error("Private score storage details."),
    new ConvexError({
      code: "TRYOUT_SCORE_SOURCE_MISMATCH",
      message: "Private score storage details.",
    }),
  ])("redacts SDK failures and retains the internal cause", async (cause) => {
    const error = toTryoutRuntimeError(cause);
    expect(error.cause).toBe(cause);
    await expect(runConvexProgram(Effect.fail(error))).rejects.toMatchObject({
      data: {
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to complete try-out runtime operation.",
      },
    });
  });
});
