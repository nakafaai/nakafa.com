import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import { Array as Arr, Schema } from "effect";
import type { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";

/** The visible hierarchy of one page, as `createBreadcrumbItems` builds it. */
type BreadcrumbItems = ReturnType<typeof createBreadcrumbItems>;

/** The breadcrumb node of a page, or none when the hierarchy is empty. */
export function readBreadcrumbNodes(items: BreadcrumbItems) {
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

const CollectionPageInput = Schema.Struct({
  description: Schema.String,
  items: Schema.Array(
    Schema.Struct({ name: Schema.String, url: Schema.String })
  ),
  name: Schema.String,
  url: Schema.String,
});

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
  };
}

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

/** The book node of one Quran surah. */
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
