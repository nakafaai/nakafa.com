import { formatSearch } from "@repo/ai/agents/nakafa/format";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";

type SearchResultInput = Pick<NakafaAgentSearchInput, "queries">;

const searchTokenPattern = /[\p{L}\p{N}]+/gu;
const routeSeparatorPattern = /[/_-]+/gu;

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

/** Applies query relevance while preserving stable equal-score order. */
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
