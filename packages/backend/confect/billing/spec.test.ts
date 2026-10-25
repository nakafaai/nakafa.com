import { describe, expect, it } from "@effect/vitest";
import { checkoutSessionIoError } from "@repo/backend/confect/billing/spec";

describe("billing/spec", () => {
  it("normalizes a checkout boundary failure to the public message and keeps its cause", () => {
    const cause = new Error("network reset");
    expect(checkoutSessionIoError(cause)).toMatchObject({
      cause,
      code: "CHECKOUT_SESSION_IO_FAILED",
      message: "Failed to finish checkout session.",
    });
  });
});
