import { describe, expect, it } from "@effect/vitest";
import { isUnmatchedPath } from "@/lib/routing/unmatched";

describe("unmatched paths", () => {
  it("leaves the root, the locales and the Worker's own routes to the router", () => {
    expect(isUnmatchedPath("/")).toBe(false);
    expect(isUnmatchedPath("/en/articles/politics/x")).toBe(false);
    expect(isUnmatchedPath("/_serverFn/abc")).toBe(false);
    expect(isUnmatchedPath("/api/weather")).toBe(false);
    expect(isUnmatchedPath("/school/abc/exams")).toBe(false);
    expect(isUnmatchedPath("/skill.md")).toBe(false);
  });

  it("leaves a bare profile address to its redirect", () => {
    expect(isUnmatchedPath("/@nabil")).toBe(false);
    expect(isUnmatchedPath("/@")).toBe(true);
  });

  it("names the probes of paths that the app never had", () => {
    expect(isUnmatchedPath("/.env")).toBe(true);
    expect(isUnmatchedPath("/wp-login.php")).toBe(true);
    expect(isUnmatchedPath("/sitemap/missing.xml")).toBe(true);
  });
});
