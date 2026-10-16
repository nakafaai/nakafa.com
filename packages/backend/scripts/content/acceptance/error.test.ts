import { describe, expect, it } from "@effect/vitest";
import {
  isFunctionTimeout,
  isVersionServiceServerError,
} from "@repo/backend/scripts/content/acceptance/error";

describe("acceptance start failures", () => {
  it("retries only a 5xx that version.convex.dev answered", () => {
    expect(
      isVersionServiceServerError(
        '✖ version.convex.dev returned 500: {"code":"InternalServerError"}'
      )
    ).toBe(true);
    expect(
      isVersionServiceServerError("✖ version.convex.dev returned 503: {}")
    ).toBe(true);
    expect(
      isVersionServiceServerError("✖ version.convex.dev returned 404: {}")
    ).toBe(false);
    expect(
      isVersionServiceServerError("✖ api.convex.dev returned 500: {}")
    ).toBe(false);
    expect(isVersionServiceServerError("Permission denied")).toBe(false);
  });

  it("retries only a function that passed its time limit", () => {
    expect(
      isFunctionTimeout(
        'Learner account failed: ✖ Failed to run function "adapter:create": Error: [Request ID: 7c52cd9f12cdb4e8] Server Error Function execution timed out (maximum duration: 1s)'
      )
    ).toBe(true);
    expect(
      isFunctionTimeout(
        'Learner account failed: ✖ Failed to run function "adapter:create": Uncaught ConvexError: invalid'
      )
    ).toBe(false);
    expect(isFunctionTimeout("Server Error")).toBe(false);
  });
});
