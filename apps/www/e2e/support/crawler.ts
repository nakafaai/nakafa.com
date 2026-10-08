import { expect, type Page } from "@playwright/test";
import { Array as Arr, Effect, Schema } from "effect";

/** The head metadata, links, and structured data of one server document. */
const ServerDocumentSchema = Schema.Struct({
  description: Schema.NullOr(Schema.String),
  image: Schema.NullOr(Schema.String),
  jsonLd: Schema.Array(Schema.String),
  language: Schema.String,
  links: Schema.Array(
    Schema.Struct({
      href: Schema.NullOr(Schema.String),
      hreflang: Schema.NullOr(Schema.String),
      rel: Schema.NullOr(Schema.String),
    })
  ),
});

/** What a crawler reads in the HTML the server returns for one page. */
export type ServerDocument = typeof ServerDocumentSchema.Type;

/**
 * Reads the canonical and alternate links of the server HTML a crawler parses.
 * It runs in the page, so pass it to `page.evaluate` by reference.
 */
function readHeadLinks(html: string) {
  const root = new DOMParser().parseFromString(html, "text/html");
  return [
    ...root.querySelectorAll(
      'link[rel="canonical"], link[rel="alternate"][hreflang]'
    ),
  ].map((element) => ({
    href: element.getAttribute("href"),
    hreflang: element.getAttribute("hreflang"),
    rel: element.getAttribute("rel"),
  }));
}

/**
 * Parses the HTML the server returned the way a crawler reads it: inert, with
 * every streamed segment in place at once, so nothing depends on when the
 * browser reveals or hydrates them.
 */
export const readServerDocument = Effect.fn("NakafaE2E.readServerDocument")(
  function* (page: Page, html: string) {
    const fields = yield* Effect.promise(() =>
      page.evaluate((source) => {
        const parsed = new DOMParser().parseFromString(source, "text/html");
        const read = (selector: string, name: string) =>
          parsed.querySelector(selector)?.getAttribute(name) ?? null;
        return {
          description: read('meta[name="description"]', "content"),
          image: read('meta[property="og:image"]', "content"),
          jsonLd: [
            ...parsed.querySelectorAll('script[type="application/ld+json"]'),
          ].map((element) => element.textContent ?? ""),
          language: parsed.documentElement.lang,
        };
      }, html)
    );
    const links = yield* Effect.promise(() =>
      page.evaluate(readHeadLinks, html)
    );
    const served: ServerDocument = { ...fields, links };
    return served;
  }
);

/** Requires the server document to carry exactly one such link, to `href`. */
export function expectSingleLink(
  served: ServerDocument,
  rel: string,
  hreflang: string | null,
  href: string
) {
  expect(
    Arr.filter(
      served.links,
      (link) => link.rel === rel && link.hreflang === hreflang
    )
  ).toEqual([{ href, hreflang, rel }]);
}
