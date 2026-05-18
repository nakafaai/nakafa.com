import type {
  Document,
  SearchResultNews,
  SearchResultWeb,
} from "@mendable/firecrawl-js";
import {
  firstText,
  getDocumentMetadata,
} from "@repo/ai/agents/research/tools/metadata";
import type { firecrawlApp } from "@repo/ai/config/firecrawl";
import { extractDomain } from "@repo/ai/lib/domain";
import { selectRelevantContent } from "@repo/ai/lib/selection";

export type SearchSource = ReturnType<typeof getSearchSource>;

/** Reads web and news results for one query. */
export function readSearchSources({
  query,
  response,
}: {
  query: string;
  response: Awaited<ReturnType<typeof firecrawlApp.search>>;
}) {
  const web =
    response.web?.map((result) => getSearchSource({ query, result })) || [];
  const webUrls = new Set(web.map((item) => item.url).filter(Boolean));
  const news =
    response.news?.flatMap((result) => {
      const source = getSearchSource({ query, result });

      if (!source.url || webUrls.has(source.url)) {
        return [];
      }

      return [source];
    }) || [];

  return [...web, ...news];
}

/** Keeps one source per URL across query variants. */
export function dedupeSources(sources: SearchSource[]) {
  const seen = new Set<string>();

  return sources.flatMap((source) => {
    if (!source.url || seen.has(source.url)) {
      return [];
    }

    seen.add(source.url);
    return [source];
  });
}

/** Adds markdown citations to sources with usable URLs. */
export function addSourceCitations(sources: SearchSource[]) {
  return sources
    .filter((source) => source.url)
    .map((source) => {
      const domain = extractDomain(source.url);

      return {
        ...source,
        citation: `[${domain}](${source.url})`,
      };
    });
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
