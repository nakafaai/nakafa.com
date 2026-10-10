import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";
import {
  type WebSearchInput,
  type WebSearchOutput,
  webSearchMaxQueries,
} from "@repo/backend/confect/nina/research/schema";
import { formatWebSearchOutput } from "@repo/backend/confect/nina/research/search/format";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { scopeSources } from "@repo/backend/confect/nina/research/search/scope";
import {
  addSourceCitations,
  dedupeSources,
  readSearchSources,
} from "@repo/backend/confect/nina/research/search/source";
import { Array as Arr, Effect } from "effect";

/**
 * Searches the web and writes the web search UI data part.
 */
export const searchWeb = Effect.fn("research.searchWeb")(function* ({
  queries,
  sourcePreference,
  task,
  toolCallId,
  publish,
}: {
  queries: readonly string[];
  sourcePreference: WebSearchInput["sourcePreference"];
  task: string;
  toolCallId: string;
  publish: CapabilityProgress;
}) {
  const searchQueries = planSearchQueries({
    task,
    maxQueries: webSearchMaxQueries,
    queries,
    scopeByNamedPhrases: true,
  });

  yield* Effect.forEach(searchQueries, (query, index) =>
    publish({
      id: getWebSearchPartId(toolCallId, index),
      type: "data-web-search",
      data: {
        provider: "firecrawl",
        queries: [query],
        status: "loading",
        sources: [],
      },
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
          publish({
            id: getWebSearchPartId(toolCallId, index),
            type: "data-web-search",
            data: {
              provider: "firecrawl",
              queries: [query],
              status: "done",
              sources: addSourceCitations(sources),
            },
          })
        ),
        Effect.catchTag("ResearchSearchError", (error) =>
          Effect.gen(function* () {
            // The learner sees only the message; the log keeps the reason.
            yield* Effect.logWarning("Nina web search failed", {
              cause: error.cause,
              message: error.message,
            });
            yield* publish({
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
  const failedResults = Arr.flatMap(searchResults, (result) => {
    if (!result.error) {
      return [];
    }

    return [result.error];
  });

  if (
    searchQueries.length > 0 &&
    failedResults.length === searchQueries.length
  ) {
    const error = Arr.join(failedResults, "\n");

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
    dedupeSources(Arr.flatMap(searchResults, (result) => result.sources))
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
