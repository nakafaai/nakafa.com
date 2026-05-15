import {
  type WebSearchOutput,
  webSearchMaxQueries,
} from "@repo/ai/agents/research/schema";
import { formatWebSearchOutput } from "@repo/ai/agents/research/search/format";
import { getSearchQueries } from "@repo/ai/agents/research/search/plan";
import { searchFirecrawl } from "@repo/ai/agents/research/search/provider";
import { scopeSources } from "@repo/ai/agents/research/search/scope";
import {
  addSourceCitations,
  dedupeSources,
  readSearchSources,
} from "@repo/ai/agents/research/search/source";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";

/**
 * Searches the web and writes the web search UI data part.
 */
export const searchWeb = Effect.fn("research.searchWeb")(function* ({
  queries,
  intent = "",
  toolCallId,
  writer,
}: {
  queries: readonly string[];
  intent?: string;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const searchQueries = getSearchQueries({ queries, intent });

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-web-search",
      data: { queries: searchQueries, status: "loading", sources: [] },
    })
  );

  const searchResults = yield* Effect.forEach(
    searchQueries,
    (query) => Effect.either(searchFirecrawl(query)),
    { concurrency: webSearchMaxQueries }
  );
  const successfulResults = searchResults.flatMap((result) => {
    if (Either.isLeft(result)) {
      return [];
    }

    return [result.right];
  });
  const failedResults = searchResults.flatMap((result) => {
    if (Either.isRight(result)) {
      return [];
    }

    return [result.left.message];
  });

  if (successfulResults.length === 0 && failedResults.length > 0) {
    const error = failedResults.join("\n");

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-web-search",
        data: {
          queries: searchQueries,
          status: "error",
          sources: [],
          error,
        },
      })
    );

    const output = {
      sources: [],
      error,
    } satisfies WebSearchOutput;

    return {
      result: output,
      text: formatWebSearchOutput(output),
    };
  }

  const sources = addSourceCitations(
    dedupeSources(
      successfulResults.flatMap(({ query, response }) =>
        scopeSources({
          intent,
          query,
          sources: readSearchSources({ query, response }),
        })
      )
    )
  );

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-web-search",
      data: {
        queries: searchQueries,
        status: "done",
        sources,
      },
    })
  );

  const output = {
    sources,
    error: undefined,
  } satisfies WebSearchOutput;

  return {
    result: output,
    text: formatWebSearchOutput(output),
  };
});
