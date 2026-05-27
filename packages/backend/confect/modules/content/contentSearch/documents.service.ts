import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/confect/modules/content/constants";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/confect/modules/content/content.schemas";
import { cleanSlug } from "@repo/utilities/helper";

const WHITESPACE_PATTERN = /\s+/g;

/** Builds the stable public identifiers persisted in the content search table. */
export function buildContentSearchRef(args: {
  locale: Locale;
  route: string;
  section: NakafaSection;
}) {
  const cleanRoute = cleanSlug(args.route);
  const contentId = `${args.locale}/${cleanRoute}`;

  return {
    content_id: contentId,
    locale: args.locale,
    markdown_url: `${NAKAFA_CONTENT_BASE_URL}/${contentId}.md`,
    route: cleanRoute,
    section: args.section,
    url: `${NAKAFA_CONTENT_BASE_URL}/${contentId}`,
  };
}

/** Normalizes searchable text while preserving source order. */
function getContentSearchText(parts: readonly (string | undefined)[]) {
  return parts
    .filter((part) => part && part.trim().length > 0)
    .join(" ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

/** Builds a complete content search row from a sync source. */
export function buildContentSearchDocument(source: {
  contentHash: string;
  description?: string;
  locale: Locale;
  route: string;
  section: NakafaSection;
  syncedAt: number;
  text: string;
  title: string;
}) {
  const ref = buildContentSearchRef(source);
  const description = source.description ?? "";

  return {
    ...ref,
    contentHash: source.contentHash,
    description,
    syncedAt: source.syncedAt,
    text: getContentSearchText([
      source.title,
      description,
      source.route,
      source.text,
    ]),
    title: source.title,
  };
}

/** Returns true when a search row already matches the next document. */
export function isSameContentSearch(
  existing: Doc<"contentSearch"> | null,
  next: ReturnType<typeof buildContentSearchDocument>
) {
  if (!existing) {
    return false;
  }

  return (
    existing.contentHash === next.contentHash &&
    existing.description === next.description &&
    existing.markdown_url === next.markdown_url &&
    existing.route === next.route &&
    existing.section === next.section &&
    existing.text === next.text &&
    existing.title === next.title &&
    existing.url === next.url
  );
}
