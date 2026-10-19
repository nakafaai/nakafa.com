import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import { Array as Arr, Schema } from "effect";
import type { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";

/** One JSON-LD node as the head seam carries it. */
type JsonLdNode = Readonly<Record<string, unknown>>;

/** The visible hierarchy of one page, as `createBreadcrumbItems` builds it. */
type BreadcrumbItems = ReturnType<typeof createBreadcrumbItems>;

/** The breadcrumb node of a page, or none when the hierarchy is empty. */
export function readBreadcrumbNodes(items: BreadcrumbItems): JsonLdNode[] {
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

/** The collection node that lists the pages of one index. */
const CollectionPageInput = Schema.Struct({
  description: Schema.String,
  items: Schema.Array(
    Schema.Struct({ name: Schema.String, url: Schema.String })
  ),
  name: Schema.String,
  url: Schema.String,
});

export function makeCollectionPageNode(
  input: typeof CollectionPageInput.Type
): JsonLdNode {
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

/** The book node of one Quran surah. */
const BookInput = Schema.Struct({
  author: Schema.Struct({
    "@type": Schema.Literal("Person"),
    name: Schema.String,
  }),
  description: Schema.String,
  inLanguage: Schema.String,
  name: Schema.String,
  position: Schema.Number,
  totalPages: Schema.Number,
  url: Schema.String,
});

export function makeBookNode(input: typeof BookInput.Type): JsonLdNode {
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
