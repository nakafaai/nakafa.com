import { describe, expect, it } from "vitest";
import { getOgUrl } from "../metadata";

describe("getOgUrl", () => {
  it("returns OG URL for path with leading slash", () => {
    const result = getOgUrl("en", "/docs/getting-started");
    expect(result).toBe("/en/og/docs/getting-started/image.png");
  });

  it("handles path without leading slash", () => {
    const result = getOgUrl("en", "docs/getting-started");
    expect(result).toBe("/en/og/docs/getting-started/image.png");
  });

  it("returns OG URL for Indonesian locale", () => {
    const result = getOgUrl("id", "/about");
    expect(result).toBe("/id/og/about/image.png");
  });

  it("handles nested paths", () => {
    const result = getOgUrl("en", "/packages/app/components/Button");
    expect(result).toBe("/en/og/packages/app/components/Button/image.png");
  });

  it("handles root path", () => {
    const result = getOgUrl("en", "/");
    expect(result).toBe("/en/og//image.png");
  });

  it("handles empty path", () => {
    const result = getOgUrl("en", "");
    expect(result).toBe("/en/og//image.png");
  });

  it("handles path with multiple leading slashes", () => {
    const result = getOgUrl("en", "//double/slash");
    expect(result).toBe("/en/og//double/slash/image.png");
  });

  it("handles paths with special characters", () => {
    const result = getOgUrl("en", "/blog/2024-12-24-release-notes");
    expect(result).toBe("/en/og/blog/2024-12-24-release-notes/image.png");
  });
});
