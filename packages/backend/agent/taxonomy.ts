import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode as Locale,
} from "@nakafa/aksara-contracts/locale";
import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import { decodeAgentQuranCatalog } from "@repo/backend/agent/quran/publication";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { readCategoryPage } from "@repo/backend/convex/contentRelease/article/read";
import type { readArticleBuckets } from "@repo/backend/convex/contentRelease/article/sitemap";
import type { readMaterialBuckets } from "@repo/backend/convex/contentRelease/material/sitemap";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import type { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import type { readTryoutTaxonomy } from "@repo/backend/convex/contentRelease/tryout/taxonomy";
import {
  NAKAFA_AGENT_SECTIONS,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import type { PaginationOptions } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

interface CategoryArgs {
  readonly appLocale: Locale;
  readonly expectedManifestHash: null | string;
  readonly expectedReleaseId: null | string;
  readonly paginationOpts: PaginationOptions;
  readonly [key: string]: unknown;
}
type ReleasePin = {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
} | null;
interface CategoryCursor {
  readonly categories: readonly string[];
  readonly cursor: string | null;
  readonly expectedManifestHash: string | null;
  readonly expectedReleaseId: string | null;
}

const articleCategoriesReference = makeFunctionReference<
  "query",
  CategoryArgs,
  Effect.Success<ReturnType<typeof readCategoryPage>>
>("contentRelease/article:categories");

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
    const quran = yield* decodeAgentQuranCatalog(quranResult);
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
        endpoints: {
          direct: NAKAFA_MCP_DIRECT_ENDPOINT,
          recommended: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
          root_note: `${NAKAFA_MCP_INFORMATIONAL_ROOT} is informational only.`,
        },
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
  (ctx: ActionCtx, locale: Locale) =>
    readCategoryPages(ctx, locale, {
      categories: [],
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    })
);

/** Reads one bounded article-category page until the signed page is complete. */
function readCategoryPages(
  ctx: ActionCtx,
  locale: Locale,
  position: CategoryCursor
): Effect.Effect<readonly string[], NakafaAgentDataReadError> {
  return Effect.gen(function* () {
    const args: CategoryArgs = {
      appLocale: locale,
      expectedManifestHash: position.expectedManifestHash,
      expectedReleaseId: position.expectedReleaseId,
      paginationOpts: {
        cursor: position.cursor,
        numItems: PROJECTION_PAGE_LIMIT,
      },
    };
    const page = yield* readAgentQuery(
      ctx,
      articleCategoriesReference,
      args,
      "Unable to read signed Nakafa article taxonomy."
    );
    const categories = [
      ...position.categories,
      ...page.result.page.map(({ category }) => category),
    ];
    if (
      !page.managed ||
      page.stale ||
      page.activeManifestHash === null ||
      page.activeReleaseId === null
    ) {
      return yield* missingInventory("article taxonomy", locale);
    }
    if (page.result.isDone) {
      return categories;
    }
    if (page.result.continueCursor === "") {
      return yield* missingInventory("article taxonomy cursor", locale);
    }
    return yield* readCategoryPages(ctx, locale, {
      categories,
      cursor: page.result.continueCursor,
      expectedManifestHash: page.activeManifestHash,
      expectedReleaseId: page.activeReleaseId,
    });
  });
}

/** Reads every locale's signed search inventory and selected try-out values. */
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

/** Reads one locale's current article, material, and try-out counts. */
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

/** Reads the active publication identity used to pin a multi-query response. */
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

/** Compares the exact immutable identity of two active publication reads. */
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
