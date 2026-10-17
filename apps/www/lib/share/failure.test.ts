import { describe, expect, it } from "@effect/vitest";
import { isNewLinkFailure } from "@/lib/share/failure";

describe("new share link failure", () => {
  it("is not the failure that the reader saw last", () => {
    expect(isNewLinkFailure("ChatShareReadError", "ChatShareReadError")).toBe(
      false
    );
  });

  it("is a failure that appears, or one that differs from the last", () => {
    expect(isNewLinkFailure(null, "ChatShareReadError")).toBe(true);
    expect(isNewLinkFailure("AuthFailure", "ChatShareReadError")).toBe(true);
  });

  it("is never a read that did not fail", () => {
    expect(isNewLinkFailure(null, null)).toBe(false);
    expect(isNewLinkFailure("ChatShareReadError", null)).toBe(false);
  });
});
