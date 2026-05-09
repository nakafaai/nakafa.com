import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentSummary } from "@repo/contents/_lib/agent/schema/ref";
import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
} from "@repo/contents/_lib/exercises/collection";
import {
  hasInvalidTryOutYearSlug,
  isYearlessTryOutCollectionSlug,
} from "@repo/contents/_lib/exercises/slug";
import {
  type ContentMetadataListItem,
  getContentsMetadata,
} from "@repo/contents/_lib/metadata";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import type { Locale } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Builds the full public Nakafa content index for one locale. */
export const getNakafaAgentContentIndex = Effect.fn(
  "NakafaAgent.getContentIndex"
)(function* (locale: Locale = routing.defaultLocale) {
  const mdxItems = yield* getNakafaMdxContentSummaries(locale);
  const exerciseItems = getNakafaExerciseSummaries(locale);
  const quranItems = getNakafaQuranSummaries(locale);

  return [...mdxItems, ...exerciseItems, ...quranItems].sort(
    compareNakafaContentSummaries
  );
});

/** Provides stable ordering across mixed content sections. */
function compareNakafaContentSummaries(
  left: NakafaAgentContentSummary,
  right: NakafaAgentContentSummary
) {
  return `${left.section}:${left.title}`.localeCompare(
    `${right.section}:${right.title}`
  );
}

/** Builds searchable summaries for articles and subject content. */
function getNakafaMdxContentSummaries(locale: Locale) {
  return Effect.all(
    [
      getContentsMetadata({ basePath: "articles", locale }),
      getContentsMetadata({ basePath: "subject", locale }),
    ],
    { concurrency: "unbounded" }
  ).pipe(
    Effect.map(([articles, subjects]) => [
      ...articles.map((entry) =>
        buildNakafaMdxContentSummary(locale, entry, "articles")
      ),
      ...subjects.map((entry) =>
        buildNakafaMdxContentSummary(locale, entry, "subject")
      ),
    ])
  );
}

/** Builds one article or subject summary from trusted scoped metadata. */
function buildNakafaMdxContentSummary(
  locale: Locale,
  entry: ContentMetadataListItem,
  section: "articles" | "subject"
) {
  return {
    ...buildNakafaContentRef(locale, entry.slug, section),
    description: entry.metadata.description ?? entry.metadata.subject ?? "",
    title: entry.metadata.title,
  };
}

/** Builds searchable summaries for canonical exercise sets. */
function getNakafaExerciseSummaries(locale: Locale) {
  const slugs = getMDXSlugsForLocale(locale);

  return getExerciseSetPathsFromSlugs(slugs)
    .filter(isCanonicalNakafaExerciseSetPath)
    .map((route) => ({
      ...buildNakafaContentRef(locale, route, "exercises"),
      description: `${getExerciseQuestionNumbers(slugs, route).length} exercises`,
      title: formatNakafaRouteTitle(route),
    }));
}

/** Builds searchable summaries for Quran surahs. */
function getNakafaQuranSummaries(locale: Locale) {
  return getAllSurah().map((surah) => ({
    ...buildNakafaContentRef(locale, `quran/${surah.number}`, "quran"),
    description: surah.name.translation[locale],
    title: `${surah.number}. ${getSurahName({ locale, name: surah.name })}`,
  }));
}

/** Keeps exercise search results on real set routes, not collection aliases. */
function isCanonicalNakafaExerciseSetPath(route: string) {
  const [, category, type, material, ...setSlug] = route.split("/");

  if (!(category && type && material && setSlug.length > 0)) {
    return false;
  }

  return !(
    isYearlessTryOutCollectionSlug(setSlug) || hasInvalidTryOutYearSlug(setSlug)
  );
}
