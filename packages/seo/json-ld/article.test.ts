import { describe, expect, it } from "@effect/vitest";
import {
  type ArticleJsonLd,
  type ArticleJsonLdInput,
  ArticleJsonLdSchema,
  makeArticleJsonLd,
} from "@repo/seo/json-ld/article";
import { Schema } from "effect";

const decodeJsonLd = Schema.decodeUnknownSync(
  Schema.fromJsonString(ArticleJsonLdSchema)
);
const encodeJsonLdText = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** Reads the document like a crawler: JSON text, no undeclared properties. */
function readPublishedJsonLd(value: unknown) {
  return decodeJsonLd(encodeJsonLdText(value), {
    onExcessProperty: "error",
  });
}

const lesson = {
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  dates: { dateModified: "2026-09-23", datePublished: "2025-05-26" },
  description:
    "Gunakan rumus, grafik, dan contoh dengan pembahasan lengkap untuk merotasi titik serta kurva fungsi terhadap pusat tetap.",
  headline: "Rotasi",
  image: "/id/og/materi/matematika/transformasi-fungsi/rotasi/image.png",
  locale: "id",
  path: "/id/materi/matematika/transformasi-fungsi/rotasi",
  trail: [{ name: "Beranda", path: "/id" }],
} satisfies ArticleJsonLdInput;

const lessonUrl =
  "https://nakafa.com/id/materi/matematika/transformasi-fungsi/rotasi";

describe("article JSON-LD", () => {
  it("describes a lesson and ends its breadcrumb at the lesson", () => {
    expect(makeArticleJsonLd(lesson)).toStrictEqual([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        url: lessonUrl,
        headline: "Rotasi",
        image:
          "https://nakafa.com/id/og/materi/matematika/transformasi-fungsi/rotasi/image.png",
        description: lesson.description,
        inLanguage: "id",
        datePublished: "2025-05-26",
        dateModified: "2026-09-23",
        author: [
          {
            "@type": "Person",
            name: "Nabil Akbarazzima Fatih",
            url: "https://nakafa.com/id/contributor",
          },
        ],
        publisher: {
          "@type": "Organization",
          "@id": "https://nakafa.com/#organization",
          name: "Nakafa",
          url: "https://nakafa.com",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Beranda",
            item: "https://nakafa.com/id",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Rotasi",
            item: lessonUrl,
          },
        ],
      },
    ]);
  });

  it("publishes only the properties its contract declares", () => {
    const document = makeArticleJsonLd(lesson);

    expect(readPublishedJsonLd(document)).toStrictEqual(document);
  });

  it("numbers every ancestor before the article", () => {
    const [, breadcrumb] = makeArticleJsonLd({
      ...lesson,
      headline: "Regional Elections Turmoil",
      locale: "en",
      path: "/en/articles/politics/regional-elections-turmoil",
      trail: [
        { name: "Home", path: "/en" },
        { name: "Articles", path: "/en/articles" },
        { name: "Politics", path: "/en/articles/politics" },
      ],
    });

    expect(breadcrumb.itemListElement).toStrictEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://nakafa.com/en",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: "https://nakafa.com/en/articles",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Politics",
        item: "https://nakafa.com/en/articles/politics",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Regional Elections Turmoil",
        item: "https://nakafa.com/en/articles/politics/regional-elections-turmoil",
      },
    ]);
  });

  it("leaves out what the content does not state", () => {
    const [article] = readPublishedJsonLd(
      makeArticleJsonLd({
        ...lesson,
        authors: [],
        dates: { datePublished: "2025-05-26" },
        description: undefined,
      })
    );

    expect(article).not.toHaveProperty("author");
    expect(article).not.toHaveProperty("dateModified");
    expect(article).not.toHaveProperty("description");
  });

  it("gives every author a node of their own", () => {
    const [article] = makeArticleJsonLd({
      ...lesson,
      authors: [
        { name: "Nabil Akbarazzima Fatih" },
        { name: "Nur Sita Utami" },
      ],
    });

    expect(article.author?.map((author) => author.name)).toStrictEqual([
      "Nabil Akbarazzima Fatih",
      "Nur Sita Utami",
    ]);
  });

  it.each<
    readonly [
      string,
      (document: ArticleJsonLd) => readonly [unknown, unknown],
      string,
    ]
  >([
    [
      "a type Google no longer documents",
      ([article, breadcrumb]) => [
        { ...article, "@type": "LearningResource" },
        breadcrumb,
      ],
      'Expected "Article"',
    ],
    [
      "an undeclared property",
      ([article, breadcrumb]) => [
        { ...article, educationalLevel: "Transformasi Fungsi" },
        breadcrumb,
      ],
      "Expected no excess property",
    ],
    [
      "a URL outside the Nakafa origin",
      ([article, breadcrumb]) => [
        { ...article, url: "https://example.com/rotasi" },
        breadcrumb,
      ],
      "Expected an absolute URL on the Nakafa origin.",
    ],
    [
      "text with surrounding whitespace",
      ([article, breadcrumb]) => [
        { ...article, headline: " Rotasi" },
        breadcrumb,
      ],
      "Expected a string with no leading or trailing whitespace",
    ],
    [
      "a modification date before publication",
      ([article, breadcrumb]) => [
        { ...article, dateModified: "2025-05-01" },
        breadcrumb,
      ],
      "Expected dateModified to be later than datePublished.",
    ],
    [
      "a breadcrumb that skips a position",
      ([article, breadcrumb]) => [
        article,
        {
          ...breadcrumb,
          itemListElement: breadcrumb.itemListElement.map((item) => ({
            ...item,
            position: item.position + 1,
          })),
        },
      ],
      "Expected breadcrumb positions to count from 1.",
    ],
    [
      "a one-item breadcrumb",
      ([article, breadcrumb]) => [
        article,
        {
          ...breadcrumb,
          itemListElement: breadcrumb.itemListElement
            .slice(-1)
            .map((item) => ({ ...item, position: 1 })),
        },
      ],
      "Expected a value with a length of at least 2",
    ],
    [
      "a breadcrumb that ends at another page",
      ([article, breadcrumb]) => [
        article,
        {
          ...breadcrumb,
          itemListElement: breadcrumb.itemListElement.map((item) => ({
            ...item,
            item: "https://nakafa.com/id",
          })),
        },
      ],
      "Expected the breadcrumb to end at the article URL.",
    ],
  ])("rejects %s", (_, corrupt, message) => {
    expect(() =>
      readPublishedJsonLd(corrupt(makeArticleJsonLd(lesson)))
    ).toThrow(message);
  });
});
