import {
  getUnknownErrorMessage,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { formatNakafaRouteTitle } from "@repo/contents/_lib/agent/format";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentContentSummary } from "@repo/contents/_lib/agent/schemas";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schemas";
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

/** Searches the Nakafa content index with bounded offset pagination. */
export const searchNakafaAgentContent = Effect.fn("NakafaAgent.searchContent")(
  function* (options: unknown = {}) {
    const parsedOptions = yield* parseNakafaSearchOptions(options);
    const query = parsedOptions.query?.toLowerCase();
    const index = yield* getNakafaAgentContentIndex(parsedOptions.locale);
    const filtered = index.filter((item) =>
      matchesNakafaSearchItem(item, query, parsedOptions.section)
    );
    const items = filtered.slice(
      parsedOptions.offset,
      parsedOptions.offset + parsedOptions.limit
    );
    const nextOffset = parsedOptions.offset + items.length;

    return NakafaAgentSearchResultSchema.parse({
      count: items.length,
      has_more: nextOffset < filtered.length,
      items,
      limit: parsedOptions.limit,
      next_offset: nextOffset < filtered.length ? nextOffset : null,
      offset: parsedOptions.offset,
      total_count: filtered.length,
    });
  }
);

/** Parses and validates untrusted search options with the shared Zod schema. */
function parseNakafaSearchOptions(options: unknown) {
  return Effect.try({
    try: () => NakafaAgentSearchOptionsSchema.parse(options),
    catch: (error) =>
      new NakafaAgentInputError({
        cause: getUnknownErrorMessage(error),
        message: "Invalid Nakafa content search options.",
      }),
  });
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

/** Checks whether one summary matches the requested query and section. */
function matchesNakafaSearchItem(
  item: NakafaAgentContentSummary,
  query: string | undefined,
  section: string | undefined
) {
  if (section && item.section !== section) {
    return false;
  }

  if (!query) {
    return true;
  }

  return [item.content_id, item.title, item.description, item.url]
    .join(" ")
    .toLowerCase()
    .includes(query);
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
