import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { getSafeInternalRedirectPath, isAuthError } from "./utils";

describe("lib/auth/utils", () => {
  describe("getSafeInternalRedirectPath", () => {
    it("returns valid internal paths", () => {
      expect(getSafeInternalRedirectPath("/id/try-out/snbt/2026-set-1")).toBe(
        "/id/try-out/snbt/2026-set-1"
      );
      expect(getSafeInternalRedirectPath("/auth?redirect=%2Fid")).toBe(
        "/auth?redirect=%2Fid"
      );
    });

    it("rejects external or malformed redirect targets", () => {
      expect(getSafeInternalRedirectPath(null)).toBeNull();
      expect(getSafeInternalRedirectPath("https://nakafa.com/id")).toBeNull();
      expect(getSafeInternalRedirectPath("//nakafa.com/id")).toBeNull();
    });

    it("keeps valid internal paths even when they contain commas", () => {
      expect(getSafeInternalRedirectPath("/id/search?q=a,b")).toBe(
        "/id/search?q=a,b"
      );
    });
  });

  describe("isAuthError", () => {
    it("detects auth-related Convex errors", () => {
      expect(isAuthError(new ConvexError("auth token missing"))).toBe(true);
    });

    it("matches auth-related runtime errors", () => {
      expect(isAuthError(new Error("auth timeout"))).toBe(true);
    });

    it("does not treat structured Convex error data as auth by default", () => {
      expect(
        isAuthError(
          new ConvexError({
            code: "UNAUTHENTICATED",
            message: "Unauthenticated",
          })
        )
      ).toBe(false);
    });

    it("ignores unrelated runtime errors", () => {
      expect(isAuthError(new Error("network timeout"))).toBe(false);
    });

    it("ignores non-error primitive values", () => {
      expect(isAuthError("auth timeout")).toBe(false);
    });
  });
});
