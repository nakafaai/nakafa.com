import {
  decodeNakafaTaxonomy,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/decode";
import { api } from "@repo/backend/convex/_generated/api";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
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
    const [contentCounts, quranResult, tryout] = yield* Effect.all([
      getContentCounts(convexUrl),
      fetchNakafaRuntimeQuery(
        convexUrl,
        "contentRelease.quran.surahs",
        api.contentRelease.quran.surahs,
        {}
      ),
      readTryoutTaxonomy(convexUrl, locale),
    ]);
    const quran = yield* decodePublishedQuranCatalog(quranResult).pipe(
      Effect.mapError(toNakafaQuranDataReadError)
    );

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
      tryout,
      locale,
      locales,
      quran: {
        surah_count: quran.surahs.length,
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
        "nakafa_get_quran_reference",
      ],
    });
  });
}

/** Reads country and exam labels from the active signed try-out catalog. */
const readTryoutTaxonomy = Effect.fn("nakafa.taxonomy.readTryout")(function* (
  convexUrl: string,
  locale: Locale
) {
  const hub = yield* fetchNakafaRuntimeQuery(
    convexUrl,
    "getTryoutHubPage",
    api.tryouts.queries.catalog.getHubPage,
    { locale }
  );
  const countryPages = yield* Effect.forEach(
    hub.countries,
    (country) =>
      fetchNakafaRuntimeQuery(
        convexUrl,
        "getTryoutCountryPage",
        api.tryouts.queries.catalog.getCountryPage,
        { locale, publicPath: country.publicPath }
      ),
    { concurrency: Math.max(1, hub.countries.length) }
  );
  const examOptions = new Map<string, string>();

  for (const page of countryPages) {
    if (!page) {
      continue;
    }
    for (const exam of page.exams) {
      examOptions.set(exam.examKey, exam.title);
    }
  }

  return {
    countries: hub.countries.map((country) => ({
      id: country.countryKey,
      label: country.title,
    })),
    exams: Array.from(examOptions, ([id, label]) => ({ id, label })),
  };
});

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
