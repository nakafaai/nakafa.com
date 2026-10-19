import { readAlternates } from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Record as Rec, Schema } from "effect";
import { createSEOTitle } from "@/lib/seo/titles";

/** The site name that every social card and title carries. */
const SITE_NAME = "Nakafa";

/** The social card format that every page uses, with its large image. */
const TWITTER_CARD = "summary_large_image";

/** The head of one page, as the builders decide it on the server. */
const SeoHead = Schema.Struct({
  alternates: Schema.Array(
    Schema.Struct({ hreflang: Schema.String, href: Schema.String })
  ),
  canonical: Schema.String,
  description: Schema.String,
  jsonLd: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  robots: Schema.Literals(["index,follow", "noindex,nofollow"]),
  social: Schema.Record(Schema.String, Schema.String),
  title: Schema.String,
});

type SeoHead = typeof SeoHead.Type;

/** The facts of one page that decide its head. */
const PageFacts = Schema.Struct({
  canonicalPath: Schema.String,
  description: Schema.String,
  indexable: Schema.Boolean,
  jsonLd: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  locale: LocaleSchema,
  parts: Schema.Array(Schema.UndefinedOr(Schema.String)),
  type: Schema.Literals(["article", "website"]),
});

type PageFacts = typeof PageFacts.Type;

/**
 * Builds the head of one page from its facts. The title is the site's title
 * budget, the canonical address and the alternates come from the one route map,
 * and an unindexable page says so in its robots rule.
 */
export function createSeoHead(facts: PageFacts): SeoHead {
  const title = createSEOTitle(facts.parts, SITE_NAME);
  const canonical = new URL(toPublicPath(facts.canonicalPath), SITE_ORIGIN)
    .href;
  return SeoHead.make({
    alternates: Arr.map(readAlternates(facts.canonicalPath), (alternate) => ({
      hreflang: alternate.hreflang,
      href: alternate.href,
    })),
    canonical,
    description: facts.description,
    jsonLd: [...facts.jsonLd],
    robots: facts.indexable ? "index,follow" : "noindex,nofollow",
    social: {
      "og:description": facts.description,
      "og:locale": facts.locale,
      "og:site_name": SITE_NAME,
      "og:title": title,
      "og:type": facts.type,
      "og:url": canonical,
      "twitter:card": TWITTER_CARD,
      "twitter:description": facts.description,
      "twitter:title": title,
    },
    title,
  });
}

/**
 * Maps a head to the head entries of the router. The mapping keeps the order of
 * the page: the canonical link, the alternates, the title and description, the
 * robots rule, the social entries, and the JSON-LD scripts. Twitter entries are
 * named, and Open Graph entries carry a property.
 */
export function toRouterHead(head: SeoHead) {
  return {
    links: [
      { href: head.canonical, rel: "canonical" },
      ...Arr.map(head.alternates, ({ hreflang, href }) => ({
        href,
        hreflang,
        rel: "alternate",
      })),
    ],
    meta: [
      { title: head.title },
      { content: head.description, name: "description" },
      { content: head.robots, name: "robots" },
      ...Arr.map(Rec.toEntries(head.social), ([key, content]) =>
        key.startsWith("twitter:")
          ? { content, name: key }
          : { content, property: key }
      ),
      ...Arr.map(head.jsonLd, (node) => ({ "script:ld+json": node })),
    ],
  };
}
