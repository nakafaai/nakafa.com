import type { Locale } from "next-intl";
import { hasStaticArtwork } from "@/lib/og/artwork";

const CURRICULUM_ARTWORK_KEYS = new Set([
  "cambridge-international",
  "merdeka",
  "singapore-moe",
  "united-states",
]);

const GRADE_ARTWORK_BY_ICON_KEY = new Map([
  ["grade-9", "9"],
  ["grade-10", "10"],
  ["grade-11", "11"],
  ["grade-12", "12"],
  ["bachelor", "bachelor"],
]);

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

const CURRICULUM_SUBJECT_ARTWORK_KEY_BY_MATERIAL_DOMAIN = new Map([
  ["economy", "economics"],
]);

const TRYOUT_SUBJECT_ARTWORK_KEY_BY_TRACK_KEY = new Map([
  ["matematika", "mathematics"],
]);

/** Resolves reviewed curriculum artwork without using generated social art. */
export function getCurriculumCatalogArtwork(
  locale: Locale,
  programKey: string
) {
  if (!(hasStaticArtwork(locale) && CURRICULUM_ARTWORK_KEYS.has(programKey))) {
    return;
  }

  return `/open-graph/curriculum/${locale}-${programKey}.png`;
}

/** Resolves reviewed grade artwork from a stable curriculum icon identity. */
export function getGradeCatalogArtwork(locale: Locale, iconKey: string) {
  if (!hasStaticArtwork(locale)) {
    return;
  }

  const gradeKey = GRADE_ARTWORK_BY_ICON_KEY.get(iconKey);

  if (!gradeKey) {
    return;
  }

  return `/open-graph/grade/${locale}-${gradeKey}.png`;
}

/** Resolves reviewed subject artwork from a curriculum material identity. */
export function getCurriculumSubjectCatalogArtwork(
  locale: Locale,
  materialDomain: string | undefined
) {
  if (!materialDomain) {
    return;
  }

  const artworkKey =
    CURRICULUM_SUBJECT_ARTWORK_KEY_BY_MATERIAL_DOMAIN.get(materialDomain) ??
    materialDomain;

  return getReviewedSubjectArtwork(locale, artworkKey);
}

/** Resolves reviewed subject artwork from a try-out track identity. */
export function getTryoutSubjectCatalogArtwork(
  locale: Locale,
  trackKey: string
) {
  const artworkKey =
    TRYOUT_SUBJECT_ARTWORK_KEY_BY_TRACK_KEY.get(trackKey) ?? trackKey;

  return getReviewedSubjectArtwork(locale, artworkKey);
}

function getReviewedSubjectArtwork(locale: Locale, artworkKey: string) {
  if (!(hasStaticArtwork(locale) && SUBJECT_ARTWORK_KEYS.has(artworkKey))) {
    return;
  }

  return `/open-graph/subject/${locale}-${artworkKey}.png`;
}
