import type FirecrawlApp from "@mendable/firecrawl-js";
import type {
  Document,
  SearchResultNews,
  SearchResultWeb,
} from "@mendable/firecrawl-js";
import { extractDomain } from "@repo/backend/confect/nina/research/domain";
import {
  firstText,
  getDocumentMetadata,
} from "@repo/backend/confect/nina/research/tools/metadata";
import { Array as Arr, HashSet, MutableHashSet, pipe } from "effect";

export type SearchSource = ReturnType<typeof getSearchSource>;

/** Reads the web and news results of one search: titles, descriptions and addresses. */
export function readSearchSources(
  response: Awaited<ReturnType<FirecrawlApp["search"]>>
) {
  const web = Arr.map(response.web ?? [], getSearchSource);
  const webUrls = HashSet.fromIterable(
    pipe(
      web,
      Arr.map((item) => item.url),
      Arr.filter(Boolean)
    )
  );
  const news = Arr.flatMap(response.news ?? [], (result) => {
    const source = getSearchSource(result);

    if (!source.url || HashSet.has(webUrls, source.url)) {
      return [];
    }

    return [source];
  });

  return [...web, ...news];
}

/** Keeps one source per URL across query variants. */
export function dedupeSources(sources: SearchSource[]) {
  const seen = MutableHashSet.empty<string>();

  return Arr.flatMap(sources, (source) => {
    if (!source.url || MutableHashSet.has(seen, source.url)) {
      return [];
    }

    MutableHashSet.add(seen, source.url);
    return [source];
  });
}

/** Adds markdown citations to sources with usable URLs. */
export function addSourceCitations(sources: SearchSource[]) {
  return pipe(
    sources,
    Arr.filter((source) => Boolean(source.url)),
    Arr.map((source) => {
      const domain = extractDomain(source.url);

      return {
        ...source,
        citation: `[${domain}](${source.url})`,
      };
    })
  );
}

/** Reads one result, with the page metadata when the provider returns a document. */
function getSearchSource(
  result: Document | SearchResultNews | SearchResultWeb
) {
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
    // A search result carries no page text. `searchWeb` reads the best pages
    // and fills this in for each page it could read.
    content: "",
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
}
