import type { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/catalog/source";
import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import {
  buildNakafaAgentTaxonomy,
  decodeNakafaAgentTaxonomy,
  getNakafaAgentTaxonomy,
} from "@repo/contents/_lib/agent/taxonomy/read";
import type { Locale } from "@repo/contents/_types/content";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetNakafaAgentContentIndex = vi.hoisted(() =>
  vi.fn<typeof getNakafaAgentContentIndex>()
);

vi.mock("@repo/contents/_lib/agent/catalog/source", () => ({
  getNakafaAgentContentIndex: mockGetNakafaAgentContentIndex,
}));

/** Builds small valid content summaries for fast taxonomy count tests. */
function buildContentSummaries(locale: Locale, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...buildNakafaContentRef(locale, `articles/mock-${index + 1}`, "articles"),
    description: `Mock content ${index + 1}`,
    title: `Mock Content ${index + 1}`,
  }));
}

describe("Nakafa agent taxonomy", () => {
  beforeEach(() => {
    mockGetNakafaAgentContentIndex.mockImplementation((locale = "en") => {
      const count = locale === "en" ? 2 : 1;

      return Effect.succeed(buildContentSummaries(locale, count));
    });
  });

  it("returns taxonomy counts and endpoint guidance", async () => {
    const taxonomy = await Effect.runPromise(getNakafaAgentTaxonomy("en"));
    const defaultTaxonomy = await Effect.runPromise(getNakafaAgentTaxonomy());

    expect(taxonomy.default_locale).toBe("en");
    expect(defaultTaxonomy.locale).toBe("en");
    expect(taxonomy.content_counts).toStrictEqual([
      { count: 2, locale: "en" },
      { count: 1, locale: "id" },
    ]);
    expect(taxonomy.endpoints.recommended).toBe(
      NAKAFA_MCP_RECOMMENDED_ENDPOINT
    );
    expect(taxonomy.endpoints.direct).toBe(NAKAFA_MCP_DIRECT_ENDPOINT);
    expect(taxonomy.endpoints.root_note).toContain(
      NAKAFA_MCP_INFORMATIONAL_ROOT
    );
    expect(taxonomy.exercises.materials).toContainEqual({
      id: "quantitative-knowledge",
      label: "Quantitative Knowledge",
    });
    expect(taxonomy.tools).toStrictEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_exercise",
      "nakafa_get_quran_reference",
    ]);
  });

  it("builds taxonomy from known content counts without reading content files", async () => {
    const taxonomy = await Effect.runPromise(
      buildNakafaAgentTaxonomy({
        contentCounts: [{ count: 3, locale: "en" }],
      })
    );

    expect(taxonomy.content_counts).toStrictEqual([{ count: 3, locale: "en" }]);
    expect(taxonomy.locale).toBe("en");
  });

  it("fails with a typed read error when the taxonomy schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(decodeNakafaAgentTaxonomy({ locale: "en" }), {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });
});
