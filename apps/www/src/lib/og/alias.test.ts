import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  isUnservedLocaleShape,
  readImageSuffix,
  readOgAliasRedirect,
  readOgAliasUrl,
} from "@/lib/og/alias";

const ORIGIN = "https://nakafa.com";

/** The alias target of one address, as a path with its query. */
function targetOf(address: string) {
  const target = readOgAliasUrl(new URL(address, ORIGIN));
  return Option.map(target, (url) => `${url.pathname}${url.search}`);
}

describe("social image suffix", () => {
  it("names the png and og alias of a route, ignoring case", () => {
    expect(readImageSuffix("/en/articles/aljabar.PNG")).toEqual(
      Option.some(".png")
    );
    expect(readImageSuffix("/en/articles/aljabar.og")).toEqual(
      Option.some(".og")
    );
    expect(readImageSuffix("/en/articles/aljabar")).toEqual(Option.none());
  });

  it("recognises a locale shape that no locale is served by", () => {
    expect(isUnservedLocaleShape("xx")).toBe(true);
    expect(isUnservedLocaleShape("en")).toBe(false);
    expect(isUnservedLocaleShape(undefined)).toBe(false);
    expect(isUnservedLocaleShape("english")).toBe(false);
  });
});

describe("public social image aliases", () => {
  it("names the static image of the route that a png alias names, keeping the query", () => {
    expect(targetOf("/en/articles/aljabar.png?ref=share")).toEqual(
      Option.some("/en/og/articles/aljabar/image.png?ref=share")
    );
  });

  it("names the default locale's image for an alias without a locale prefix", () => {
    expect(targetOf("/articles/aljabar.og")).toEqual(
      Option.some("/en/og/articles/aljabar/image.png")
    );
  });

  it("names the home image for an alias of a locale alone", () => {
    expect(targetOf("/de.png")).toEqual(Option.some("/de/og/image.png"));
  });

  it("names the default locale's home image for an alias of the suffix alone", () => {
    expect(targetOf("/.png")).toEqual(Option.some("/en/og/image.png"));
  });

  it("leaves an address under an unserved locale shape to the router", () => {
    expect(targetOf("/xx/articles/aljabar.png")).toEqual(Option.none());
  });

  it("leaves the og tree itself and a path without an image suffix alone", () => {
    expect(targetOf("/og/en/articles/aljabar")).toEqual(Option.none());
    expect(targetOf("/en/og/articles/aljabar/image.png")).toEqual(
      Option.none()
    );
    expect(targetOf("/en/articles/aljabar")).toEqual(Option.none());
  });

  it("leaves an upper-case locale in a png alias to the router, as the router rejects it", () => {
    expect(targetOf("/EN/articles/aljabar.png")).toEqual(Option.none());
  });
});

describe("social image redirects", () => {
  it("redirects a read of an image alias to the image of its route, keeping the query", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar.png?ref=share`, {
      headers: { accept: "image/png" },
    });

    const redirect = readOgAliasRedirect(request);

    expect(Option.isSome(redirect) && redirect.value.status).toBe(308);
    expect(
      Option.isSome(redirect) && redirect.value.headers.get("location")
    ).toBe(`${ORIGIN}/en/og/articles/aljabar/image.png?ref=share`);
  });

  it("leaves a write to an image alias to the router", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar.png`, {
      method: "POST",
    });

    expect(readOgAliasRedirect(request)).toEqual(Option.none());
  });

  it("leaves a path that is not an alias to the router", () => {
    const request = new Request(`${ORIGIN}/en/articles/aljabar`);

    expect(readOgAliasRedirect(request)).toEqual(Option.none());
  });
});
