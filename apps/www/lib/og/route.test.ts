import { describe, expect, it } from "vitest";
import {
  createOgRouteAliasRewrites,
  isOgRouteAliasPathname,
} from "@/lib/og/route";

describe("OG route aliases", () => {
  it("builds the exact Next rewrite declarations", () => {
    expect(createOgRouteAliasRewrites()).toEqual([
      { destination: "/og/:path*", source: "/:path*.png" },
      { destination: "/og/:path*", source: "/:path*.og" },
      { destination: "/og/:path*", source: "/:path*/image.png" },
    ]);
  });

  it.each([
    "/en/example.og",
    "/en/example.png",
    "/en/og/example/image.png",
    "/DE/EXAMPLE.OG",
  ])("recognizes the non-document alias %s", (pathname) => {
    expect(isOgRouteAliasPathname(pathname)).toBe(true);
  });

  it.each(["/en", "/en/search", "/en/example.ogg", "/en/example.og/details"])(
    "keeps the document route %s outside the alias set",
    (pathname) => {
      expect(isOgRouteAliasPathname(pathname)).toBe(false);
    }
  );
});
