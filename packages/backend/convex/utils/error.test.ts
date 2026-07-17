import { getErrorMessage } from "@repo/backend/convex/utils/error";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

describe("utils/error", () => {
  it("extracts readable messages from known thrown values", () => {
    expect(
      getErrorMessage(
        new ConvexError({
          code: "FORBIDDEN",
          message: "No access",
        })
      )
    ).toBe("No access");
    expect(getErrorMessage(new Error("Exploded"))).toBe("Exploded");
    expect(getErrorMessage("plain failure")).toBe("plain failure");
  });

  it("serializes Convex error payloads without a string message", () => {
    expect(
      getErrorMessage(
        new ConvexError({
          code: "BROKEN",
          message: 123,
        })
      )
    ).toBe('{"code":"BROKEN","message":123}');
    expect(getErrorMessage(new ConvexError({ code: "BROKEN" }))).toBe(
      '{"code":"BROKEN"}'
    );
  });
});
