import { formatSearch } from "@repo/backend/confect/nina/nakafa/format";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/agent/schema/search";
import { Array as Arr, HashSet, Order } from "effect";

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
  return Arr.dedupe(
    Arr.flatMap(queries, (query) =>
      Arr.map(
        Array.from(query.toLocaleLowerCase().matchAll(searchTokenPattern)),
        ([token]) => token
      )
    )
  );
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

  return Arr.join(
    [
      "# Nakafa Search Query",
      ...Arr.map(queries, (query) => `- Query: "${query}"`),
      "",
      formatSearch(result),
    ],
    "\n"
  );
}

/** Applies query relevance while preserving stable equal-score order. */
function rankSearchItems(
  items: NakafaAgentSearchResult["items"],
  tokens: string[]
) {
  if (tokens.length === 0) {
    return items;
  }

  return Arr.sortWith(
    items,
    (item) => getSearchScore(item, tokens),
    Order.flip(Order.Number)
  );
}

/** Scores searchable metadata by exact normalized query-token matches. */
function getSearchScore(
  item: NakafaAgentSearchResult["items"][number],
  tokens: string[]
) {
  const searchableTokens = HashSet.fromIterable(
    getSearchTokens([
      item.title,
      item.description,
      item.route.replaceAll(routeSeparatorPattern, " "),
    ])
  );

  return Arr.reduce(tokens, 0, (score, token) => {
    if (HashSet.has(searchableTokens, token)) {
      return score + 1;
    }

    return score;
  });
}
