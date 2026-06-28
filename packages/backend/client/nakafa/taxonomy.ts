import { decodeNakafaTaxonomy } from "@repo/backend/client/nakafa/decode";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import {
  getExerciseCategoryOptions,
  getExerciseMaterialOptions,
  getExerciseTypeOptions,
} from "@repo/contents/_lib/assessment/label";
import {
  ARTICLE_CATEGORIES,
  BACHELOR_MATERIALS,
  HIGH_SCHOOL_MATERIALS,
  NON_NUMERIC_GRADES,
  NUMERIC_GRADES,
  SUBJECT_CATEGORIES,
} from "@repo/contents/_types/taxonomy";
import { defaultLocale, type Locale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Reads public taxonomy from pure constants and Convex runtime counts. */
export function readNakafaTaxonomy(
  convexUrl: string,
  locale: Locale = defaultLocale
) {
  return Effect.gen(function* () {
    const [contentCounts, surahs] = yield* Effect.all([
      getContentCounts(convexUrl),
      fetchNakafaRuntimeQuery(
        convexUrl,
        "listQuranSurahs",
        api.contents.queries.runtime.listQuranSurahs,
        {}
      ),
    ]);

    return yield* decodeNakafaTaxonomy({
      articles: {
        categories: ARTICLE_CATEGORIES,
      },
      content_counts: contentCounts,
      default_locale: defaultLocale,
      endpoints: {
        direct: NAKAFA_MCP_DIRECT_ENDPOINT,
        recommended: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
        root_note: `${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.`,
      },
      exercises: {
        categories: getExerciseCategoryOptions(locale),
        materials: getExerciseMaterialOptions(locale),
        types: getExerciseTypeOptions(locale),
      },
      locale,
      locales,
      quran: {
        surah_count: surahs.length,
      },
      sections: NAKAFA_AGENT_SECTIONS,
      subject: {
        categories: SUBJECT_CATEGORIES,
        grades: [...NUMERIC_GRADES, ...NON_NUMERIC_GRADES],
        materials: [...HIGH_SCHOOL_MATERIALS, ...BACHELOR_MATERIALS],
      },
      tools: [
        "nakafa_search_content",
        "nakafa_get_content",
        "nakafa_get_taxonomy",
        "nakafa_get_exercise",
        "nakafa_get_quran_reference",
      ],
    });
  });
}

/** Reads materialized synced content route counts per locale. */
function getContentCounts(convexUrl: string) {
  return Effect.forEach(
    locales,
    (locale) => readLocaleContentCount(convexUrl, locale),
    { concurrency: locales.length }
  );
}

/** Reads one locale's materialized route-count rows and sums them. */
function readLocaleContentCount(convexUrl: string, locale: Locale) {
  return fetchNakafaRuntimeQuery(
    convexUrl,
    "listContentRouteCounts",
    api.contents.queries.runtime.listContentRouteCounts,
    { locale }
  ).pipe(
    Effect.map((counts) => ({
      count: counts.reduce((total, row) => total + row.count, 0),
      locale,
    }))
  );
}
