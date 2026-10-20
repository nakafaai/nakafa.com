import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import { Array as Arr } from "effect";
import type { CreativeWork, ListItem } from "schema-dts";

/** One part of a collection: a page that the collection lists, with the facts it names. */
type CollectionItem = Pick<CreativeWork, "name" | "description" | "url">;

/** The collection that one index page describes, with each of its pages as a part. */
interface CollectionPageInput {
  readonly datePublished?: string;
  readonly description: string;
  readonly items: readonly CollectionItem[];
  readonly name: string;
  readonly url: string;
}

/** The Quran surah that one book page describes, with its author and its size. */
interface BookInput {
  readonly author: { readonly "@type": "Person"; readonly name: string };
  readonly description: string;
  readonly inLanguage: string;
  readonly name: string;
  readonly position: number;
  readonly totalPages: number;
  readonly url: string;
}

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
export function makeCollectionPageNode(input: CollectionPageInput) {
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
export function makeBookNode(input: BookInput) {
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
