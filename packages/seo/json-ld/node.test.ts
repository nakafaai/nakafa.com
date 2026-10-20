import { describe, expect, it } from "@effect/vitest";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { FOUNDER, ORGANIZATION_ID } from "@repo/seo/json-ld/constants";
import {
  makeBookNode,
  makeBreadcrumbNodes,
  makeCollectionPageNode,
  makeEducationalOrganizationNode,
  makeFaqPageNode,
} from "@repo/seo/json-ld/node";

describe("makeEducationalOrganizationNode", () => {
  it("describes the site as an educational organization that names its founder", () => {
    const node = makeEducationalOrganizationNode({
      alternateName: "Nakafa",
      description: "Free learning for every student",
    });

    expect(node).toMatchObject({
      "@context": "https://schema.org",
      "@id": ORGANIZATION_ID,
      "@type": "EducationalOrganization",
      alternateName: "Nakafa",
      areaServed: COMPANY_IDENTITY.registeredAddress.country,
      description: "Free learning for every student",
      founder: FOUNDER,
      image: COMPANY_IDENTITY.logoUrl,
    });
    expect(node.knowsAbout).toContain("Mathematics");
  });
});

describe("makeBreadcrumbNodes", () => {
  it("returns no node for an empty hierarchy", () => {
    expect(makeBreadcrumbNodes([])).toEqual([]);
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

    expect(makeBreadcrumbNodes(items)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items,
      },
    ]);
  });
});

describe("makeCollectionPageNode", () => {
  const input = {
    description: "Articles",
    items: [
      {
        name: "Algebra",
        url: "https://nakafa.com/en/articles/math/algebra",
      },
    ],
    name: "Mathematics",
    url: "https://nakafa.com/en/articles/math",
  };

  it("lists every item as a WebPage part", () => {
    const node = makeCollectionPageNode(input);

    expect(node["@type"]).toBe("CollectionPage");
    expect(node.hasPart).toEqual([
      {
        "@type": "WebPage",
        name: "Algebra",
        url: "https://nakafa.com/en/articles/math/algebra",
      },
    ]);
    expect(node).not.toHaveProperty("datePublished");
  });

  it("names the date that the collection was published, when it has one", () => {
    expect(
      makeCollectionPageNode({ ...input, datePublished: "2026-10-01" })
    ).toMatchObject({ datePublished: "2026-10-01" });
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

describe("makeFaqPageNode", () => {
  it("returns one FAQPage node whose questions carry their answers in order", () => {
    expect(
      makeFaqPageNode({
        inLanguage: "en",
        items: [
          {
            answer: "Start with arithmetic.",
            question: "How do I learn math?",
          },
          { answer: "Yes, it is free.", question: "Is it free?" },
        ],
        url: "https://nakafa.com/en",
      })
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "en",
      mainEntity: [
        {
          "@type": "Question",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Start with arithmetic.",
          },
          name: "How do I learn math?",
        },
        {
          "@type": "Question",
          acceptedAnswer: { "@type": "Answer", text: "Yes, it is free." },
          name: "Is it free?",
        },
      ],
      url: "https://nakafa.com/en",
    });
  });
});
