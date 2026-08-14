import {
  decodeNakafaTaxonomy,
  toNakafaQuranDataReadError,
} from "@repo/backend/client/nakafa/decode";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import {
  readNakafaReleasePin,
  verifyNakafaReleasePin,
} from "@repo/backend/client/nakafa/release";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/decode";
import { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { defaultLocale, type Locale, locales } from "@repo/utilities/locales";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type ArticleCategoryPageArgs = FunctionArgs<
  typeof api.contentRelease.article.categories
>;

/** Reads one generated category page without recursive loop inference. */
const readSignedArticleCategoryPage = Effect.fn(
  "nakafa.taxonomy.readSignedArticleCategoryPage"
)(function* (convexUrl: string, args: ArticleCategoryPageArgs) {
  return yield* readNakafaRuntimeQuery(
    convexUrl,
    api.contentRelease.article.categories,
    args
  );
});

type ArticleCategoryPage = Effect.Effect.Success<
  ReturnType<typeof readSignedArticleCategoryPage>
>;

interface ArticleCategoryCursor {
  readonly categories: readonly string[];
  readonly cursor: string | null;
  readonly expectedManifestHash: string | null;
  readonly expectedReleaseId: string | null;
}

/** Reads public taxonomy from current signed publications. */
export function readNakafaTaxonomy(
  convexUrl: string,
  locale: Locale = defaultLocale
) {
  return Effect.gen(function* () {
    const releasePin = yield* readNakafaReleasePin(convexUrl);
    const [articleCategories, signedInventory, quranResult] = yield* Effect.all(
      [
        readSignedArticleCategories(convexUrl, locale),
        readSignedInventory(convexUrl, locale),
        readNakafaRuntimeQuery(convexUrl, api.contentRelease.quran.surahs, {}),
      ]
    );
    const quran = yield* decodePublishedQuranCatalog(quranResult).pipe(
      Effect.mapError(toNakafaQuranDataReadError)
    );
    const contentCounts = signedInventory.contentCounts.map((item) => ({
      ...item,
      count: item.count + quran.surahs.length,
    }));
    yield* verifyNakafaReleasePin(convexUrl, releasePin);

    return yield* decodeNakafaTaxonomy({
      articles: {
        categories: articleCategories,
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
      tools: [
        "nakafa_search_content",
        "nakafa_get_content",
        "nakafa_get_taxonomy",
        "nakafa_get_quran_reference",
      ],
    });
  });
}

/** Recursively reads one stable signed article-category generation. */
function readSignedArticleCategoryPages(
  convexUrl: string,
  locale: Locale,
  position: ArticleCategoryCursor
): Effect.Effect<readonly string[], NakafaAgentDataReadError> {
  return Effect.gen(function* () {
    const result: ArticleCategoryPage = yield* readSignedArticleCategoryPage(
      convexUrl,
      {
        appLocale: locale,
        expectedManifestHash: position.expectedManifestHash,
        expectedReleaseId: position.expectedReleaseId,
        paginationOpts: {
          cursor: position.cursor,
          numItems: PROJECTION_PAGE_LIMIT,
        },
      }
    );
    const {
      activeManifestHash,
      activeReleaseId,
      managed,
      result: { continueCursor, isDone, page },
      stale,
    } = result;
    const categories = [
      ...position.categories,
      ...page.map(({ category }) => category),
    ];
    if (
      !managed ||
      stale ||
      activeManifestHash === null ||
      activeReleaseId === null
    ) {
      return yield* Effect.fail(
        missingSignedInventory("article taxonomy", locale)
      );
    }
    if (isDone) {
      return categories;
    }
    if (continueCursor === "") {
      return yield* Effect.fail(
        new NakafaAgentDataReadError({
          cause: `Signed article taxonomy for ${locale} lost its continuation cursor.`,
          message: "Unable to read signed Nakafa content inventory.",
        })
      );
    }
    return yield* readSignedArticleCategoryPages(convexUrl, locale, {
      categories,
      cursor: continueCursor,
      expectedManifestHash: activeManifestHash,
      expectedReleaseId: activeReleaseId,
    });
  });
}

/** Reads every authenticated article category in one stable release generation. */
const readSignedArticleCategories = Effect.fn(
  "nakafa.taxonomy.readSignedArticleCategories"
)((convexUrl: string, locale: Locale) =>
  readSignedArticleCategoryPages(convexUrl, locale, {
    categories: [],
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
  })
);

/** Reads every locale's search inventory from active signed publications. */
const readSignedInventory = Effect.fn("nakafa.taxonomy.readSignedInventory")(
  function* (convexUrl: string, selectedLocale: Locale) {
    const inventories = yield* Effect.all(
      {
        en: readLocaleSignedInventory(convexUrl, "en"),
        id: readLocaleSignedInventory(convexUrl, "id"),
      },
      { concurrency: locales.length }
    );

    return {
      contentCounts: locales.map((locale) => ({
        count: inventories[locale].count,
        locale,
      })),
      tryout: inventories[selectedLocale].tryout,
    };
  }
);

/** Reads one locale's article, material, and Tryout signed counts. */
const readLocaleSignedInventory = Effect.fn(
  "nakafa.taxonomy.readLocaleSignedInventory"
)(function* (convexUrl: string, locale: Locale) {
  const [articles, materials, tryout] = yield* Effect.all([
    readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.article.sitemapBuckets,
      { appLocale: locale }
    ),
    readNakafaRuntimeQuery(
      convexUrl,
      api.contentRelease.material.sitemapBuckets,
      { appLocale: locale }
    ),
    readNakafaRuntimeQuery(convexUrl, api.contentRelease.tryout.taxonomy, {
      appLocale: locale,
    }),
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
