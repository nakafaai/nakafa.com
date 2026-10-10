import { describe, expect, it } from "@effect/vitest";
import { isVersionServiceServerError } from "@repo/backend/scripts/content/acceptance/error";

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
});
