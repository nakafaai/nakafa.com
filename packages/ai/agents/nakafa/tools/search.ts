import { formatSearch } from "@repo/ai/agents/nakafa/format";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;
type SearchInput = ReturnType<typeof getSearchInput>;

interface Params {
  input: NakafaAgentSearchInput;
  locale: Locale;
  toolCallId: string;
  writer: Writer;
}

/** Searches Nakafa content and writes a bounded `data-nakafa` UI part. */
export const search = Effect.fn("nakafa.search")(function* ({
  input,
  locale,
  toolCallId,
  writer,
}: Params) {
  const dataInput = getSearchInput(input, locale);
  const searchInputs = getSearchInputs(dataInput);

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
    Effect.either(nakafaSearch.search(searchInput)).pipe(
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
    successfulResults.map(({ result }) => result)
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
  results: NakafaAgentSearchResult[]
) {
  if (results.length === 1) {
    return results[0];
  }

  const ranked = interleaveSearchItems(results.map((result) => result.items));
  const items = ranked.slice(0, input.limit);
  const nextOffset = input.offset + items.length;
  const hasMore =
    ranked.length > items.length || results.some((result) => result.has_more);

  return {
    count: items.length,
    has_more: hasMore,
    items,
    limit: input.limit,
    next_offset: hasMore ? nextOffset : null,
    offset: input.offset,
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
    ...queries.map((query) => `- Query: ${query}`),
    "",
    formatSearch(result),
  ].join("\n");
}
