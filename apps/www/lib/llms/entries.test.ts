// @vitest-environment node
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  buildRuntimeContentLlmsEntries,
  getLlmsSections,
  getSiteLlmsEntries,
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

  it("localizes static site routes", () => {
    const englishEntries = getSiteLlmsEntries("en");
    const indonesianEntries = getSiteLlmsEntries("id");
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
    expect(indonesianCurriculum).toMatchObject({
      href: `${BASE_URL}/id/kurikulum`,
      section: "site",
      title: "Kurikulum",
    });
    expect(englishEntries.map((entry) => entry.route)).toEqual([
      "/curriculum",
      "/privacy-policy",
      "/security-policy",
      "/terms-of-service",
    ]);
    expect(englishEntries.some((entry) => entry.route === "/")).toBe(false);
    expect(englishEntries.some((entry) => entry.route === "/contributor")).toBe(
      false
    );
    expect(englishEntries.some((entry) => entry.route === "/search")).toBe(
      false
    );
  });

  it("preserves source content metadata in markdown entries", () => {
    const route = "articles/politics/dynastic-politics-asian-values";
    const graph = createLearningGraphIdentityFromRoute({
      locale: "en",
      route,
    });
    if (!graph) {
      expect.fail("Expected the real article route to have a graph identity.");
    }

    expect(
      buildRuntimeContentLlmsEntries({
        locale: "en",
        rows: [
          {
            ...graph,
            authors: [{ name: "Shifna Zihdatal Haq" }],
            content_id: graph.assetId,
            description:
              "How Asian values are used to justify dynastic politics in Indonesian local elections, and why that argument matters for democracy.",
            kind: "article",
            locale: "en",
            markdown: true,
            route,
            section: "articles",
            sourcePath: route,
            syncedAt: 1,
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
});
