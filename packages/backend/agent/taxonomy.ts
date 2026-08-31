import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode as Locale,
} from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { readAgentArticleTaxonomy } from "@repo/backend/convex/contentRelease/article/agent";
import type { readArticleBuckets } from "@repo/backend/convex/contentRelease/article/sitemap";
import type { readMaterialBuckets } from "@repo/backend/convex/contentRelease/material/sitemap";
import type { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import type { readTryoutTaxonomy } from "@repo/backend/convex/contentRelease/tryout/taxonomy";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_GUIDANCE,
} from "@repo/contents/_lib/agent/constants";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

type ReleasePin = {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
} | null;

const articleCategoriesReference = makeFunctionReference<
  "query",
  { readonly appLocale: Locale },
  Effect.Success<ReturnType<typeof readAgentArticleTaxonomy>>
>("contentRelease/article/internal:readAgentTaxonomy");
const articleBucketsReference = makeFunctionReference<
  "query",
  { readonly appLocale: Locale },
  Effect.Success<ReturnType<typeof readArticleBuckets>>
>("contentRelease/article:sitemapBuckets");
const materialBucketsReference = makeFunctionReference<
  "query",
  { readonly appLocale: Locale },
  Effect.Success<ReturnType<typeof readMaterialBuckets>>
>("contentRelease/material:sitemapBuckets");
const tryoutTaxonomyReference = makeFunctionReference<
  "query",
  { readonly appLocale: Locale },
  Effect.Success<ReturnType<typeof readTryoutTaxonomy>>
>("contentRelease/tryout:taxonomy");
const quranCatalogReference = makeFunctionReference<
  "query",
  Record<string, never>,
  Effect.Success<ReturnType<typeof readQuranSurahs>>
>("contentRelease/quran:surahs");
const activeReleaseReference = makeFunctionReference<
  "query",
  Record<string, never>,
  ReleasePin
>("contentRelease/runtime/active:read");

/** Reads public taxonomy from one release-pinned signed publication. */
export const getNakafaTaxonomy = Effect.fn("agent.getNakafaTaxonomy")(
  function* (ctx: ActionCtx, locale: Locale = ACTIVE_APP_LOCALE_CODES[0]) {
    const before = yield* readReleasePin(ctx);
    const [articleCategories, inventories, quranResult] = yield* Effect.all([
      readArticleCategories(ctx, locale),
      readInventories(ctx, locale),
      readAgentQuery(
        ctx,
        quranCatalogReference,
        {},
        "Unable to read the signed Nakafa Quran catalog."
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
    yield* verifyReleasePin(ctx, before);
    return yield* decodeAgentOutput(
      NakafaAgentTaxonomySchema,
      {
        articles: { categories: articleCategories },
        content_counts: inventories.contentCounts.map((item) => ({
          ...item,
          count: item.count + quran.surahs.length,
        })),
        default_locale: ACTIVE_APP_LOCALE_CODES[0],
        endpoints: NAKAFA_MCP_GUIDANCE,
        locale,
        locales: ACTIVE_APP_LOCALE_CODES,
        quran: { surah_count: quran.surahs.length },
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
  function* (ctx: ActionCtx, locale: Locale) {
    const taxonomy = yield* readAgentQuery(
      ctx,
      articleCategoriesReference,
      { appLocale: locale },
      "Unable to read signed Nakafa article taxonomy."
    );
    if (!taxonomy.managed) {
      return yield* missingInventory("article taxonomy", locale);
    }
    return taxonomy.categories;
  }
);

/** Reads every locale inventory and the selected try-out taxonomy. */
const readInventories = Effect.fn("agent.readInventories")(function* (
  ctx: ActionCtx,
  selectedLocale: Locale
) {
  const inventories = yield* Effect.forEach(
    ACTIVE_APP_LOCALE_CODES,
    (locale) => readLocaleInventory(ctx, locale),
    { concurrency: ACTIVE_APP_LOCALE_CODES.length }
  );
  const selected = inventories.find(({ locale }) => locale === selectedLocale);
  if (!selected) {
    return yield* missingInventory("selected locale", selectedLocale);
  }
  return {
    contentCounts: inventories.map(({ count, locale }) => ({ count, locale })),
    tryout: selected.tryout,
  };
});

/** Reads one locale's article, material, and try-out inventory. */
const readLocaleInventory = Effect.fn("agent.readLocaleInventory")(function* (
  ctx: ActionCtx,
  locale: Locale
) {
  const [articles, materials, tryout] = yield* Effect.all([
    readAgentQuery(
      ctx,
      articleBucketsReference,
      { appLocale: locale },
      "Unable to read signed Nakafa article inventory."
    ),
    readAgentQuery(
      ctx,
      materialBucketsReference,
      { appLocale: locale },
      "Unable to read signed Nakafa material inventory."
    ),
    readAgentQuery(
      ctx,
      tryoutTaxonomyReference,
      { appLocale: locale },
      "Unable to read signed Nakafa try-out taxonomy."
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
    tryout: { countries: tryout.countries, exams: tryout.exams },
  };
});

/** Reads the immutable active publication identity for pinning. */
function readReleasePin(ctx: ActionCtx) {
  return readAgentQuery(
    ctx,
    activeReleaseReference,
    {},
    "Unable to read the active Nakafa content release."
  );
}

/** Rejects a response assembled across different active releases. */
const verifyReleasePin = Effect.fn("agent.verifyReleasePin")(function* (
  ctx: ActionCtx,
  expected: ReleasePin
) {
  const actual = yield* readReleasePin(ctx);
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
