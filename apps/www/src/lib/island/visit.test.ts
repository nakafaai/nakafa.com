import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { visitHref } from "@/lib/island/visit";

describe("island visit address", () => {
  it("names the island by its owner's username under the reader's locale", () => {
    expect(visitHref("id", "nabil")).toBe(
      new URL("/id/island/nabil", SITE_ORIGIN).href
    );
  });

  it("keeps a username that holds a reserved character in one path segment", () => {
    expect(visitHref("en", "a/b c")).toBe(
      new URL("/en/island/a%2Fb%20c", SITE_ORIGIN).href
    );
  });
});
