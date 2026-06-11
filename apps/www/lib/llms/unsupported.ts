import { LLMS_TEXT_PATH } from "@/lib/agent-discovery";
import { BASE_URL } from "@/lib/llms/constants";

const ROOT_ROUTE_PATTERN = /^\/$/;

/**
 * Builds the agent-readable body for unsupported markdown routes.
 *
 * Callers must still return HTTP 404. The body points agents to source-backed
 * indexes and the HTML URL without pretending the requested markdown page
 * exists.
 */
export function buildUnsupportedMarkdownRouteText({
  locale,
  route,
}: {
  locale: string;
  route: string;
}) {
  const htmlPath = `/${locale}${route.replace(ROOT_ROUTE_PATTERN, "")}`;
  const markdownPath = `${htmlPath}.md`;

  return [
    "# Markdown page not found",
    "",
    `The markdown page \`${markdownPath}\` does not exist for Nakafa.`,
    "",
    "Use these source-backed routes instead:",
    "",
    `- HTML page: ${BASE_URL}${htmlPath}`,
    `- Agent index: ${BASE_URL}${LLMS_TEXT_PATH}`,
    `- Localized content index: ${BASE_URL}/llms/${locale}/llms.txt`,
    `- Static site index: ${BASE_URL}/llms/${locale}/site/llms.txt`,
    "",
    "Markdown is available only for supported content and legal pages advertised from the llms indexes. Those pages use `.md` URLs or `Accept: text/markdown`.",
    "",
  ].join("\n");
}
