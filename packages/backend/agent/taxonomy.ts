import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode as Locale,
} from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { activeIdentityValidator } from "@repo/backend/content/publication/spec";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_GUIDANCE,
} from "@repo/contents/agent/constants";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/agent/errors";
import { NakafaAgentTaxonomySchema } from "@repo/contents/agent/schema/taxonomy";
import { Array as Arr, Effect, Order } from "effect";

type ReleasePin = typeof activeIdentityValidator.Type;
const articleCategoriesReference =
  refs.internal.contentRelease.article.internal.readAgentTaxonomy;
const articleBucketsReference =
  refs.public.contentRelease.article.sitemapBuckets;
const materialBucketsReference =
  refs.public.contentRelease.material.sitemapBuckets;
const tryoutTaxonomyReference = refs.public.contentRelease.tryout.taxonomy;
const quranCatalogReference = refs.public.contentRelease.quran.surahs;
const activeReleaseReference = refs.public.contentRelease.runtime.active.read;

/** Reads public taxonomy from one release-pinned signed publication. */
export const getNakafaTaxonomy = Effect.fn("agent.getNakafaTaxonomy")(
  function* (locale: Locale = ACTIVE_APP_LOCALE_CODES[0]) {
    const { runQuery } = yield* QueryRunner;
    const before = yield* readReleasePin();
    const [articleCategories, inventories, quranResult] = yield* Effect.all([
      readArticleCategories(locale),
      readInventories(locale),
      runQuery(quranCatalogReference, {}).pipe(
        Effect.mapError(
          (cause) =>
            new NakafaAgentDataReadError({
              cause: getUnknownErrorMessage(cause),
              message: "Unable to read the signed Nakafa Quran catalog.",
            })
        )
      ),
    ]);
    const quran = yield* decodePublishedQuranCatalog(quranResult).pipe(
      Effect.mapError(
        (error) =>
          new NakafaAgentDataReadError({
            cause: error.reason,
            message: "Unable to read the signed Nakafa Quran catalog.",
          })
      )
    );
    yield* verifyReleasePin(before);
    return yield* decodeAgentOutput(
      NakafaAgentTaxonomySchema,
      {
        articles: {
          categories: articleCategories,
        },
        content_counts: Arr.map(inventories.contentCounts, (item) => ({
          ...item,
          count: item.count + quran.surahs.length,
        })),
        default_locale: ACTIVE_APP_LOCALE_CODES[0],
        endpoints: NAKAFA_MCP_GUIDANCE,
        locale,
        locales: ACTIVE_APP_LOCALE_CODES,
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
        tryout: inventories.tryout,
      },
      "Unable to build Nakafa agent taxonomy."
    );
  }
);

/** Reads every authenticated article category in one stable generation. */
const readArticleCategories = Effect.fn("agent.readArticleCategories")(
  function* (locale: Locale) {
    const { runQuery } = yield* QueryRunner;
    const taxonomy = yield* runQuery(articleCategoriesReference, {
      appLocale: locale,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read signed Nakafa article taxonomy.",
          })
      )
    );
    if (!taxonomy.managed) {
      return yield* missingInventory("article taxonomy", locale);
    }
    return taxonomy.categories;
  }
);

/** Reads every locale inventory and the selected try-out taxonomy. */
const readInventories = Effect.fn("agent.readInventories")(function* (
  selectedLocale: Locale
) {
  const [selected, remaining] = yield* Effect.all([
    readLocaleInventory(selectedLocale),
    Effect.forEach(
      Arr.filter(
        ACTIVE_APP_LOCALE_CODES,
        (locale) => locale !== selectedLocale
      ),
      (locale) => readLocaleInventory(locale),
      {
        concurrency: ACTIVE_APP_LOCALE_CODES.length,
      }
    ),
  ]);
  const byLocaleOrder = Order.mapInput(
    Order.Number,
    (inventory: typeof selected) =>
      ACTIVE_APP_LOCALE_CODES.indexOf(inventory.locale)
  );
  const inventories = Arr.sort([selected, ...remaining], byLocaleOrder);
  return {
    contentCounts: Arr.map(inventories, ({ count, locale }) => ({
      count,
      locale,
    })),
    tryout: selected.tryout,
  };
});

/** Reads one locale's article, material, and try-out inventory. */
const readLocaleInventory = Effect.fn("agent.readLocaleInventory")(function* (
  locale: Locale
) {
  const { runQuery } = yield* QueryRunner;
  const [articles, materials, tryout] = yield* Effect.all([
    runQuery(articleBucketsReference, {
      appLocale: locale,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read signed Nakafa article inventory.",
          })
      )
    ),
    runQuery(materialBucketsReference, {
      appLocale: locale,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read signed Nakafa material inventory.",
          })
      )
    ),
    runQuery(tryoutTaxonomyReference, {
      appLocale: locale,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read signed Nakafa try-out taxonomy.",
          })
      )
    ),
  ]);
  if (!articles.managed) {
    return yield* missingInventory("article", locale);
  }
  if (!materials.managed) {
    return yield* missingInventory("material", locale);
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

/** Reads the immutable active publication identity for pinning. */
const readReleasePin = Effect.fn("agent.readReleasePin")(function* () {
  const { runQuery } = yield* QueryRunner;
  return yield* runQuery(activeReleaseReference, {}).pipe(
    Effect.mapError(
      (cause) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(cause),
          message: "Unable to read the active Nakafa content release.",
        })
    )
  );
});

/** Rejects a response assembled across different active releases. */
const verifyReleasePin = Effect.fn("agent.verifyReleasePin")(function* (
  expected: ReleasePin
) {
  const actual = yield* readReleasePin();
  if (!isSameReleasePin(actual, expected)) {
    return yield* new NakafaAgentDataReadError({
      cause: "The active Nakafa content release changed during the read.",
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  }
});

/** Compares the exact identity of two active publication reads. */
function isSameReleasePin(actual: ReleasePin, expected: ReleasePin) {
  if (actual === null || expected === null) {
    return actual === expected;
  }
  return (
    actual.manifestHash === expected.manifestHash &&
    actual.releaseId === expected.releaseId &&
    actual.sequence === expected.sequence
  );
}

/** Fails closed when a signed inventory is not currently managed. */
function missingInventory(family: string, locale: Locale) {
  return new NakafaAgentDataReadError({
    cause: `Signed ${family} inventory is unmanaged for ${locale}.`,
    message: "Unable to read signed Nakafa content inventory.",
  });
}
