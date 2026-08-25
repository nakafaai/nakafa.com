import {
  NakafaAgentLegacyTaxonomySchema,
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentTaxonomyOptionsSchema", () => {
  it("applies default taxonomy options", () => {
    expect(
      Schema.decodeSync(NakafaAgentTaxonomyOptionsSchema)({})
    ).toStrictEqual({ locale: "en" });
  });
});

describe("NakafaAgentTaxonomySchema", () => {
  const taxonomy = {
    articles: { categories: [] },
    content_counts: [{ count: 1, locale: "en" }],
    default_locale: "en",
    locale: "en",
    locales: ["en", "id", "de"],
    quran: { surah_count: 114 },
    sections: ["articles", "material", "quran"],
    tools: [],
    tryout: { countries: [], exams: [] },
  };

  it("rejects invalid canonical endpoint URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentTaxonomySchema)({
        ...taxonomy,
        endpoints: {
          mcp: "not-a-url",
        },
      })
    ).toThrow("Expected a valid URL.");
  });

  it("keeps modern and SDK 1.30 endpoint contracts separate", () => {
    const modern = {
      ...taxonomy,
      endpoints: { mcp: "https://mcp.nakafa.com/mcp" },
    };
    const legacy = {
      ...taxonomy,
      endpoints: {
        direct: "https://mcp.nakafa.com/mcp",
        recommended: "https://nakafa.com/mcp",
        root_note: "The MCP subdomain root is informational only.",
      },
    };

    expect(Schema.decodeUnknownSync(NakafaAgentTaxonomySchema)(modern)).toEqual(
      modern
    );
    expect(
      Schema.decodeUnknownSync(NakafaAgentLegacyTaxonomySchema)(legacy)
    ).toEqual(legacy);
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentTaxonomySchema)(legacy)
    ).toThrow("mcp");
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentLegacyTaxonomySchema)(modern)
    ).toThrow("direct");
  });
});
