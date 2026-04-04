import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_CATALOG_PAGE_SIZE = 25;

const tryoutCatalogLatestAttemptValidator = v.union(
  v.object({
    expiresAtMs: vv.doc("userTryoutLatestAttempts").fields.expiresAtMs,
    status: vv.doc("userTryoutLatestAttempts").fields.status,
    updatedAt: vv.doc("userTryoutLatestAttempts").fields.updatedAt,
  }),
  v.null()
);

const activeTryoutCatalogEntryValidator = v.object({
  cycleKey: vv.doc("tryoutCatalogEntries").fields.cycleKey,
  label: vv.doc("tryoutCatalogEntries").fields.label,
  latestAttempt: tryoutCatalogLatestAttemptValidator,
  partCount: vv.doc("tryoutCatalogEntries").fields.partCount,
  slug: vv.doc("tryoutCatalogEntries").fields.slug,
  totalQuestionCount: vv.doc("tryoutCatalogEntries").fields.totalQuestionCount,
  tryoutId: vv.doc("tryoutCatalogEntries").fields.tryoutId,
});

const activeTryoutCatalogMetaValidator = v.object({
  activeCount: v.number(),
});

/** Returns the exact active catalog count for one product and locale. */
export const getActiveTryoutCatalogMeta = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: activeTryoutCatalogMetaValidator,
  handler: async (ctx, args) => {
    const catalogMeta = await ctx.db
      .query("tryoutCatalogMeta")
      .withIndex("by_product_and_locale", (q) =>
        q.eq("product", args.product).eq("locale", args.locale)
      )
      .unique();

    return {
      activeCount: catalogMeta?.activeCount ?? 0,
    };
  },
});

/** Returns one ordered page of active tryout catalog rows with page-local latest badges. */
export const getActiveTryoutCatalogPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: paginationResultValidator(activeTryoutCatalogEntryValidator),
  handler: async (ctx, args) => {
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(
        args.paginationOpts.numItems,
        MAX_TRYOUT_CATALOG_PAGE_SIZE
      ),
    };
    const [catalogPage, user] = await Promise.all([
      ctx.db
        .query("tryoutCatalogEntries")
        .withIndex(
          "by_product_and_locale_and_isActive_and_catalogSortKey",
          (q) =>
            q
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("isActive", true)
        )
        .paginate(paginationOpts),
      getOptionalAppUser(ctx),
    ]);

    if (!user) {
      return {
        ...catalogPage,
        page: catalogPage.page.map((entry) => ({
          cycleKey: entry.cycleKey,
          label: entry.label,
          latestAttempt: null,
          partCount: entry.partCount,
          slug: entry.slug,
          totalQuestionCount: entry.totalQuestionCount,
          tryoutId: entry.tryoutId,
        })),
      };
    }

    const latestAttempts = await Promise.all(
      catalogPage.page.map((entry) => {
        return ctx.db
          .query("userTryoutLatestAttempts")
          .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
            q
              .eq("userId", user.appUser._id)
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("tryoutId", entry.tryoutId)
          )
          .unique();
      })
    );

    return {
      ...catalogPage,
      page: catalogPage.page.map((entry, index) => {
        const latestAttempt = latestAttempts[index];

        return {
          cycleKey: entry.cycleKey,
          label: entry.label,
          latestAttempt: latestAttempt
            ? {
                expiresAtMs: latestAttempt.expiresAtMs,
                status: latestAttempt.status,
                updatedAt: latestAttempt.updatedAt,
              }
            : null,
          partCount: entry.partCount,
          slug: entry.slug,
          totalQuestionCount: entry.totalQuestionCount,
          tryoutId: entry.tryoutId,
        };
      }),
    };
  },
});

/** Loads one tryout plus its ordered part-set metadata. */
export const getTryoutDetails = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    slug: v.string(),
  },
  returns: vv.nullable(
    v.object({
      tryout: vv.doc("tryouts"),
      parts: v.array(
        v.object({
          partIndex: v.number(),
          partKey: tryoutPartKeyValidator,
          setId: vv.id("exerciseSets"),
          material: v.string(),
          questionCount: v.number(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const tryout = await ctx.db
      .query("tryouts")
      .withIndex("by_product_and_locale_and_slug", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("slug", args.slug)
      )
      .unique();

    if (!tryout) {
      return null;
    }

    const tryoutPartSets = await loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });

    const sets = await getAll(
      ctx.db,
      "exerciseSets",
      tryoutPartSets.map((partSet) => partSet.setId)
    );

    const parts = tryoutPartSets.map((partSet, index) => {
      const set = sets[index];

      if (!set) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing one of its part sets.",
        });
      }

      return {
        partIndex: partSet.partIndex,
        partKey: partSet.partKey,
        setId: partSet.setId,
        material: set.material,
        questionCount: set.questionCount,
      };
    });

    return { tryout, parts };
  },
});
