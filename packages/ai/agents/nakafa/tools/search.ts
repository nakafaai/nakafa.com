import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import {
  combineSearchResults,
  formatSearchGroup,
  getSearchTokens,
  rankSearchResult,
} from "@repo/ai/agents/nakafa/tools/search-result";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { NakafaAgentSearchInput } from "@repo/contents/_lib/agent/schema/search";
import type { Locale } from "@repo/contents/_types/content";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

type Writer = Pick<UIMessageStreamWriter<MyUIMessage>, "write">;
type SearchInput = ReturnType<typeof getSearchInput>;

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
            rankSearchResult(result, getSearchTokens(searchInput.queries ?? []))
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
