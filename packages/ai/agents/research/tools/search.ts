import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/selection";
import { extractDomain } from "@repo/ai/lib/utils";
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
    catch: (error) => new Error(`Failed to search: ${error}`),
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

    return formatOutput({
      output: { sources: [], error: searchResult.error },
    });
  }

  const web =
    searchResult.response.web?.map((result) => {
      const title = ("title" in result ? result.title : "") || "";
      const description =
        ("description" in result ? result.description : "") || "";
      const url = ("url" in result ? result.url : "") || "";

      const processedContent = selectRelevantContent({
        content: ("markdown" in result ? result.markdown : "") || "",
        query,
        preserveStructure: false,
      });

      return {
        title,
        description,
        url,
        content: processedContent,
      };
    }) || [];

  const webUrls = new Set(web.map((item) => item.url).filter(Boolean));
  const news =
    searchResult.response.news
      ?.filter((result) => {
        const url = ("url" in result ? result.url : "") || "";
        return url && !webUrls.has(url);
      })
      .map((result) => {
        const title = ("title" in result ? result.title : "") || "";
        const description = ("snippet" in result ? result.snippet : "") || "";
        const url = ("url" in result ? result.url : "") || "";

        const processedContent = selectRelevantContent({
          content: ("markdown" in result ? result.markdown : "") || "",
          query,
          preserveStructure: false,
        });

        return {
          title,
          description,
          url,
          content: processedContent,
        };
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

  return formatOutput({
    output: { sources: sourcesWithCitation, error: undefined },
  });
});

/**
 * Formats web search output as markdown for the research agent.
 */
function formatOutput({ output }: { output: WebSearchOutput }) {
  return dedent(`
    # Web Search Results
    ${output.error ? `- Error: ${output.error}` : ""}

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
