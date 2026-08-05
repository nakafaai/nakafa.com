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
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import {
  ARTICLE_CATEGORIES,
  BACHELOR_MATERIALS,
  HIGH_SCHOOL_MATERIALS,
  NON_NUMERIC_GRADES,
  NUMERIC_GRADES,
  SUBJECT_CATEGORIES,
} from "@repo/contents/_types/taxonomy";
import { defaultLocale, type Locale, locales } from "@repo/utilities/locales";
import { Effect, Option } from "effect";

/** Reads public taxonomy from constants and active signed publications. */
export function readNakafaTaxonomy(
  convexUrl: string,
  locale: Locale = defaultLocale
) {
  return Effect.gen(function* () {
    const [signedInventory, quranResult] = yield* Effect.all([
      readSignedInventory(convexUrl, locale),
      fetchNakafaRuntimeQuery(
        convexUrl,
        "contentRelease.quran.surahs",
        api.contentRelease.quran.surahs,
        {}
      ),
    ]);
    const quran = yield* decodePublishedQuranCatalog(quranResult).pipe(
      Effect.mapError(toNakafaQuranDataReadError)
    );
    const contentCounts = signedInventory.contentCounts.map((item) => ({
      ...item,
      count: item.count + quran.surahs.length,
    }));

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
      tryout: signedInventory.tryout,
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

/** Reads every locale's search inventory from active signed publications. */
const readSignedInventory = Effect.fn("nakafa.taxonomy.readSignedInventory")(
  function* (convexUrl: string, selectedLocale: Locale) {
    const inventories = yield* Effect.forEach(
      locales,
      (locale) => readLocaleSignedInventory(convexUrl, locale),
      { concurrency: locales.length }
    );
    const selected = Option.fromNullable(
      inventories.find(({ locale }) => locale === selectedLocale)
    );
    if (Option.isNone(selected)) {
      return yield* new NakafaAgentDataReadError({
        cause: `Unsupported taxonomy locale ${selectedLocale}.`,
        message: "Unable to read signed Nakafa content inventory.",
      });
    }

    return {
      contentCounts: inventories.map(({ count, locale }) => ({
        count,
        locale,
      })),
      tryout: selected.value.tryout,
    };
  }
);

/** Reads one locale's article, material, and Tryout signed counts. */
const readLocaleSignedInventory = Effect.fn(
  "nakafa.taxonomy.readLocaleSignedInventory"
)(function* (convexUrl: string, locale: Locale) {
  const [articles, materials, tryout] = yield* Effect.all([
    fetchNakafaRuntimeQuery(
      convexUrl,
      "readArticleSitemapBuckets",
      api.contentRelease.article.sitemapBuckets,
      { locale }
    ),
    fetchNakafaRuntimeQuery(
      convexUrl,
      "readMaterialSitemapBuckets",
      api.contentRelease.material.sitemapBuckets,
      { locale }
    ),
    fetchNakafaRuntimeQuery(
      convexUrl,
      "readTryoutTaxonomy",
      api.contentRelease.tryout.taxonomy,
      { locale }
    ),
  ]);
  if (!articles.managed) {
    return yield* missingSignedInventory("article", locale);
  }
  if (!materials.managed) {
    return yield* missingSignedInventory("material", locale);
  }

  return {
    count: articles.articleCount + materials.materialCount + tryout.routeCount,
    locale,
    tryout: {
      countries: tryout.countries,
      exams: tryout.exams,
    },
  };
});

/** Fails closed when one activated signed search family is unavailable. */
function missingSignedInventory(family: string, locale: Locale) {
  return new NakafaAgentDataReadError({
    cause: `Signed ${family} inventory is unmanaged for ${locale}.`,
    message: "Unable to read signed Nakafa content inventory.",
  });
}
