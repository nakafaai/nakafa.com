import { describe, expect, it } from "@effect/vitest";
import {
  createOgRouteAliasRewrites,
  isOgRouteAliasPathname,
  readOgRouteAliasLocale,
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

  it.each([
    ["/fr/example.og", "fr"],
    ["/fr/example.png", "fr"],
    ["/FR/og/example/image.png", "FR"],
    ["/og/fr/example/image.png", "fr"],
    ["/og/FR/example/image.png", "FR"],
    ["/og/example/image.png", null],
    ["/example.png", null],
    ["/classes/bacteria.png", null],
    ["/open-graph/curriculum/en-merdeka.png", null],
  ])("reads localized ownership from the OG alias %s", (pathname, expected) => {
    expect(readOgRouteAliasLocale(pathname)).toBe(expected);
  });
});
