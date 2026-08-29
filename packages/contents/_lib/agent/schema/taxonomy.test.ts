import { describe, expect, it } from "@effect/vitest";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Schema } from "effect";

describe("NakafaAgentTaxonomyOptionsSchema", () => {
  it("applies default taxonomy options", () => {
    expect(
      Schema.decodeSync(NakafaAgentTaxonomyOptionsSchema)({})
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
        mcp: "not-a-url",
        exercises: { categories: [], materials: [], types: [] },
        locale: "en",
        locales: ["en", "id", "de"],
        quran: { surah_count: 114 },
        sections: ["articles", "material", "quran"],
        tools: [],
      })
    ).toThrow("Expected a valid URL.");
  });
});
