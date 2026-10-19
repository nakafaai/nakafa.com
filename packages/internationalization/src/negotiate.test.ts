import { describe, expect, it } from "@effect/vitest";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";

/** The request headers that carry a cookie and an Accept-Language value. */
function requestHeaders(input: {
  readonly acceptLanguage?: string;
  readonly cookie?: string;
}) {
  const headers = new Headers();
  if (input.acceptLanguage !== undefined) {
    headers.set("accept-language", input.acceptLanguage);
  }
  if (input.cookie !== undefined) {
    headers.set("cookie", input.cookie);
  }
  return headers;
}

describe("locale negotiation", () => {
  it("prefers the locale cookie to Accept-Language", () => {
    expect(
      negotiateLocale(
        requestHeaders({ acceptLanguage: "id-ID", cookie: "NAKAFA_LOCALE=de" })
      )
    ).toBe("de");
  });

  it("finds the locale cookie among other cookies", () => {
    expect(
      negotiateLocale(
        requestHeaders({
          cookie: "session=a=b; NAKAFA_LOCALE=id; theme=dark",
        })
      )
    ).toBe("id");
  });

  it.each([
    "NAKAFA_LOCALE=fr",
    "NAKAFA_LOCALE=",
    "XNAKAFA_LOCALE=de",
    "NAKAFA_LOCALE",
  ])("skips the cookie %s, which names no public locale", (cookie) => {
    expect(
      negotiateLocale(requestHeaders({ acceptLanguage: "id-ID", cookie }))
    ).toBe("id");
  });

  it.each([
    ["de-DE,de;q=0.9", "de"],
    ["ID-ID,en;q=0.8", "id"],
    ["en;q=0.5, id;q=0.9", "id"],
    ["id;q=0, de;q=0.1", "de"],
    ["de;q=0.8, id;q=0.8", "de"],
    ["fr, *;q=0.5, id;q=0.1", "id"],
    ["de;q=abc, id;q=0.5", "id"],
    ["de;q=Infinity, id;q=0.5", "id"],
    ["id;foo=bar", "id"],
    ["id ; q = 0.5, de ; q = 0.4", "id"],
    ["fr-CA, en-GB;q=0.9", "en"],
    ["fr", "en"],
    ["", "en"],
  ])("negotiates %s as %s", (acceptLanguage, locale) => {
    expect(negotiateLocale(requestHeaders({ acceptLanguage }))).toBe(locale);
  });

  it("falls back to the default locale without a header or cookie", () => {
    expect(negotiateLocale(requestHeaders({}))).toBe("en");
  });
});
