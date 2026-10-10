import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";
import {
  researchProviderConcurrency,
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
  type SearchSource,
} from "@repo/backend/confect/nina/research/search/source";
import { selectRelevantContent } from "@repo/backend/confect/nina/research/selection";
import { readPage } from "@repo/backend/confect/nina/research/tools/scrape";
import { Array as Arr, Effect, HashMap, identity, Option } from "effect";

/**
 * Result pages one search reads. Measured on 10 October 2026, the search
 * provider plan reads two pages at a time and about ten a minute, and a single
 * read takes 0.9 to 5.7 seconds. A page the provider refuses is no failure.
 */
const RESULT_PAGES = 2;
/**
 * A result page is extra evidence, so its read gets a short limit: the search
 * returned every result's description already.
 */
const RESULT_PAGE = { deadlineMs: 10_000, timeoutMs: 8000 };

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

  const searched = yield* Effect.forEach(
    searchQueries,
    (query) =>
      searchFirecrawl(query).pipe(
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
    task
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
            status: "error",
            sources: [],
            error: found.error,
          },
        });
        return { error: found.error, sources: [] };
      }
      const sources = dedupeSources(
        scopeSources({
          task,
          query,
          sourcePreference,
          sources: Arr.map(found.sources, (source) => ({
            ...source,
            content: Option.getOrElse(
              HashMap.get(pages, source.url),
              () => source.content
            ),
          })),
        })
      );
      yield* publish({
        id: getWebSearchPartId(toolCallId, index),
        type: "data-web-search",
        data: {
          provider: "firecrawl",
          queries: [query],
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

/**
 * Reads the best result pages in parallel and returns their selected text by
 * address: every query's first result, then every second one, until
 * `RESULT_PAGES` distinct pages. A page that is not read in time is no failure:
 * its source keeps the description the search returned.
 */
const readTopPages = Effect.fn("research.readTopPages")(function* (
  results: readonly (readonly SearchSource[])[],
  task: string
) {
  const depth = Arr.reduce(results, 0, (deepest, sources) =>
    Math.max(deepest, sources.length)
  );
  const ranked = Arr.flatMap(Arr.makeBy(depth, identity), (rank) =>
    Arr.flatMap(results, (sources) => Arr.fromNullishOr(sources[rank]))
  );
  const read = yield* Effect.forEach(
    Arr.take(dedupeSources(ranked), RESULT_PAGES),
    (source) =>
      Effect.map(readPage(source.url, RESULT_PAGE), (page) =>
        "markdown" in page
          ? Option.some([
              source.url,
              selectRelevantContent({
                content: page.markdown,
                preserveStructure: false,
                query: task,
              }),
            ] as const)
          : Option.none()
      ),
    { concurrency: researchProviderConcurrency }
  );
  return HashMap.fromIterable(Arr.getSomes(read));
});

/** Derives the stable UI data-part id for one executed web query. */
function getWebSearchPartId(toolCallId: string, index: number) {
  return `${toolCallId}-${index + 1}`;
}
