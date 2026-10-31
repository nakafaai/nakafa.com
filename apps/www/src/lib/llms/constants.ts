import { getAppUrl } from "@repo/site/app";

export const BASE_URL = getAppUrl();

/** The route that serves every llms index and bounded page, `/llms.mdx/...`; only the root `/llms.txt` is a static file. */
const LLMS_ROUTE = "/llms.mdx";

/**
 * The absolute address of an llms index or of a prefix of one, served by the
 * `/llms.mdx/$` route, such as `llmsRouteUrl("/en/llms.txt")`.
 */
export function llmsRouteUrl(path: string) {
  return `${BASE_URL}${LLMS_ROUTE}${path}`;
}
export const MARKDOWN_EXTENSIONS = /\.(?:md|mdx|txt)$/;
export const ENGLISH_LANGUAGE_NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
});

export const SECTION_LABELS = {
  articles: "Articles",
  material: "Material",
  quran: "Quran",
  site: "Site Pages",
};

export type LlmsSection = keyof typeof SECTION_LABELS;
