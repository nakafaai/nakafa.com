import {
  formatSearchGroup,
  getSearchTokens,
  rankSearchResult,
} from "@repo/ai/agents/nakafa/tools/search-result";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  type NakafaAgentSearchResult,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Builds one schema-decoded search result for ranking tests. */
function searchResult(
  items: NakafaAgentSearchResult["items"],
  options: {
    readonly hasMore?: boolean;
    readonly limit?: number;
    readonly offset?: number;
  } = {}
) {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;

  return Schema.decodeSync(NakafaAgentSearchResultSchema)({
    count: items.length,
    has_more: options.hasMore ?? false,
    items,
    limit,
    ...(options.hasMore ? { next_offset: offset + items.length } : {}),
    offset,
  });
}

/** Builds one graph-backed article result with searchable metadata. */
function searchItem(
  slug: string,
  title: string,
  description = `${title} description`
) {
  return {
    ...readNakafaContentRefFixture(
      "en",
      `articles/politics/${slug}`,
      "articles"
    ),
    description,
    excerpt: description,
    title,
  };
}

describe("Nakafa search results", () => {
  it("normalizes and deduplicates model-provided query tokens", () => {
    expect(getSearchTokens(["Alpha, BETA", "alpha_2027"])).toEqual([
      "alpha",
      "beta",
      "2027",
    ]);
    expect(getSearchTokens(["!!!"])).toEqual([]);
  });

  it("ranks visible metadata while preserving equal-score order", () => {
    const first = searchItem("general", "General", "Shared token");
    const exact = searchItem(
      "quantitative-knowledge",
      "Quantitative Knowledge",
      "Shared token"
    );
    const tie = searchItem("quantitative-practice", "Quantitative Practice");
    const result = searchResult([first, exact, tie]);

    expect(
      rankSearchResult(result, ["quantitative"]).items.map((item) => item.title)
    ).toEqual(["Quantitative Knowledge", "Quantitative Practice", "General"]);
    expect(rankSearchResult(result, []).items).toBe(result.items);
  });

  it("formats scoped and unscoped search evidence", () => {
    const result = searchResult([]);

    expect(formatSearchGroup({}, result)).toContain("# Nakafa Search");
    expect(formatSearchGroup({ queries: ["alpha", "beta"] }, result)).toContain(
      '- Query: "beta"'
    );
  });
});
