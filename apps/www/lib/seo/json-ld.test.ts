import { describe, expect, it } from "@effect/vitest";
import {
  makeBookNode,
  makeCollectionPageNode,
  readBreadcrumbNodes,
} from "@/lib/seo/json-ld";

describe("readBreadcrumbNodes", () => {
  it("returns no node for an empty hierarchy", () => {
    expect(readBreadcrumbNodes([])).toEqual([]);
  });

  it("returns one BreadcrumbList node that carries every item", () => {
    const items = [
      {
        "@type": "ListItem" as const,
        item: "https://nakafa.com/en",
        name: "Home",
        position: 1,
      },
    ];
    expect(readBreadcrumbNodes(items)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items,
      },
    ]);
  });
});

describe("makeCollectionPageNode", () => {
  it("lists every item as a WebPage part", () => {
    const node = makeCollectionPageNode({
      description: "Articles",
      items: [
        { name: "Algebra", url: "https://nakafa.com/en/articles/math/algebra" },
      ],
      name: "Mathematics",
      url: "https://nakafa.com/en/articles/math",
    });
    expect(node["@type"]).toBe("CollectionPage");
    expect(node.hasPart).toEqual([
      {
        "@type": "WebPage",
        name: "Algebra",
        url: "https://nakafa.com/en/articles/math/algebra",
      },
    ]);
  });
});

describe("makeBookNode", () => {
  it("describes one Quran surah as a free EBook", () => {
    expect(
      makeBookNode({
        author: { "@type": "Person", name: "Allah" },
        description: "The Opening",
        inLanguage: "en",
        name: "Al-Fatihah",
        position: 1,
        totalPages: 7,
        url: "https://nakafa.com/en/quran/1",
      })
    ).toMatchObject({
      "@type": "Book",
      bookFormat: "EBook",
      isAccessibleForFree: true,
      numberOfPages: 7,
      position: 1,
    });
  });
});
