import { describe, expect, it } from "@effect/vitest";
import {
  TryoutResponseErrorWire,
  toTryoutResponseError,
} from "@repo/backend/confect/tryouts/response/spec";
import { Schema } from "effect";

describe("tryouts/response/spec", () => {
  it("hides unexpected storage details while retaining the internal cause", () => {
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
    expect(Schema.encodeSync(TryoutResponseErrorWire)(error)).toEqual({
      _tag: "TryoutResponseError",
      code: "TRYOUT_RESPONSE_FAILED",
      message: "Unable to save try-out response.",
    });
  });
});
