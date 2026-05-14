import type {
  Document,
  SearchResultNews,
  SearchResultWeb,
} from "@mendable/firecrawl-js";
import {
  ResearchSearchError,
  type WebSearchOutput,
} from "@repo/ai/agents/research/schema";
import {
  firstText,
  getDocumentMetadata,
} from "@repo/ai/agents/research/tools/metadata";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { extractDomain } from "@repo/ai/lib/domain";
import { selectRelevantContent } from "@repo/ai/lib/selection";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
import { Effect } from "effect";

/**
 * Searches the web and writes the web search UI data part.
 */
export const searchWeb = Effect.fn("research.searchWeb")(function* ({
  query,
  toolCallId,
  writer,
}: {
  query: string;
  toolCallId: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-web-search",
      data: { query, status: "loading", sources: [] },
    })
  );

  const searchResult = yield* Effect.tryPromise({
    try: () =>
      firecrawlApp.search(query, {
        limit: 5,
        sources: ["web", "news"],
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          parsers: [],
        },
        timeout: 10_000,
      }),
    catch: (error) =>
      new ResearchSearchError({ message: `Failed to search: ${error}` }),
  }).pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (response) => ({ response }),
    })
  );

  if ("error" in searchResult) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-web-search",
        data: {
          query,
          status: "error",
          sources: [],
          error: searchResult.error,
        },
      })
    );

    const output = {
      sources: [],
      error: searchResult.error,
    } satisfies WebSearchOutput;

    return {
      result: output,
      text: formatOutput({ output }),
    };
  }

  const web =
    searchResult.response.web?.map((result) =>
      getSearchSource({ query, result })
    ) || [];

  const webUrls = new Set(web.map((item) => item.url).filter(Boolean));
  const news =
    searchResult.response.news?.flatMap((result) => {
      const source = getSearchSource({ query, result });

      if (!source.url || webUrls.has(source.url)) {
        return [];
      }

      return [source];
    }) || [];

  const sources = [...web, ...news];
  const sourcesWithCitation = sources
    .filter((source) => source.url)
    .map((source) => {
      const domain = extractDomain(source.url);
      return {
        ...source,
        citation: `[${domain}](${source.url})`,
      };
    });

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-web-search",
      data: { query, status: "done", sources: sourcesWithCitation },
    })
  );

  const output = {
    sources: sourcesWithCitation,
    error: undefined,
  } satisfies WebSearchOutput;

  return {
    result: output,
    text: formatOutput({ output }),
  };
});

/**
 * Formats web search output as markdown for the research agent.
 */
function formatOutput({ output }: { output: WebSearchOutput }) {
  if (output.sources.length === 0) {
    return dedent(`
      # Web Search Results
      ${output.error ? `- Error: ${output.error}` : "- No usable source URLs or page content were returned."}

      Do not cite or describe source evidence from this result.
    `);
  }

  return dedent(`
    # Web Search Results

    ${output.sources
      .map(
        (source, index) => `
    ## Source ${index + 1}: ${source.title}
    - URL: ${source.url}
    - Citation: ${source.citation}
    - Description: ${source.description}

    ### Content
    ${source.content}`
      )
      .join("\n\n")}
  `);
}

/** Keeps Firecrawl search metadata when a scraped Document is returned. */
function getSearchSource({
  query,
  result,
}: {
  query: string;
  result: Document | SearchResultNews | SearchResultWeb;
}) {
  const metadata = "metadata" in result ? result.metadata : undefined;
  const sourceMetadata = getDocumentMetadata({
    description: getSearchDescription(result),
    metadata,
    title: "title" in result ? result.title : undefined,
  });
  const url = firstText(
    "url" in result ? result.url : undefined,
    metadata?.sourceURL,
    metadata?.url,
    metadata?.ogUrl
  );

  return {
    content: selectRelevantContent({
      content: "markdown" in result ? result.markdown || "" : "",
      query,
      preserveStructure: false,
    }),
    description: sourceMetadata.description ?? "",
    title: sourceMetadata.title ?? "",
    url: url ?? "",
  };
}

/** Reads description text from either search snippets or document metadata. */
function getSearchDescription(
  result: Document | SearchResultNews | SearchResultWeb
) {
  if ("description" in result && result.description) {
    return result.description;
  }

  if ("snippet" in result && result.snippet) {
    return result.snippet;
  }

  return;
}
