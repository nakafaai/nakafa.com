import { describe, expect, it } from "@effect/vitest";
import { ConvexError } from "convex/values";
import { readContentViewErrorCode } from "@/lib/content/views/code";

describe("readContentViewErrorCode", () => {
  it("reads the server code from a typed Convex failure", () => {
    expect(
      readContentViewErrorCode(
        new ConvexError({
          code: "CONTENT_VIEW_IO_FAILED",
          message: "Signed material ownership is unavailable for en.",
        })
      )
    ).toBe("CONTENT_VIEW_IO_FAILED");
  });

  it("returns no code for Convex failures without a string code", () => {
    expect(
      readContentViewErrorCode(new ConvexError({ message: "no code" }))
    ).toBeUndefined();
    expect(
      readContentViewErrorCode(new ConvexError({ code: 7 }))
    ).toBeUndefined();
    expect(readContentViewErrorCode(new ConvexError("plain"))).toBeUndefined();
  });

  it("returns no code for failures that never reached Convex", () => {
    expect(
      readContentViewErrorCode(new Error("Connection lost"))
    ).toBeUndefined();
    expect(readContentViewErrorCode("Connection lost")).toBeUndefined();
    expect(readContentViewErrorCode(undefined)).toBeUndefined();
  });
});
