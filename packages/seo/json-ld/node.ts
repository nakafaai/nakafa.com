import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  FOUNDER,
  ORGANIZATION,
  ORGANIZATION_REFERENCE,
} from "@repo/seo/json-ld/constants";
import { Array as Arr, Schema } from "effect";
import type {
  EducationalOrganization,
  ListItem,
  WebSite,
  WithContext,
} from "schema-dts";

/** The names of the site's own organization, in the locale of the page that carries it. */
const EducationalOrganizationInput = Schema.Struct({
  alternateName: Schema.String,
  description: Schema.String,
});

/** The subjects that the educational organization says it knows about. */
const EDUCATIONAL_SUBJECTS = [
  "Education",
  "Mathematics",
  "Science",
  "Computer Science",
  "Artificial Intelligence",
  "K-12 Education",
  "University Level Education",
  "Online Learning",
  "Educational Technology",
];

/** One page that a collection lists, with the facts it names. */
const CollectionItem = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  name: Schema.String,
  url: Schema.String,
});

/** The collection that one index page describes, with each of its pages as a part. */
const CollectionPageInput = Schema.Struct({
  datePublished: Schema.optionalKey(Schema.String),
  description: Schema.String,
  items: Schema.Array(CollectionItem),
  name: Schema.String,
  url: Schema.String,
});

/** One question of a FAQ page, with the answer that the page gives it. */
const FaqItem = Schema.Struct({
  answer: Schema.String,
  question: Schema.String,
});

/** The FAQ page that one page answers, with its questions in the order it asks them. */
const FaqPageInput = Schema.Struct({
  inLanguage: Schema.String,
  items: Schema.Array(FaqItem),
  url: Schema.String,
});

/** The Quran surah that one book page describes, with its author and its size. */
const BookInput = Schema.Struct({
  author: Schema.Struct({
    "@type": Schema.Literal("Person"),
    name: Schema.String,
  }),
  description: Schema.String,
  inLanguage: Schema.String,
  name: Schema.String,
  position: Schema.Finite,
  totalPages: Schema.Finite,
  url: Schema.String,
});

/**
 * The breadcrumb node of a page's visible hierarchy, as plain data for the head
 * seam. An empty hierarchy has no node, because an empty list is invalid JSON-LD.
 */
export function makeBreadcrumbNodes(items: readonly ListItem[]) {
  if (items.length === 0) {
    return [];
  }
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    },
  ];
}

/** The collection node of one index, with each of its pages as a part. */
export function makeCollectionPageNode(input: typeof CollectionPageInput.Type) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: input.url,
    publisher: ORGANIZATION,
    maintainer: ORGANIZATION,
    hasPart: Arr.map(input.items, (item) => ({ "@type": "WebPage", ...item })),
    ...(input.datePublished === undefined
      ? {}
      : { datePublished: input.datePublished }),
  };
}

/** The FAQ page node of one page, with each question and its answer. */
export function makeFaqPageNode(input: typeof FaqPageInput.Type) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: input.url,
    inLanguage: input.inLanguage,
    mainEntity: Arr.map(input.items, (item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** The book node of one Quran surah, which is a free EBook. */
export function makeBookNode(input: typeof BookInput.Type) {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: input.inLanguage,
    bookFormat: "EBook",
    isAccessibleForFree: true,
    author: input.author,
    position: input.position,
    numberOfPages: input.totalPages,
  };
}

/**
 * The EducationalOrganization node of the site, which names its founder. It
 * extends the organization node, so both describe the same `@id`, and every page
 * of a locale carries it as the reference app's locale layout does.
 *
 * @see https://schema.org/EducationalOrganization
 */
export function makeEducationalOrganizationNode(
  input: typeof EducationalOrganizationInput.Type
): WithContext<EducationalOrganization> {
  return {
    ...ORGANIZATION,
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    alternateName: input.alternateName,
    areaServed: COMPANY_IDENTITY.registeredAddress.country,
    description: input.description,
    foundingDate: "2021",
    founder: FOUNDER,
    image: COMPANY_IDENTITY.logoUrl,
    knowsAbout: EDUCATIONAL_SUBJECTS,
  };
}

/** The locale of the site's WebSite node, which names the site in the locale's words. */
const WebsiteInput = Schema.Struct({
  alternateName: Schema.String,
  description: Schema.String,
  locale: Schema.String,
});

/** The search action of the site: its search page answers the query that the template names. */
const searchAction = {
  "@type": "SearchAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: `${COMPANY_IDENTITY.url}/search?q={search_term_string}`,
  },
  "query-input": "required name=search_term_string",
} as const;

/**
 * The WebSite node of the site, with the search action that the site's search
 * page answers. Every locale page carries it, as the reference app's locale
 * layout does, so search engines can offer the sitelinks search box.
 *
 * @see https://schema.org/WebSite
 */
export function makeWebsiteNode(
  input: typeof WebsiteInput.Type
): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": new URL("#website", COMPANY_IDENTITY.url).href,
    url: COMPANY_IDENTITY.url,
    name: COMPANY_IDENTITY.brandName,
    alternateName: input.alternateName,
    description: input.description,
    publisher: ORGANIZATION_REFERENCE,
    maintainer: ORGANIZATION_REFERENCE,
    inLanguage: input.locale,
    potentialAction: searchAction,
  };
}
