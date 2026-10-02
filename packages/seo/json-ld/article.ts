import type { ContentAuthor } from "@nakafa/aksara-contracts/content";
import {
  type PublicationDates,
  withPublicationDates,
} from "@nakafa/aksara-contracts/date";
import {
  type AppLocaleCode,
  AppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { ORGANIZATION_ID } from "@repo/seo/json-ld/constants";
import { Schema } from "effect";

const SCHEMA_ORG = "https://schema.org";

/** Text that search engines may show exactly as written. */
const TextSchema = Schema.Trimmed.check(Schema.isNonEmpty());

/** Absolute URL on the canonical Nakafa origin. */
const SiteUrlSchema = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      URL.canParse(value) && new URL(value).origin === COMPANY_IDENTITY.url,
    { message: "Expected an absolute URL on the Nakafa origin." }
  )
);

const PersonSchema = Schema.Struct({
  "@type": Schema.Literal("Person"),
  name: TextSchema,
  url: SiteUrlSchema,
});

/** Links the article to the one organization node the root layout renders. */
const PublisherSchema = Schema.Struct({
  "@type": Schema.Literal("Organization"),
  "@id": SiteUrlSchema,
  name: TextSchema,
  url: SiteUrlSchema,
});

/**
 * The Article properties Google Search recommends (authors, dates, headline,
 * and a representative image), plus the schema.org description, language, and
 * canonical URL, which Google says it can make general use of.
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/article
 * @see https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data#structured-data-vocabulary-and-format
 */
const ArticleSchema = withPublicationDates({
  "@context": Schema.Literal(SCHEMA_ORG),
  "@type": Schema.Literal("Article"),
  author: Schema.optionalKey(Schema.NonEmptyArray(PersonSchema)),
  description: Schema.optionalKey(TextSchema),
  headline: TextSchema,
  image: SiteUrlSchema,
  inLanguage: AppLocaleCodeSchema,
  publisher: PublisherSchema,
  url: SiteUrlSchema,
});

const ListItemSchema = Schema.Struct({
  "@type": Schema.Literal("ListItem"),
  item: SiteUrlSchema,
  name: TextSchema,
  position: Schema.Int,
});

/** @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb */
const BreadcrumbListSchema = Schema.Struct({
  "@context": Schema.Literal(SCHEMA_ORG),
  "@type": Schema.Literal("BreadcrumbList"),
  itemListElement: Schema.Array(ListItemSchema).check(
    Schema.isMinLength(2),
    Schema.makeFilter(
      (items) => items.every((item, index) => item.position === index + 1),
      { message: "Expected breadcrumb positions to count from 1." }
    )
  ),
});

/**
 * One JSON-LD document for a published article page: its Article and the
 * breadcrumb trail that ends at the same canonical URL.
 */
export const ArticleJsonLdSchema = Schema.Tuple([
  ArticleSchema,
  BreadcrumbListSchema,
]).check(
  Schema.makeFilter(
    ([article, breadcrumb]) =>
      breadcrumb.itemListElement.at(-1)?.item === article.url,
    { message: "Expected the breadcrumb to end at the article URL." }
  )
);
export type ArticleJsonLd = typeof ArticleJsonLdSchema.Type;

/** One breadcrumb ancestor, addressed by its localized site path. */
interface ArticleCrumb {
  readonly name: string;
  readonly path: string;
}

/** Signed content fields that describe one published article page. */
export interface ArticleJsonLdInput {
  readonly authors: readonly ContentAuthor[];
  readonly dates: PublicationDates;
  readonly description?: string | undefined;
  readonly headline: string;
  /** Site path of the page's social image, which represents the content. */
  readonly image: string;
  readonly locale: AppLocaleCode;
  /** Canonical localized path of the page, such as `/id/materi/...`. */
  readonly path: string;
  /** Visible ancestors from the site root; the page itself ends the trail. */
  readonly trail: readonly ArticleCrumb[];
}

/** Resolves one localized site path against the canonical origin. */
function toSiteUrl(path: string) {
  return new URL(path, COMPANY_IDENTITY.url).href;
}

/**
 * Builds the page's JSON-LD from signed content that is already verified, so
 * rendering never fails on structured data. `ArticleJsonLdSchema` is the
 * published contract: unit tests hold this builder to it, and the browser
 * suite decodes the rendered lessons and articles it pins with it.
 */
export function makeArticleJsonLd(input: ArticleJsonLdInput): ArticleJsonLd {
  const url = toSiteUrl(input.path);
  const authorUrl = toSiteUrl(`/${input.locale}/contributor`);
  const [firstAuthor, ...otherAuthors] = input.authors.map(({ name }) => ({
    "@type": "Person" as const,
    name,
    url: authorUrl,
  }));
  const crumbs = [...input.trail, { name: input.headline, path: input.path }];

  return [
    {
      "@context": SCHEMA_ORG,
      "@type": "Article",
      url,
      headline: input.headline,
      image: toSiteUrl(input.image),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      inLanguage: input.locale,
      datePublished: input.dates.datePublished,
      ...(input.dates.dateModified === undefined
        ? {}
        : { dateModified: input.dates.dateModified }),
      ...(firstAuthor === undefined
        ? {}
        : { author: [firstAuthor, ...otherAuthors] }),
      publisher: {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: COMPANY_IDENTITY.brandName,
        url: COMPANY_IDENTITY.url,
      },
    },
    {
      "@context": SCHEMA_ORG,
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: toSiteUrl(crumb.path),
      })),
    },
  ];
}
