import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import { cleanSlug } from "@repo/utilities/helper";

const WHITESPACE_PATTERN = /\s+/g;
const MDX_MODULE_LINE_PATTERN = /^\s*(?:import|export)\s.+$/gm;
const MARKDOWN_LINK_PATTERN = /(^|[^!])\[([^\]]+)\]\([^)]+\)/g;

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
    markdown_url: `${NAKAFA_CONTENT_BASE_URL}/${contentId}.md`,
    route: cleanRoute,
    section,
    url: `${NAKAFA_CONTENT_BASE_URL}/${contentId}`,
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
    .map(cleanContentSearchText)
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

/** Removes MDX module syntax and link targets from displayable search text. */
function cleanContentSearchText(part: string | undefined) {
  if (!part) {
    return "";
  }

  return part
    .replace(MDX_MODULE_LINE_PATTERN, "")
    .replace(MARKDOWN_LINK_PATTERN, "$1$2")
    .trim();
}

/** Converts source content into the derived content search document payload. */
export function buildContentSearchDocument(source: ContentSearchSource) {
  const ref = buildContentSearchRef(source);
  const description = source.description ?? "";
  const text = getContentSearchText([source.title, description, source.text]);

  return {
    ...ref,
    contentHash: source.contentHash,
    description,
    syncedAt: source.syncedAt,
    text,
    title: source.title,
  };
}
