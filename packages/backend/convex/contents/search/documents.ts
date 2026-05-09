import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import { cleanSlug } from "@repo/utilities/helper";
import { nakafaBaseUrl } from "@repo/utilities/nakafa";

const WHITESPACE_PATTERN = /\s+/g;

export interface ContentSearchSource {
  contentHash: string;
  description?: string;
  locale: Locale;
  route: string;
  section: NakafaSection;
  syncedAt: number;
  text: string;
  title: string;
}

/**
 * Creates the stable public content reference stored in the search read model.
 *
 * Reference: Convex search indexes work over persisted document fields.
 * https://docs.convex.dev/search/text-search
 */
export function buildContentSearchRef({
  locale,
  route,
  section,
}: Pick<ContentSearchSource, "locale" | "route" | "section">) {
  const cleanRoute = cleanSlug(route);
  const contentId = `${locale}/${cleanRoute}`;

  return {
    content_id: contentId,
    locale,
    markdown_url: `${nakafaBaseUrl}/${contentId}.md`,
    route: cleanRoute,
    section,
    url: `${nakafaBaseUrl}/${contentId}`,
  };
}

/**
 * Compacts source fields into the single string required by Convex full-text search.
 *
 * Reference: Convex `searchIndex` accepts one `searchField`.
 * https://docs.convex.dev/search/text-search
 */
export function getContentSearchText(parts: Array<string | undefined>) {
  return parts
    .filter((part) => part && part.trim().length > 0)
    .join(" ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

/** Converts source content into the derived content search document payload. */
export function buildContentSearchDocument(source: ContentSearchSource) {
  const ref = buildContentSearchRef(source);
  const description = source.description ?? "";
  const text = getContentSearchText([
    source.title,
    description,
    source.route,
    source.text,
  ]);

  return {
    ...ref,
    contentHash: source.contentHash,
    description,
    syncedAt: source.syncedAt,
    text,
    title: source.title,
  };
}
