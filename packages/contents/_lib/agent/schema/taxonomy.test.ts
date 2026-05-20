import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentTaxonomyOptionsSchema", () => {
  it("applies default taxonomy options", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentTaxonomyOptionsSchema)({})
    ).toStrictEqual({ locale: "en" });
  });
});

describe("NakafaAgentTaxonomySchema", () => {
  it("rejects invalid canonical endpoint URLs", () => {
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
