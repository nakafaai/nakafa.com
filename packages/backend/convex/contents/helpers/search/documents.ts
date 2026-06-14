import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { cleanSlug } from "@repo/utilities/helper";
import { type Infer, v } from "convex/values";

const WHITESPACE_PATTERN = /\s+/g;
const MDX_MODULE_LINE_PATTERN = /^\s*(?:import|export)\s.+$/gm;
const FENCE_START_PATTERN = /^\s*(?:```|~~~)/;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const MARKDOWN_LINK_PATTERN = /(^|[^!])\[([^\]]+)\]\([^)]+\)/g;

/** Convex validator for source rows used to build search documents. */
export const contentSearchSourceValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  contentHash: v.string(),
  description: v.optional(v.string()),
  locale: localeValidator,
  route: v.string(),
  section: nakafaSectionValidator,
  syncedAt: v.number(),
  text: v.string(),
  title: v.string(),
});

/** Search source row derived from the Convex validator. */
export type ContentSearchSource = Infer<typeof contentSearchSourceValidator>;

/**
 * Creates the stable public content reference stored in the search read model.
 *
 * Reference: Convex search indexes work over persisted document fields.
 * https://docs.convex.dev/search/text-search
 */
export function buildContentSearchRef({
  alignmentId,
  assetId,
  conceptId,
  learningObjectId,
  lensId,
  locale,
  route,
  section,
}: Pick<
  ContentSearchSource,
  | "alignmentId"
  | "assetId"
  | "conceptId"
  | "learningObjectId"
  | "lensId"
  | "locale"
  | "route"
  | "section"
>) {
  const cleanRoute = cleanSlug(route);
  const publicPath = `${locale}/${cleanRoute}`;

  return {
    alignmentId,
    assetId,
    conceptId,
    content_id: assetId,
    learningObjectId,
    lensId,
    locale,
    markdown_url: `${NAKAFA_CONTENT_BASE_URL}/${publicPath}.md`,
    route: cleanRoute,
    section,
    url: `${NAKAFA_CONTENT_BASE_URL}/${publicPath}`,
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

/** Removes MDX authoring syntax while preserving displayable prose text. */
function cleanContentSearchText(part: string | undefined) {
  if (!part) {
    return "";
  }

  return cleanContentSearchLines(part)
    .replace(MARKDOWN_LINK_PATTERN, "$1$2")
    .trim();
}

/** Converts authoring-only Markdown/MDX lines outside fenced code blocks. */
function cleanContentSearchLines(part: string) {
  let isInFence = false;
  const lines = part.split("\n");

  return lines
    .map((line) => {
      if (FENCE_START_PATTERN.test(line)) {
        isInFence = !isInFence;
        return "";
      }

      if (isInFence) {
        return line;
      }

      return line
        .replace(MDX_MODULE_LINE_PATTERN, "")
        .replace(MARKDOWN_HEADING_PATTERN, "$1");
    })
    .join("\n");
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
