import type { NakafaAgentTaxonomy } from "@repo/contents/_lib/agent/schema/taxonomy";
import { describe, expect, it } from "vitest";
import { toLegacyNakafaTaxonomy } from "@/lib/mcp/taxonomy";

describe("SDK 1.30 taxonomy projection", () => {
  it("preserves content taxonomy while restoring legacy endpoint guidance", () => {
    const taxonomy: NakafaAgentTaxonomy = {
      articles: { categories: ["mathematics"] },
      content_counts: [{ count: 1, locale: "en" }],
      default_locale: "en",
      endpoints: { mcp: "https://mcp.nakafa.com/mcp" },
      locale: "en",
      locales: ["en"],
      quran: { surah_count: 114 },
      sections: ["material"],
      tools: ["nakafa_get_taxonomy"],
      tryout: { countries: [], exams: [] },
    };

    expect(toLegacyNakafaTaxonomy(taxonomy)).toStrictEqual({
      ...taxonomy,
      endpoints: {
        direct: "https://mcp.nakafa.com/mcp",
        recommended: "https://nakafa.com/mcp",
        root_note: "https://mcp.nakafa.com is informational only.",
      },
    });
  });
});
