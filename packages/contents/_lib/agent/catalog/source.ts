import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentSummary } from "@repo/contents/_lib/agent/schema/ref";
import {
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
} from "@repo/contents/_lib/exercises/collection";
import {
  hasInvalidTryOutYearSlug,
  isYearlessTryOutCollectionSlug,
} from "@repo/contents/_lib/exercises/slug";
import { getMdxSlugsForLocale } from "@repo/contents/_lib/mdx-slugs/cache";
import {
  type ContentMetadataListItem,
  getContentsMetadata,
} from "@repo/contents/_lib/metadata";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import type { Locale } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Cache, Duration, Effect } from "effect";

/** Builds the full public Nakafa content index for one locale. */
export const getNakafaAgentContentIndex = Effect.fn(
  "NakafaAgent.getContentIndex"
)(function* (locale: Locale = routing.defaultLocale) {
  return yield* nakafaAgentContentIndexCache.get(locale);
});

const nakafaAgentContentIndexCache = Effect.runSync(
  Cache.make({
    capacity: routing.locales.length,
    timeToLive: Duration.infinity,
    lookup: buildNakafaAgentContentIndex,
  })
);

/** Builds an uncached agent content index entry for one locale. */
function buildNakafaAgentContentIndex(locale: Locale) {
  return Effect.gen(function* () {
    const mdxItems = yield* getNakafaMdxContentSummaries(locale);
    const exerciseItems = yield* getNakafaExerciseSummaries(locale);
    const quranItems = getNakafaQuranSummaries(locale);

    return [...mdxItems, ...exerciseItems, ...quranItems].sort(
      compareNakafaContentSummaries
    );
  });
}

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
  return Effect.gen(function* () {
    const slugs = yield* getMdxSlugsForLocale(locale);

    return getExerciseSetPathsFromSlugs(slugs).flatMap((route) => {
      if (!isCanonicalNakafaExerciseSetPath(route)) {
        return [];
      }

      return [
        {
          ...buildNakafaContentRef(locale, route, "exercises"),
          description: `${getExerciseQuestionNumbers(slugs, route).length} exercises`,
          title: formatNakafaRouteTitle(route, locale),
        },
      ];
    });
  });
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
