// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  isUnservedLocaleShape,
  readImageSuffix,
  readOgAliasUrl,
} from "@/lib/og/alias";

const ORIGIN = "https://nakafa.com";

/** Reads the rewritten address of one request URL, or none when it is not an alias. */
function readAlias(path: string) {
  return Option.map(readOgAliasUrl(new URL(path, ORIGIN)), (url) => url.href);
}

describe("social image suffix", () => {
  it("names the image file of a route, the png and og alias, ignoring case", () => {
    expect(readImageSuffix("en/articles/x/image.png")).toEqual(
      Option.some("/image.png")
    );
    expect(readImageSuffix("en/articles/x.PNG")).toEqual(Option.some(".png"));
    expect(readImageSuffix("en/articles/x.og")).toEqual(Option.some(".og"));
    expect(readImageSuffix("en/articles/x")).toEqual(Option.none());
  });

  it("recognises a locale shape that no locale is served by", () => {
    expect(isUnservedLocaleShape("fr")).toBe(true);
    expect(isUnservedLocaleShape("en")).toBe(false);
    expect(isUnservedLocaleShape("articles")).toBe(false);
    expect(isUnservedLocaleShape(undefined)).toBe(false);
  });
});

describe("public social image aliases", () => {
  it("rewrites a png alias to the og route of the route it names, keeping the query", () => {
    expect(readAlias("/en/articles/aljabar.png?ref=share")).toEqual(
      Option.some(`${ORIGIN}/og/en/articles/aljabar?ref=share`)
    );
  });

  it("rewrites an image alias and an og alias without a locale prefix", () => {
    expect(readAlias("/de/articles/aljabar/image.png")).toEqual(
      Option.some(`${ORIGIN}/og/de/articles/aljabar`)
    );
    expect(readAlias("/articles/aljabar.og")).toEqual(
      Option.some(`${ORIGIN}/og/articles/aljabar`)
    );
  });

  it("leaves an address under an unserved locale shape to the router", () => {
    expect(readAlias("/fr/articles/aljabar.png")).toEqual(Option.none());
  });

  it("leaves the og route itself and a path without an image suffix alone", () => {
    expect(readAlias("/og/en/articles/aljabar.png")).toEqual(Option.none());
    expect(readAlias("/en/articles/aljabar")).toEqual(Option.none());
  });
});
