import { describe, expect, it } from "@effect/vitest";
import { sharedCookieDomain } from "@/lib/auth/domain";

describe("sharedCookieDomain", () => {
  it("shares production's cookies with every school host, and keeps every other site's to its host", () => {
    expect(sharedCookieDomain(new URL("https://nakafa.com"))).toBe(
      "nakafa.com"
    );
    expect(sharedCookieDomain(new URL("https://dev.nakafa.com"))).toBe(
      undefined
    );
    expect(sharedCookieDomain(new URL("http://localhost:3000"))).toBe(
      undefined
    );
  });
});
