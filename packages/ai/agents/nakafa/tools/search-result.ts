import { formatSearch } from "@repo/ai/agents/nakafa/format";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";

type SearchResultInput = Pick<
  NakafaAgentSearchInput,
  "limit" | "offset" | "queries"
>;

const searchTokenPattern = /[\p{L}\p{N}]+/gu;
const routeSeparatorPattern = /[/_-]+/gu;

/** Builds the bounded aggregate consumed by Nakafa follow-up routing. */
export function combineSearchResults(
  input: SearchResultInput,
  results: NakafaAgentSearchResult[],
  queryTokens: string[]
) {
  if (results.length === 1) {
    return results[0];
  }

  const ranked = rankSearchItems(
    interleaveSearchItems(results.map((result) => result.items)),
    queryTokens
  );
  const items = ranked.slice(0, input.limit);
  const nextOffset = input.offset + items.length;
  const hasMore =
    ranked.length > items.length || results.some((result) => result.has_more);
  const result = {
    count: items.length,
    has_more: hasMore,
    items,
    limit: input.limit,
    offset: input.offset,
  };

  if (!hasMore) {
    return result;
  }

  return {
    ...result,
    next_offset: nextOffset,
  };
}

/** Applies query relevance before the UI and agent consume search evidence. */
export function rankSearchResult(
  result: NakafaAgentSearchResult,
  tokens: string[]
) {
  return {
    ...result,
    items: rankSearchItems(result.items, tokens),
  };
}

/** Tokenizes model-provided search text without language-specific rules. */
export function getSearchTokens(queries: string[]) {
  return [
    ...new Set(
      queries.flatMap((query) =>
        Array.from(query.toLocaleLowerCase().matchAll(searchTokenPattern)).map(
          ([token]) => token
        )
      )
    ),
  ];
}

/** Adds query context to markdown returned to the Nakafa sub-agent. */
export function formatSearchGroup(
  input: Pick<SearchResultInput, "queries">,
  result: NakafaAgentSearchResult
) {
  const queries = input.queries ?? [];

  if (queries.length === 0) {
    return formatSearch(result);
  }

  return [
    "# Nakafa Search Query",
    ...queries.map((query) => `- Query: "${query}"`),
    "",
    formatSearch(result),
  ].join("\n");
}

/** Merges query-specific pages without letting one query dominate. */
function interleaveSearchItems(groups: NakafaAgentSearchResult["items"][]) {
  const ranked: NakafaAgentSearchResult["items"] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((items) => items.length));

  for (let index = 0; index < maxLength; index++) {
    for (const items of groups) {
      const item = items[index];

      if (!item || seen.has(item.content_id)) {
        continue;
      }

      ranked.push(item);
      seen.add(item.content_id);
    }
  }

  return ranked;
}

/** Applies query relevance after search and multi-query merging. */
function rankSearchItems(
  items: NakafaAgentSearchResult["items"],
  tokens: string[]
) {
  if (tokens.length === 0) {
    return items;
  }

  return [...items].sort((left, right) => {
    const scoreDelta =
      getSearchScore(right, tokens) - getSearchScore(left, tokens);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return 0;
  });
}

/** Scores searchable metadata by exact normalized query-token matches. */
function getSearchScore(
  item: NakafaAgentSearchResult["items"][number],
  tokens: string[]
) {
  const searchableTokens = new Set(
    getSearchTokens([
      item.title,
      item.description,
      item.route.replaceAll(routeSeparatorPattern, " "),
    ])
  );

  return tokens.reduce((score, token) => {
    if (searchableTokens.has(token)) {
      return score + 1;
    }

    return score;
  }, 0);
}
