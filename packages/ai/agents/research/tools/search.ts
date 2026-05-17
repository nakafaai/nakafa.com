import {
  type WebSearchOutput,
  webSearchMaxQueries,
} from "@repo/ai/agents/research/schema";
import { formatWebSearchOutput } from "@repo/ai/agents/research/search/format";
import { searchFirecrawl } from "@repo/ai/agents/research/search/provider";
import { scopeSources } from "@repo/ai/agents/research/search/scope";
import {
  addSourceCitations,
  dedupeSources,
  readSearchSources,
} from "@repo/ai/agents/research/search/source";
import { planSearchQueries } from "@repo/ai/lib/search-query";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Searches the web and writes the web search UI data part.
 */
export const searchWeb = Effect.fn("research.searchWeb")(function* ({
  queries,
  sourcePreference,
  task,
  toolCallId,
  writer,
}: {
  queries: readonly string[];
  sourcePreference: "primary" | "any";
  task: string;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const searchQueries = planSearchQueries({
    task,
    maxQueries: webSearchMaxQueries,
    queries,
    scopeByNamedPhrases: true,
  });

  yield* Effect.sync(() =>
    searchQueries.forEach((query, index) => {
      writer.write({
        id: getWebSearchPartId(toolCallId, index),
        type: "data-web-search",
        data: {
          provider: "firecrawl",
          queries: [query],
          status: "loading",
          sources: [],
        },
      });
    })
  );

  const searchResults = yield* Effect.forEach(
    searchQueries,
    (query, index) =>
      searchFirecrawl(query).pipe(
        Effect.map(({ response }) => {
          const providerSources = dedupeSources(
            readSearchSources({ query, response })
          );
          const sources = dedupeSources(
            scopeSources({
              task,
              query,
              sourcePreference,
              sources: providerSources,
            })
          );

          return { error: undefined, providerSources, sources };
        }),
        Effect.tap(({ sources }) =>
          Effect.sync(() =>
            writer.write({
              id: getWebSearchPartId(toolCallId, index),
              type: "data-web-search",
              data: {
                provider: "firecrawl",
                queries: [query],
                status: "done",
                sources: addSourceCitations(sources),
              },
            })
          )
        ),
        Effect.catchTag("ResearchSearchError", (error) =>
          Effect.sync(() => {
            writer.write({
              id: getWebSearchPartId(toolCallId, index),
              type: "data-web-search",
              data: {
                provider: "firecrawl",
                queries: [query],
                status: "error",
                sources: [],
                error: error.message,
              },
            });

            return {
              error: error.message,
              sources: [],
            };
          })
        )
      ),
    { concurrency: webSearchMaxQueries }
  );
  const failedResults = searchResults.flatMap((result) => {
    if (!result.error) {
      return [];
    }

    return [result.error];
  });

  if (
    searchQueries.length > 0 &&
    failedResults.length === searchQueries.length
  ) {
    const error = failedResults.join("\n");

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
    dedupeSources(searchResults.flatMap((result) => result.sources))
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

/** Derives the stable UI data-part id for one executed web query. */
function getWebSearchPartId(toolCallId: string, index: number) {
  return `${toolCallId}-${index + 1}`;
}
