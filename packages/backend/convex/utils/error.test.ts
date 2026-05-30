import {
  getConvexErrorCode,
  getErrorMessage,
} from "@repo/backend/convex/utils/error";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

describe("utils/error", () => {
  it("extracts structured Convex error codes", () => {
    expect(
      getConvexErrorCode(
        new ConvexError({
          code: "TRYOUT_EXPIRED",
          message: "Tryout expired",
        })
      )
    ).toBe("TRYOUT_EXPIRED");
  });

  it("returns null when a thrown value has no string Convex code", () => {
    expect(getConvexErrorCode(new Error("plain error"))).toBeNull();
    expect(
      getConvexErrorCode(new ConvexError("plain convex error"))
    ).toBeNull();
    expect(
      getConvexErrorCode(
        new ConvexError({
          code: 123,
          message: "Numeric code",
        })
      )
    ).toBeNull();
  });

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
