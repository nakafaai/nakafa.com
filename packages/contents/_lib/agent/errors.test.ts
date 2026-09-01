import { describe, expect, it } from "@effect/vitest";
import { getUnknownErrorMessage } from "@repo/contents/_lib/agent/errors";

describe("Nakafa agent errors", () => {
  it("normalizes Error and non-Error failure values", () => {
    expect(getUnknownErrorMessage(new Error("Readable failure."))).toBe(
      "Readable failure."
    );
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });
});
