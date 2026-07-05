export const BASE_URL = getLlmsBaseUrl();
export const LLMS_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, must-revalidate";
export const LLMS_INDEX_TARGET_MAX_CHARS = 45_000;
export const MARKDOWN_EXTENSIONS = /\.(?:md|mdx|txt)$/;
export const NUMBER_SEGMENT = /^\d+$/;
export const ENGLISH_LANGUAGE_NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
});

export const SECTION_LABELS = {
  articles: "Articles",
  material: "Material",
  quran: "Quran",
  site: "Site Pages",
  tryout: "Try Out",
};

export type LlmsSection = keyof typeof SECTION_LABELS;

/**
 * Reads the public application origin used by generated agent-facing indexes.
 */
function getLlmsBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.");
  }

  return appUrl;
}
