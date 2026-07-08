import { getNakafaAgentContentIndex } from "@repo/contents/_lib/agent/catalog/source";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { getAllSurah } from "@repo/contents/_lib/quran";
import type { Locale } from "@repo/contents/_types/content";
import {
  ARTICLE_CATEGORIES,
  BACHELOR_MATERIALS,
  HIGH_SCHOOL_MATERIALS,
  NON_NUMERIC_GRADES,
  NUMERIC_GRADES,
  SUBJECT_CATEGORIES,
} from "@repo/contents/_types/taxonomy";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema } from "effect";

/** Retrieves the public Nakafa taxonomy and MCP endpoint guidance. */
export const getNakafaAgentTaxonomy = Effect.fn("NakafaAgent.getTaxonomy")(
  function* (locale: Locale = routing.defaultLocale) {
    const contentCounts = yield* getNakafaAgentContentCounts();

    return yield* buildNakafaAgentTaxonomy({ contentCounts, locale });
  }
);

/** Builds taxonomy output from already-counted locale indexes. */
export function buildNakafaAgentTaxonomy({
  contentCounts,
  locale = routing.defaultLocale,
}: {
  contentCounts: readonly { count: number; locale: Locale }[];
  locale?: Locale;
}) {
  return decodeNakafaAgentTaxonomy({
    articles: {
      categories: ARTICLE_CATEGORIES,
    },
    content_counts: contentCounts,
    default_locale: routing.defaultLocale,
    endpoints: {
      direct: NAKAFA_MCP_DIRECT_ENDPOINT,
      recommended: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
      root_note: `${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.`,
    },
    tryout: {
      countries: getTryoutCountryOptions(locale),
      exams: getTryoutExamOptions(locale),
    },
    locale,
    locales: routing.locales,
    quran: {
      surah_count: getAllSurah().length,
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
}

/** Derives supported try-out countries from source-controlled exam programs. */
function getTryoutCountryOptions(locale: Locale) {
  const options = new Map<string, string>();

  for (const source of TRYOUT_SOURCES) {
    options.set(source.countryKey, source.countryTranslations[locale].title);
  }

  return Array.from(options, ([id, label]) => ({ id, label }));
}

/** Derives supported try-out exams from source-controlled exam programs. */
function getTryoutExamOptions(locale: Locale) {
  return TRYOUT_SOURCES.map((source) => ({
    id: source.examKey,
    label: source.examTranslations[locale].title,
  }));
}

/** Counts indexed content once for each supported locale. */
function getNakafaAgentContentCounts() {
  return Effect.forEach(
    routing.locales,
    (currentLocale) =>
      getNakafaAgentContentIndex(currentLocale).pipe(
        Effect.map((items) => ({
          count: items.length,
          locale: currentLocale,
        }))
      ),
    { concurrency: routing.locales.length }
  );
}

/** Decodes agent taxonomy output into the public schema shape. */
export function decodeNakafaAgentTaxonomy(taxonomy: unknown) {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(NakafaAgentTaxonomySchema)(taxonomy),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to build Nakafa agent taxonomy.",
      }),
  });
}
