import { getAppUrl } from "@repo/site/app";

export const BASE_URL = getAppUrl();
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
