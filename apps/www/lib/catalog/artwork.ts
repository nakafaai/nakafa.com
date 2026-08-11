import type { Locale } from "next-intl";

const GRADE_ARTWORK_BY_ICON_KEY: Readonly<Record<string, string>> = {
  "grade-9": "9",
  "grade-10": "10",
  "grade-11": "11",
  "grade-12": "12",
  bachelor: "bachelor",
};

const SUBJECT_ARTWORK_KEYS = new Set([
  "ai-ds",
  "biology",
  "chemistry",
  "computer-science",
  "economics",
  "english-language",
  "general-reasoning",
  "geography",
  "geospatial",
  "history",
  "indonesian-language",
  "informatics",
  "mathematical-reasoning",
  "mathematics",
  "physics",
  "quantitative-knowledge",
  "sociology",
  "technology-electro-medical",
]);

/** Resolves reviewed grade artwork from a stable curriculum icon identity. */
export function getGradeCatalogArtwork(locale: Locale, iconKey: string) {
  const gradeKey = GRADE_ARTWORK_BY_ICON_KEY[iconKey];

  if (!gradeKey) {
    return;
  }

  return `/open-graph/grade/${locale}-${gradeKey}.png`;
}

/** Resolves reviewed subject artwork from a stable material identity. */
export function getSubjectCatalogArtwork(
  locale: Locale,
  subjectKey: string | undefined
) {
  if (!(subjectKey && SUBJECT_ARTWORK_KEYS.has(subjectKey))) {
    return;
  }

  return `/open-graph/subject/${locale}-${subjectKey}.png`;
}
