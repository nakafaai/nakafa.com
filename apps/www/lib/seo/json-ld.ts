import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import { Array as Arr } from "effect";
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
export function makeCollectionPageNode(input: {
  readonly description: string;
  readonly items: readonly { readonly name: string; readonly url: string }[];
  readonly name: string;
  readonly url: string;
}): JsonLdNode {
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
export function makeBookNode(input: {
  readonly author: { readonly "@type": "Person"; readonly name: string };
  readonly description: string;
  readonly inLanguage: string;
  readonly name: string;
  readonly position: number;
  readonly totalPages: number;
  readonly url: string;
}): JsonLdNode {
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
