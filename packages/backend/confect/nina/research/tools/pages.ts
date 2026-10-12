import { researchProviderConcurrency } from "@repo/backend/confect/nina/research/schema";
import {
  dedupeSources,
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
 * Reads the best result pages in parallel and returns their selected text by
 * address: every query's first result, then every second one, until
 * `RESULT_PAGES` distinct pages. The words of the tool call choose the
 * paragraphs of a page that is longer than the budget. A page that is not read
 * in time is no failure: its source keeps the description the search returned.
 */
export const readTopPages = Effect.fn("research.readTopPages")(function* (
  results: readonly (readonly SearchSource[])[],
  words: string
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
                query: words,
              }),
            ] as const)
          : Option.none()
      ),
    { concurrency: researchProviderConcurrency }
  );
  return HashMap.fromIterable(Arr.getSomes(read));
});
