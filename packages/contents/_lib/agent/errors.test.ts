import { getUnknownErrorMessage } from "@repo/contents/_lib/agent/errors";
import { describe, expect, it } from "vitest";

describe("Nakafa agent errors", () => {
  it("normalizes Error and non-Error failure values", () => {
    expect(getUnknownErrorMessage(new Error("Readable failure."))).toBe(
      "Readable failure."
    );
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });
});
