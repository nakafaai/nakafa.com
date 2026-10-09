import { cleanSlug } from "@repo/utilities/helper";
import { Array as Arr, Option, pipe } from "effect";
import { LLMS_TEXT_PATH } from "@/lib/discovery";
import {
  BASE_URL,
  ENGLISH_LANGUAGE_NAMES,
  MARKDOWN_EXTENSIONS,
} from "@/lib/llms/constants";

/** Canonical discovery directive shown near the top of agent-facing markdown. */
export const AGENT_MARKDOWN_DIRECTIVE = `> For AI agents: use [llms.txt](${BASE_URL}${LLMS_TEXT_PATH}) for the site index. Markdown versions are available by appending \`.md\` to content URLs or sending \`Accept: text/markdown\`.`;

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

/** Builds the common markdown header used by page-level llms output. */
export function buildHeader({
  description,
  source,
  title,
  url,
}: {
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
    "",
    description,
    "",
    "---",
    "",
  ];
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
