import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";
import {
  researchProviderConcurrency,
  type WebSearchOutput,
  webSearchMaxQueries,
} from "@repo/backend/confect/nina/research/schema";
import { formatWebSearchOutput } from "@repo/backend/confect/nina/research/search/format";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import {
  addSourceCitations,
  dedupeSources,
  readSearchSources,
} from "@repo/backend/confect/nina/research/search/source";
import { readTopPages } from "@repo/backend/confect/nina/research/tools/pages";
import { Array as Arr, Effect, HashMap, Option } from "effect";

/**
 * Searches the web and writes the web search UI data part. The model wrote the
 * queries, so each runs as written, and every result the provider returns with
 * an address is kept once, in the provider's order, web results first and then
 * news: no word of the tool call or the query decides which result a learner
 * sees. The words of the tool call only decide which paragraphs of a result
 * page are read. The sites of the call, when the model named any, restrict
 * every query alike, and the provider alone enforces that: no result is
 * checked against them here.
 */
export const searchWeb = Effect.fn("research.searchWeb")(function* ({
  queries,
  sites,
  words,
  toolCallId,
  publish,
}: {
  queries: readonly string[];
  sites?: readonly string[];
  words: string;
  toolCallId: string;
  publish: CapabilityProgress;
}) {
  const searchQueries = planSearchQueries({
    maxQueries: webSearchMaxQueries,
    queries,
  });
  // Every card of the call says which sites it was limited to, so results of
  // one site, or no result, read as what they are.
  const named = sites ?? [];
  const limited = Arr.isReadonlyArrayNonEmpty(named)
    ? { sites: [...named] }
    : {};

  yield* Effect.forEach(searchQueries, (query, index) =>
    publish({
      id: getWebSearchPartId(toolCallId, index),
      type: "data-web-search",
      data: {
        provider: "firecrawl",
        queries: [query],
        ...limited,
        status: "loading",
        sources: [],
      },
    })
  );

  const searched = yield* Effect.forEach(
    searchQueries,
    (query) =>
      searchFirecrawl(query, sites).pipe(
        Effect.map(({ response }) => ({
          error: undefined,
          sources: dedupeSources(readSearchSources(response)),
        })),
        Effect.catchTag("ResearchSearchError", (error) =>
          // The learner sees only the message; the log keeps the status.
          Effect.as(
            Effect.logWarning("Nina web search failed", {
              status: error.status,
            }),
            { error: error.message, sources: [] }
          )
        )
      ),
    { concurrency: researchProviderConcurrency }
  );
  const pages = yield* readTopPages(
    Arr.map(searched, (found) => found.sources),
    words
  );

  const searchResults = yield* Effect.forEach(searched, (found, index) =>
    Effect.gen(function* () {
      const query = Arr.getUnsafe(searchQueries, index);
      if (found.error !== undefined) {
        yield* publish({
          id: getWebSearchPartId(toolCallId, index),
          type: "data-web-search",
          data: {
            provider: "firecrawl",
            queries: [query],
            ...limited,
            status: "error",
            sources: [],
            error: found.error,
          },
        });
        return { error: found.error, sources: [] };
      }
      const sources = Arr.map(found.sources, (source) => ({
        ...source,
        content: Option.getOrElse(
          HashMap.get(pages, source.url),
          () => source.content
        ),
      }));
      yield* publish({
        id: getWebSearchPartId(toolCallId, index),
        type: "data-web-search",
        data: {
          provider: "firecrawl",
          queries: [query],
          ...limited,
          status: "done",
          sources: addSourceCitations(sources),
        },
      });
      return { error: undefined, sources };
    })
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
