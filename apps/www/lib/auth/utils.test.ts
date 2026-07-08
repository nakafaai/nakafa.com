import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  getAuthCallbackPath,
  getSafeInternalRedirectPath,
  isAuthError,
} from "@/lib/auth/utils";

describe("lib/auth/utils", () => {
  describe("getSafeInternalRedirectPath", () => {
    it("returns valid internal paths", () => {
      expect(
        getSafeInternalRedirectPath("/id/try-out/indonesia/snbt/2027/set-1")
      ).toBe("/id/try-out/indonesia/snbt/2027/set-1");
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

  describe("getAuthCallbackPath", () => {
    it("uses app home when no safe redirect is provided", () => {
      expect(getAuthCallbackPath(null)).toBe("/home");
      expect(getAuthCallbackPath(null, "id")).toBe("/id/home");
      expect(getAuthCallbackPath("https://nakafa.com/id", "id")).toBe(
        "/id/home"
      );
    });

    it("sends marketing roots to the app home instead of the public homepage", () => {
      expect(getAuthCallbackPath("/")).toBe("/home");
      expect(getAuthCallbackPath("/?utm_source=homepage", "id")).toBe(
        "/id/home"
      );
      expect(getAuthCallbackPath("/", "id")).toBe("/id/home");
      expect(getAuthCallbackPath("/en")).toBe("/en/home");
      expect(getAuthCallbackPath("/en", "id")).toBe("/en/home");
      expect(getAuthCallbackPath("/en?utm_source=homepage")).toBe("/en/home");
      expect(getAuthCallbackPath("/id/")).toBe("/id/home");
    });

    it("keeps real internal app and content callbacks unchanged", () => {
      expect(getAuthCallbackPath("/id/search?q=a,b")).toBe("/id/search?q=a,b");
      expect(getAuthCallbackPath("/id/try-out/indonesia/snbt/2027/set-1")).toBe(
        "/id/try-out/indonesia/snbt/2027/set-1"
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

    it("detects structured Convex auth errors by code", () => {
      expect(
        isAuthError(
          new ConvexError({
            code: "UNAUTHENTICATED",
            message: "Unauthenticated",
          })
        )
      ).toBe(true);
    });

    it("detects structured Convex auth errors by message", () => {
      expect(
        isAuthError(
          new ConvexError({
            message: "auth session expired",
          })
        )
      ).toBe(true);
    });

    it("ignores structured Convex errors without auth-related code or message", () => {
      expect(
        isAuthError(
          new ConvexError({
            reason: "network timeout",
          })
        )
      ).toBe(false);
    });

    it("ignores Convex errors with null data", () => {
      expect(isAuthError(new ConvexError(null))).toBe(false);
    });

    it("ignores unrelated runtime errors", () => {
      expect(isAuthError(new Error("network timeout"))).toBe(false);
    });

    it("ignores non-error primitive values", () => {
      expect(isAuthError("auth timeout")).toBe(false);
    });
  });
});
