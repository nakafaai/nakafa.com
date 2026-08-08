import { describe, expect, it } from "vitest";
import { getAuthCallbackPath } from "@/lib/auth/utils";

describe("lib/auth/utils", () => {
  describe("getAuthCallbackPath", () => {
    it("uses app home when no safe redirect is provided", () => {
      expect(getAuthCallbackPath(null)).toBe("/home");
      expect(getAuthCallbackPath(null, "id")).toBe("/id/home");
      expect(getAuthCallbackPath("https://nakafa.com/id", "id")).toBe(
        "/id/home"
      );
      expect(getAuthCallbackPath("//nakafa.com/id", "id")).toBe("/id/home");
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
});
