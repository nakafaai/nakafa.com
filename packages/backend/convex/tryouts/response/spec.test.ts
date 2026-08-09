import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { toTryoutResponseError } from "@repo/backend/convex/tryouts/response/spec";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/response/spec", () => {
  it("hides unexpected storage details while retaining the internal cause", async () => {
    const cause = new Error(
      "unique() exposed tryoutSectionAttempts [section-1, section-2]"
    );

    const error = toTryoutResponseError(cause);

    expect(error).toMatchObject({
      code: "TRYOUT_RESPONSE_FAILED",
      message: "Unable to save try-out response.",
    });
    expect(error.cause).toBe(cause);
    expect(error.message).not.toContain("tryoutSectionAttempts");
    expect(error.message).not.toContain("section-1");
    await expect(runConvexProgram(Effect.fail(error))).rejects.toMatchObject({
      data: {
        code: "TRYOUT_RESPONSE_FAILED",
        message: "Unable to save try-out response.",
      },
    });
  });
});
