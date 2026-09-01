// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  PageKeySchema,
  PublicPageProjectionSchema,
} from "@nakafa/aksara-contracts/projection/page";
import { BASE_URL } from "@/lib/llms/constants";
import {
  buildPublishedContentLlmsEntries,
  buildSiteLlmsEntries,
  getLlmsSections,
  isLlmsSection,
} from "@/lib/llms/entries";

describe("llms entries", () => {
  it("classifies supported sections", () => {
    expect(isLlmsSection("articles")).toBe(true);
    expect(isLlmsSection("unknown")).toBe(false);
    expect(isLlmsSection(undefined)).toBe(false);
    expect(getLlmsSections()).toEqual([
      "articles",
      "material",
      "quran",
      "site",
    ]);
  });

  it("combines localized indexes with signed Page metadata", () => {
    const page = PublicPageProjectionSchema.make({
      appLocale: AppLocaleSchema.make("en"),
      artifactLocale: ArtifactLocaleSchema.make("en"),
      contentKey: ContentKeySchema.make("pages/privacy-policy"),
      kind: "public-page",
      metadata: {
        datePublished: "2026-08-21",
        description: "How Nakafa protects personal data.",
        title: "Privacy Policy",
      },
      pageKey: PageKeySchema.make("privacy-policy"),
      publicPath: PublicPathSchema.make("privacy-policy"),
      sitemap: true,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/pages/privacy-policy/en.mdx"
      ),
    });
    const englishEntries = buildSiteLlmsEntries(
      "en",
      [page],
      [
        {
          description:
            "Compare Nakafa Free and Pro for learning materials, practice questions, Nina AI tutoring, and online Tryouts.",
          route: "/pricing",
          title: "Pricing",
        },
      ]
    );
    const indonesianEntries = buildSiteLlmsEntries(
      "id",
      [page],
      [
        {
          description:
            "Bandingkan Nakafa Gratis dan Pro untuk materi belajar, latihan soal, tutor AI Nina, dan Tryout online.",
          route: "/pricing",
          title: "Harga",
        },
      ]
    );
    const englishCurriculum = englishEntries.find(
      (entry) => entry.route === "/curriculum"
    );
    const indonesianCurriculum = indonesianEntries.find(
      (entry) => entry.route === "/kurikulum"
    );

    expect(englishCurriculum).toMatchObject({
      href: `${BASE_URL}/en/curriculum`,
      section: "site",
      title: "Curriculum",
    });
    expect(
      englishEntries.find((entry) => entry.route === "/pricing")
    ).toMatchObject({
      description:
        "Compare Nakafa Free and Pro for learning materials, practice questions, Nina AI tutoring, and online Tryouts.",
      href: `${BASE_URL}/en/pricing`,
      section: "site",
      title: "Pricing",
    });
    expect(indonesianCurriculum).toMatchObject({
      href: `${BASE_URL}/id/kurikulum`,
      section: "site",
      title: "Kurikulum",
    });
    expect(englishEntries.map((entry) => entry.route)).toEqual([
      "/curriculum",
      "/pricing",
      "/privacy-policy",
    ]);
    expect(englishEntries[1]).toMatchObject({
      route: "/pricing",
      title: "Pricing",
    });
    expect(englishEntries[2]).toMatchObject({
      description: page.metadata.description,
      title: page.metadata.title,
    });
    expect(indonesianEntries.map((entry) => entry.route)).toEqual([
      "/kurikulum",
      "/pricing",
    ]);
    expect(
      indonesianEntries.find((entry) => entry.route === "/pricing")
    ).toMatchObject({
      description:
        "Bandingkan Nakafa Gratis dan Pro untuk materi belajar, latihan soal, tutor AI Nina, dan Tryout online.",
      title: "Harga",
    });
    expect(englishEntries.some((entry) => entry.route === "/")).toBe(false);
    expect(englishEntries.some((entry) => entry.route === "/contributor")).toBe(
      false
    );
    expect(englishEntries.some((entry) => entry.route === "/search")).toBe(
      false
    );
  });

  it("preserves signed content metadata in markdown entries", () => {
    expect(
      buildPublishedContentLlmsEntries({
        locale: "en",
        rows: [
          {
            description:
              "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
            publicPath: "articles/politics/dynastic-politics-asian-values",
            title:
              "Framing Dynastic Politics in Local Elections within Asian Values",
          },
        ],
        section: "articles",
      })
    ).toEqual([
      {
        description:
          "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
        href: `${BASE_URL}/en/articles/politics/dynastic-politics-asian-values.md`,
        route: "/articles/politics/dynastic-politics-asian-values",
        section: "articles",
        segments: ["articles", "politics", "dynastic-politics-asian-values"],
        title:
          "Framing Dynastic Politics in Local Elections within Asian Values",
      },
    ]);
  });

  it("keeps an absent signed description absent", () => {
    const [entry] = buildPublishedContentLlmsEntries({
      locale: "de",
      rows: [
        {
          publicPath: "articles/politik/beispiel",
          title: "Beispiel",
        },
      ],
      section: "articles",
    });

    expect(entry).not.toHaveProperty("description");
  });

  it("preserves every segment of a nested signed Page route", () => {
    const page = PublicPageProjectionSchema.make({
      appLocale: AppLocaleSchema.make("en"),
      artifactLocale: ArtifactLocaleSchema.make("en"),
      contentKey: ContentKeySchema.make("pages/privacy-policy"),
      kind: "public-page",
      metadata: {
        datePublished: "2026-08-21",
        description: "How Nakafa protects personal data.",
        title: "Privacy Policy",
      },
      pageKey: PageKeySchema.make("privacy-policy"),
      publicPath: PublicPathSchema.make("legal/privacy-policy"),
      sitemap: true,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/pages/privacy-policy/en.mdx"
      ),
    });

    expect(
      buildSiteLlmsEntries(
        "en",
        [page],
        [
          {
            description: "Compare Nakafa Free and Pro.",
            route: "/pricing",
            title: "Pricing",
          },
        ]
      )[2]
    ).toMatchObject({
      route: "/legal/privacy-policy",
      segments: ["site", "legal", "privacy-policy"],
    });
  });
});
