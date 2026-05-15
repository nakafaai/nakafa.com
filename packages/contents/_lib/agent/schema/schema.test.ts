import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentContentSummarySchema,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent schemas", () => {
  it("applies default Quran and taxonomy options", () => {
    const quranOptions = Schema.decodeUnknownSync(
      NakafaAgentQuranReferenceOptionsSchema
    )({
      surah: 1,
    });
    const taxonomyOptions = Schema.decodeUnknownSync(
      NakafaAgentTaxonomyOptionsSchema
    )({});

    expect(quranOptions).toMatchObject({
      from_verse: 1,
      include_tafsir: false,
      locale: "en",
      surah: 1,
    });
    expect(taxonomyOptions).toStrictEqual({ locale: "en" });
  });

  it("rejects invalid canonical URLs with schema messages", () => {
    const invalidReference = {
      content_id: "en/quran/1",
      locale: "en",
      markdown_url: "not-a-url",
      route: "quran/1",
      section: "quran",
      url: "https://nakafa.com/en/quran/1",
    };

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRefSchema)(invalidReference)
    ).toThrow("Expected a valid URL.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentSummarySchema)({
        ...invalidReference,
        description: "Al-Fatihah",
        markdown_url: "https://nakafa.com/en/quran/1.md",
        title: "Al-Fatihah",
        url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentTaxonomySchema)({
        articles: { categories: [] },
        content_counts: [{ count: 1, locale: "en" }],
        default_locale: "en",
        endpoints: {
          direct: "not-a-url",
          recommended: "https://mcp.nakafa.com/mcp",
          root_note: "Use the direct endpoint.",
        },
        exercises: { categories: [], materials: [], types: [] },
        locale: "en",
        locales: ["en", "id"],
        quran: { surah_count: 114 },
        sections: ["articles", "exercises", "quran", "subject"],
        subject: { categories: [], grades: [], materials: [] },
        tools: [],
      })
    ).toThrow("Expected a valid URL.");
  });
});
