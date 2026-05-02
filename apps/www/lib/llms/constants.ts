export const BASE_URL = "https://nakafa.com";
export const LLMS_INDEX_TARGET_MAX_CHARS = 45_000;
export const MARKDOWN_EXTENSIONS = /\.(?:md|mdx|txt)$/;
export const NUMBER_SEGMENT = /^\d+$/;
export const ENGLISH_LANGUAGE_NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
});

export const SECTION_LABELS = {
  articles: "Articles",
  exercises: "Exercises",
  quran: "Quran",
  site: "Site Pages",
  subject: "Subject",
};

export type LlmsSection = keyof typeof SECTION_LABELS;
