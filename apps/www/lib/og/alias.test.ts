// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  isUnservedLocaleShape,
  readImageSuffix,
  readOgAliasRequest,
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

  it("leaves a localized og route alone, so its image is not aliased twice", () => {
    expect(readAlias("/en/og/articles/aljabar/image.png")).toEqual(
      Option.none()
    );
    expect(readAlias("/en/og/articles/aljabar.png")).toEqual(Option.none());
  });

  it("leaves the public PNG files of the root and the public folder to the static files", () => {
    expect(readAlias("/og.png")).toEqual(Option.none());
    expect(readAlias("/open-graph/app/de-pricing.png")).toEqual(Option.none());
    expect(readAlias("/logos/ui.png")).toEqual(Option.none());
  });

  it("serves an og alias of a path without a locale, since no public file ends in .og", () => {
    expect(readAlias("/open-graph/app/de-pricing.og")).toEqual(
      Option.some(`${ORIGIN}/og/open-graph/app/de-pricing`)
    );
  });

  it("rejects an upper-case locale in a PNG alias, as the router rejects it", () => {
    expect(readAlias("/EN/articles/aljabar.png")).toEqual(Option.none());
  });
});

describe("social image requests", () => {
  it("serves a read of an image alias as the OG route's request, with its headers and query", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar.png?ref=share`, {
      headers: { accept: "image/png" },
    });

    const alias = Option.getOrThrow(readOgAliasRequest(request));

    expect(alias.url).toBe(`${ORIGIN}/og/en/articles/aljabar?ref=share`);
    expect(alias.method).toBe("GET");
    expect(alias.headers.get("accept")).toBe("image/png");
  });

  it("leaves a write to an image alias to the router", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar.png`, {
      method: "POST",
    });

    expect(Option.isNone(readOgAliasRequest(request))).toBe(true);
  });

  it("leaves a path that is not an alias to the router", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar`);

    expect(Option.isNone(readOgAliasRequest(request))).toBe(true);
  });
});
