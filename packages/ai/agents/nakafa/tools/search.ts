import { formatSearch } from "@repo/ai/agents/nakafa/format";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import { isPracticeQuestionPath } from "@repo/contents/_types/route/practice/path";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;
type SearchInput = ReturnType<typeof getSearchInput>;

const searchTokenPattern = /[\p{L}\p{N}]+/gu;
const routeSeparatorPattern = /[/_-]+/gu;

/** Searches Nakafa content and writes a bounded `data-nakafa` UI part. */
export const search = Effect.fn("nakafa.search")(function* ({
  input,
  locale,
  toolCallId,
  writer,
}: {
  readonly input: NakafaAgentSearchInput;
  readonly locale: Locale;
  readonly toolCallId: string;
  readonly writer: Writer;
}) {
  const dataInput = getSearchInput(input, locale);
  const searchInputs = getSearchInputs(dataInput);
  const queryTokens = getSearchTokens(dataInput.queries ?? []);

  yield* Effect.sync(() =>
    searchInputs.forEach((searchInput, index) => {
      writer.write({
        id: getNakafaSearchPartId(toolCallId, index),
        type: "data-nakafa",
        data: {
          kind: "search",
          input: searchInput,
          status: "loading",
        },
      });
    })
  );

  const nakafaSearch = yield* NakafaSearch;
  const results = yield* Effect.forEach(searchInputs, (searchInput, index) =>
    Effect.either(
      nakafaSearch
        .search(searchInput)
        .pipe(
          Effect.map((result) =>
            rankSearchResult(
              searchInput,
              result,
              getSearchTokens(searchInput.queries ?? [])
            )
          )
        )
    ).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          if (Either.isLeft(result)) {
            writer.write({
              id: getNakafaSearchPartId(toolCallId, index),
              type: "data-nakafa",
              data: {
                kind: "search",
                input: searchInput,
                status: "error",
                error: result.left.message,
              },
            });
            return;
          }

          writer.write({
            id: getNakafaSearchPartId(toolCallId, index),
            type: "data-nakafa",
            data: {
              kind: "search",
              input: searchInput,
              status: "done",
              result: result.right,
            },
          });
        })
      ),
      Effect.map((result) => ({
        input: searchInput,
        result,
      }))
    )
  );
  const successfulResults = results.flatMap(({ input, result }) => {
    if (Either.isLeft(result)) {
      return [];
    }

    return [{ input, result: result.right }];
  });
  const failedResults = results.flatMap(({ result }) => {
    if (Either.isRight(result)) {
      return [];
    }

    return [result.left.message];
  });

  if (successfulResults.length === 0 && failedResults.length > 0) {
    const error = failedResults.join("\n");

    return {
      result: null,
      text: error,
    };
  }

  const result = combineSearchResults(
    dataInput,
    successfulResults.map(({ result }) => result),
    queryTokens
  );
  const text = successfulResults
    .map(({ input, result }) => formatSearchGroup(input, result))
    .join("\n\n");

  return {
    result,
    text,
  };
});

/** Applies server-owned locale before calling the Convex-backed search adapter. */
function getSearchInput(input: NakafaAgentSearchInput, locale: Locale) {
  return {
    limit: input.limit,
    locale,
    offset: input.offset,
    ...(input.queries === undefined ? {} : { queries: input.queries }),
    ...(input.section === undefined ? {} : { section: input.section }),
  };
}

/** Splits alternate search text into query-scoped UI search runs. */
function getSearchInputs(input: SearchInput) {
  const queries = input.queries ?? [];

  if (queries.length === 0) {
    return [input];
  }

  return queries.map((query) => ({
    ...input,
    queries: [query],
  }));
}

/** Derives the stable UI data-part id for one Nakafa search run. */
function getNakafaSearchPartId(toolCallId: string, index: number) {
  return `${toolCallId}-${index + 1}`;
}

/** Builds the combined search result consumed by Nakafa follow-up routing. */
function combineSearchResults(
  input: SearchInput,
  results: NakafaAgentSearchResult[],
  queryTokens: string[]
) {
  if (results.length === 1) {
    return results[0];
  }

  const ranked = rankSearchItems(
    input,
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

/** Merges query-specific search pages without letting one query dominate. */
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

/** Applies query relevance before the UI and agent consume search evidence. */
function rankSearchResult(
  input: SearchInput,
  result: NakafaAgentSearchResult,
  tokens: string[]
) {
  return {
    ...result,
    items: rankSearchItems(input, result.items, tokens),
  };
}

/** Applies query relevance after search and multi-query merging. */
function rankSearchItems(
  input: SearchInput,
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

    if (input.section !== "material") {
      return 0;
    }

    return getExerciseSetPriority(right) - getExerciseSetPriority(left);
  });
}

/** Tokenizes model-provided search text without language-specific rules. */
function getSearchTokens(queries: string[]) {
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

/** Scores search evidence by metadata text that the UI and agent can inspect. */
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

/** Prefers set/material/category rows over question rows for equal matches. */
function getExerciseSetPriority(
  item: NakafaAgentSearchResult["items"][number]
) {
  if (isPracticeQuestionPath(item.route)) {
    return 0;
  }

  return 1;
}

/** Adds query context to the markdown returned to the Nakafa sub-agent. */
function formatSearchGroup(
  input: SearchInput,
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
