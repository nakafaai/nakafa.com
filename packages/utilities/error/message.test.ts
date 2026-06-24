import { messageFromUnknown } from "@repo/utilities/error/message";
import { describe, expect, it } from "vitest";

describe("messageFromUnknown", () => {
  it("returns string causes directly", () => {
    expect(messageFromUnknown("network unavailable", "fallback")).toBe(
      "network unavailable"
    );
  });

  it("returns message fields from object causes", () => {
    expect(messageFromUnknown({ message: "provider failed" }, "fallback")).toBe(
      "provider failed"
    );
  });

  it.each([
    { message: 42 },
    { reason: "missing" },
    null,
    undefined,
  ])("returns fallback for unsupported causes %#", (cause) => {
    expect(messageFromUnknown(cause, "fallback")).toBe("fallback");
  });
});
