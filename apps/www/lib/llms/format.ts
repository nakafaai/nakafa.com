import { LLMS_TEXT_PATH } from "@/lib/agent-discovery";
import {
  BASE_URL,
  ENGLISH_LANGUAGE_NAMES,
  MARKDOWN_EXTENSIONS,
} from "@/lib/llms/constants";

/** Canonical discovery directive shown near the top of agent-facing markdown. */
export const AGENT_MARKDOWN_DIRECTIVE = `> For AI agents: use [llms.txt](${BASE_URL}${LLMS_TEXT_PATH}) for the site index. Markdown versions are available by appending \`.md\` to content URLs or sending \`Accept: text/markdown\`.`;

/** Builds the common markdown header used by page-level llms output. */
export function buildHeader({
  url,
  description,
  source,
}: {
  url: string;
  description: string;
  source?: string;
}) {
  const header = [
    "# Nakafa Learning Content",
    "",
    AGENT_MARKDOWN_DIRECTIVE,
    "",
    `URL: ${url}`,
  ];

  if (source) {
    header.push(`Source: ${source}`);
  }

  header.push("", description, "", "---", "");

  return header;
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

  return formatSegmentTitle(route.split("/").filter(Boolean).at(-1) ?? route);
}

/** Converts one kebab-case route segment into title case. */
function formatSegmentTitle(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
