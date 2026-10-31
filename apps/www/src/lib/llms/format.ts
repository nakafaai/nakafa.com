import { CONTENT_LICENSE_NAME, CONTENT_LICENSE_URL } from "@repo/seo/license";
import { LLMS_TEXT_PATH } from "@repo/site/discovery";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Option, pipe, Schema, String as Str } from "effect";
import {
  BASE_URL,
  ENGLISH_LANGUAGE_NAMES,
  MARKDOWN_EXTENSIONS,
} from "@/lib/llms/constants";

/** Canonical discovery directive shown near the top of agent-facing markdown. */
export const AGENT_MARKDOWN_DIRECTIVE = `> For AI agents: use [llms.txt](${BASE_URL}${LLMS_TEXT_PATH}) for the site index. Markdown versions are available by appending \`.md\` to content URLs.`;

/**
 * Builds the same-origin Markdown route for one localized content path.
 *
 * Callers pass the published `publicPath`, which carries no leading slash, so
 * the path is normalized before it is joined with the locale segment.
 */
export function getLlmsMarkdownPath({
  locale,
  publicPath,
}: {
  readonly locale: string;
  readonly publicPath: string;
}) {
  return `/${locale}/${cleanSlug(publicPath.trim())}.md`;
}

/** The authors and dates of a page, which a citation of it names. */
const MarkdownCitationSchema = Schema.Struct({
  authors: Schema.Array(Schema.String),
  dateModified: Schema.optional(Schema.String),
  datePublished: Schema.String,
});
export type MarkdownCitation = typeof MarkdownCitationSchema.Type;

/** The lines that tell an answer service whose page it read and how to cite it. */
function citationLines(citation: MarkdownCitation, title: string, url: string) {
  const authors = Arr.join(citation.authors, ", ");
  return [
    `Author: ${authors}`,
    `Published: ${citation.datePublished}`,
    ...(citation.dateModified ? [`Updated: ${citation.dateModified}`] : []),
    `License: ${CONTENT_LICENSE_NAME} (${CONTENT_LICENSE_URL})`,
    `Cite as: ${authors}, "${title}", Nakafa, ${url}`,
  ];
}

/** Builds the common markdown header used by page-level llms output. */
export function buildHeader({
  citation,
  description,
  source,
  title,
  url,
}: {
  citation?: MarkdownCitation;
  description: string;
  source?: string;
  title: string;
  url: string;
}) {
  return [
    `# ${title}`,
    "",
    AGENT_MARKDOWN_DIRECTIVE,
    "",
    `URL: ${url}`,
    ...(source ? [`Source: ${source}`] : []),
    ...(citation ? citationLines(citation, title, url) : []),
    "",
    description,
    "",
    "---",
    "",
  ];
}

/** The Markdown that opens a heading of the first level. */
const TITLE_MARKER = /^# /u;

/** The title that a Markdown twin opens with, which `buildHeader` writes on its first line. */
export function readTwinTitle(text: string) {
  return Str.replace(TITLE_MARKER, "")(Arr.headNonEmpty(Str.split(text, "\n")));
}

/** Returns one stable agent-facing description from authored MDX metadata. */
export function getMdxDescription(metadata: {
  readonly description?: string | undefined;
  readonly subject?: string | undefined;
}) {
  return (
    metadata.description ??
    metadata.subject ??
    "Output docs content for large language models."
  );
}

/** Removes markdown-style route suffixes before content lookup. */
export function stripLlmsRouteExtension(slug: string) {
  return slug.replace(MARKDOWN_EXTENSIONS, "");
}

/** Formats a locale code as an English language name for agent-facing indexes. */
export function getLocaleLabel(locale: string) {
  return ENGLISH_LANGUAGE_NAMES.of(locale) ?? locale;
}

/** Builds a human-readable fallback title from a sitemap route. */
export function formatRouteTitle(route: string) {
  if (route === "/") {
    return "Home";
  }

  const lastSegment = Option.getOrElse(
    Arr.last(Arr.filter(route.split("/"), Boolean)),
    () => route
  );
  return formatSegmentTitle(lastSegment);
}

/** Converts one kebab-case route segment into title case. */
function formatSegmentTitle(segment: string) {
  return pipe(
    Arr.filter(segment.split("-"), Boolean),
    Arr.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
    Arr.join(" ")
  );
}
