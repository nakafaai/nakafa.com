import {
  LocalizedPath,
  readAlternates,
} from "@repo/internationalization/src/alternates";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Record as Rec, Result, Schema } from "effect";
import {
  SOCIAL_IMAGE_SIZE,
  SOCIAL_SITE_NAME,
  SOCIAL_TWITTER_ACCOUNT,
  SocialOpenGraphType,
} from "@/lib/seo/social";
import { createSEOTitle } from "@/lib/seo/titles";

/** The social card format that every page uses, with its large image. */
const TWITTER_CARD = "summary_large_image";

/** The googlebot rule of a page that search engines may index, with the image and snippet limits they read. */
const GOOGLEBOT_INDEXABLE =
  "index,follow,max-video-preview:-1,max-image-preview:large,max-snippet:-1";

/** The googlebot rule of a page that no search engine may index, its image included. */
const GOOGLEBOT_PRIVATE = "noindex,nofollow,noimageindex";

/**
 * One alternate link of a head: a locale's address with its `hreflang`, or a
 * representation of the page with its `type`, such as its Markdown version.
 */
const HeadAlternate = Schema.Struct({
  hreflang: Schema.optionalKey(Schema.String),
  href: Schema.String,
  type: Schema.optionalKey(Schema.String),
});

/** The head of one page, as the builders decide it on the server. */
const SeoHead = Schema.Struct({
  alternates: Schema.Array(HeadAlternate),
  canonical: Schema.optionalKey(Schema.String),
  description: Schema.String,
  googlebot: Schema.Literals([GOOGLEBOT_INDEXABLE, GOOGLEBOT_PRIVATE]),
  jsonLd: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  robots: Schema.Literals(["index,follow", "noindex,nofollow"]),
  social: Schema.Record(Schema.String, Schema.String),
  title: Schema.String,
});

type SeoHead = typeof SeoHead.Type;

/** The facts of one page that decide its head. */
const PageFacts = Schema.Struct({
  absoluteTitle: Schema.optionalKey(Schema.String),
  alternates: Schema.optionalKey(Schema.Array(HeadAlternate)),
  canonicalPath: LocalizedPath,
  description: Schema.String,
  image: Schema.String,
  indexable: Schema.Boolean,
  jsonLd: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
  locale: LocaleSchema,
  parts: Schema.Array(Schema.UndefinedOr(Schema.String)),
  type: SocialOpenGraphType,
});

type PageFacts = typeof PageFacts.Type;

/**
 * Builds the head of one page from its facts. The title is the site's title
 * budget unless the page names an absolute one. The canonical address comes from
 * the route map, and the alternates are the page's own counterparts when it names
 * them, or else the route map's. An unindexable page says so in its robots and
 * googlebot rules. The social card carries one image, its alt text and its size,
 * for Open Graph and Twitter alike, and the Twitter entries name the site account
 * as both site and creator.
 */
export function createSeoHead(facts: PageFacts): SeoHead {
  const title =
    facts.absoluteTitle ?? createSEOTitle(facts.parts, SOCIAL_SITE_NAME);
  const canonical = new URL(toPublicPath(facts.canonicalPath), SITE_ORIGIN)
    .href;
  const image = {
    alt: title,
    height: String(SOCIAL_IMAGE_SIZE.height),
    url: new URL(facts.image, SITE_ORIGIN).href,
    width: String(SOCIAL_IMAGE_SIZE.width),
  };
  return SeoHead.make({
    alternates:
      facts.alternates ??
      Arr.map(readAlternates(facts.canonicalPath), (alternate) => ({
        hreflang: alternate.hreflang,
        href: alternate.href,
      })),
    canonical,
    description: facts.description,
    googlebot: facts.indexable ? GOOGLEBOT_INDEXABLE : GOOGLEBOT_PRIVATE,
    jsonLd: [...facts.jsonLd],
    robots: facts.indexable ? "index,follow" : "noindex,nofollow",
    social: {
      "og:description": facts.description,
      "og:image": image.url,
      "og:image:alt": image.alt,
      "og:image:height": image.height,
      "og:image:width": image.width,
      "og:locale": facts.locale,
      "og:site_name": SOCIAL_SITE_NAME,
      "og:title": title,
      "og:type": facts.type,
      "og:url": canonical,
      "twitter:card": TWITTER_CARD,
      "twitter:creator": SOCIAL_TWITTER_ACCOUNT,
      "twitter:description": facts.description,
      "twitter:image": image.url,
      "twitter:image:alt": image.alt,
      "twitter:site": SOCIAL_TWITTER_ACCOUNT,
      "twitter:title": title,
    },
    title,
  });
}

/**
 * The alternates of a page from its resolved route: the address of each locale
 * with its `hreflang`, then each representation with its `type`. The addresses
 * are absolute, so the head names the same links as the route map does.
 */
export function toHeadAlternates(resolved: {
  readonly languages: Readonly<Record<string, string | undefined>>;
  readonly types?: Readonly<Record<string, string | undefined>>;
}): readonly (typeof HeadAlternate.Type)[] {
  return [
    ...Arr.filterMap(Rec.toEntries(resolved.languages), ([hreflang, href]) =>
      href === undefined
        ? Result.failVoid
        : Result.succeed({
            hreflang,
            href: new URL(href, SITE_ORIGIN).href,
          })
    ),
    ...Arr.filterMap(Rec.toEntries(resolved.types ?? {}), ([type, href]) =>
      href === undefined
        ? Result.failVoid
        : Result.succeed({ href: new URL(href, SITE_ORIGIN).href, type })
    ),
  ];
}

/**
 * The head of a page that no search engine may index, such as a signed-in
 * screen: its title and description, a noindex rule, and no canonical link,
 * alternates or social entries, because the page has no public address.
 */
export function createPrivateSeoHead(
  facts: Pick<PageFacts, "absoluteTitle" | "description" | "parts">
): SeoHead {
  return SeoHead.make({
    alternates: [],
    description: facts.description,
    googlebot: GOOGLEBOT_PRIVATE,
    jsonLd: [],
    robots: "noindex,nofollow",
    social: {},
    title: facts.absoluteTitle ?? createSEOTitle(facts.parts, SOCIAL_SITE_NAME),
  });
}

/** One alternate link of the router, with only the attributes that the head names. */
function toAlternateLink({ hreflang, href, type }: typeof HeadAlternate.Type) {
  return {
    href,
    rel: "alternate",
    ...(hreflang === undefined ? {} : { hreflang }),
    ...(type === undefined ? {} : { type }),
  };
}

/**
 * Maps a head to the head entries of the router. The mapping keeps the order of
 * the page: the canonical link, the alternates, the title and description, the
 * robots and googlebot rules, the social entries, and the JSON-LD scripts. A
 * page without a canonical address names none. Twitter entries are named, and
 * Open Graph entries carry a property.
 */
export function toRouterHead(head: SeoHead) {
  return {
    links: [
      ...(head.canonical === undefined
        ? []
        : [{ href: head.canonical, rel: "canonical" }]),
      ...Arr.map(head.alternates, toAlternateLink),
    ],
    meta: [
      { title: head.title },
      { content: head.description, name: "description" },
      { content: head.robots, name: "robots" },
      { content: head.googlebot, name: "googlebot" },
      ...Arr.map(Rec.toEntries(head.social), ([key, content]) =>
        key.startsWith("twitter:")
          ? { content, name: key }
          : { content, property: key }
      ),
      ...Arr.map(head.jsonLd, (node) => ({ "script:ld+json": node })),
    ],
  };
}
