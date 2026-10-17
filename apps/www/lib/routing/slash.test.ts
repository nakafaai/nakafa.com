import { describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";
import { redirectTrailingSlash } from "@/lib/routing/slash";

describe("trailing slash redirect", () => {
  it("redirects a path with a trailing slash to its canonical spelling, with its query, as a 308", () => {
    const response = redirectTrailingSlash(
      new NextRequest("http://localhost:3000/en/search/?q=atom")
    );

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "http://localhost:3000/en/search?q=atom"
    );
  });

  it("redirects a school host to the same school host, although the request URL names localhost", () => {
    const response = redirectTrailingSlash(
      new NextRequest("http://localhost:3000/classes/", {
        headers: { host: "harapan.localhost:3000" },
      })
    );

    expect(response?.headers.get("location")).toBe(
      "http://harapan.localhost:3000/classes"
    );
  });

  it("keeps an IP host that the visitor asked for", () => {
    const response = redirectTrailingSlash(
      new NextRequest("http://localhost:3000/en/search/", {
        headers: { host: "127.0.0.1:3000" },
      })
    );

    expect(response?.headers.get("location")).toBe(
      "http://127.0.0.1:3000/en/search"
    );
  });

  it.each(["/", "/en/search"])(
    "answers nothing for %s, which has no trailing slash to remove",
    (path) => {
      expect(
        redirectTrailingSlash(new NextRequest(`http://localhost:3000${path}`))
      ).toBeNull();
    }
  );
});
