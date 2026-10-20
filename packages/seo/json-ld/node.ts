import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import { Array as Arr, Schema } from "effect";
import type { ListItem } from "schema-dts";

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
