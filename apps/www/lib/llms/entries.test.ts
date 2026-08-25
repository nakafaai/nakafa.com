// @vitest-environment node
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
import { describe, expect, it } from "vitest";
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
        description: "How Nakafa protects personal data.",
        lastModified: "2026-08-21",
        title: "Privacy Policy",
      },
      pageKey: PageKeySchema.make("privacy-policy"),
      publicPath: PublicPathSchema.make("privacy-policy"),
      sitemap: true,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/pages/privacy-policy/en.mdx"
      ),
    });
    const englishEntries = buildSiteLlmsEntries("en", [page]);
    const indonesianEntries = buildSiteLlmsEntries("id", [page]);
    const englishContact = englishEntries.find(
      (entry) => entry.route === "/contact"
    );
    const indonesianContact = indonesianEntries.find(
      (entry) => entry.route === "/contact"
    );

    expect(englishContact).toMatchObject({
      href: `${BASE_URL}/en/contact`,
      section: "site",
      title: "Contact",
    });
    expect(indonesianContact).toMatchObject({
      href: `${BASE_URL}/id/contact`,
      section: "site",
      title: "Contact",
    });
    expect(englishEntries.map((entry) => entry.route)).toEqual([
      "/contact",
      "/privacy-policy",
    ]);
    expect(englishEntries[1]).toMatchObject({
      description: page.metadata.description,
      title: page.metadata.title,
    });
    expect(indonesianEntries.map((entry) => entry.route)).toEqual(["/contact"]);
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

  it("preserves every segment of a nested signed Page route", () => {
    const page = PublicPageProjectionSchema.make({
      appLocale: AppLocaleSchema.make("en"),
      artifactLocale: ArtifactLocaleSchema.make("en"),
      contentKey: ContentKeySchema.make("pages/privacy-policy"),
      kind: "public-page",
      metadata: {
        description: "How Nakafa protects personal data.",
        lastModified: "2026-08-21",
        title: "Privacy Policy",
      },
      pageKey: PageKeySchema.make("privacy-policy"),
      publicPath: PublicPathSchema.make("legal/privacy-policy"),
      sitemap: true,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/pages/privacy-policy/en.mdx"
      ),
    });

    expect(buildSiteLlmsEntries("en", [page])[1]).toMatchObject({
      route: "/legal/privacy-policy",
      segments: ["site", "legal", "privacy-policy"],
    });
  });
});
