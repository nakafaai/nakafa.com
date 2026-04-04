import { query } from "@repo/backend/convex/_generated/server";
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

const activeTryoutCatalogEntryValidator = v.object({
  cycleKey: vv.doc("tryoutCatalogEntries").fields.cycleKey,
  label: vv.doc("tryoutCatalogEntries").fields.label,
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

/** Returns one ordered page of global active tryout catalog rows. */
export const getActiveTryoutCatalogPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: paginationResultValidator(activeTryoutCatalogEntryValidator),
  handler: async (ctx, args) => {
    const catalogPage = await ctx.db
      .query("tryoutCatalogEntries")
      .withIndex("by_product_and_locale_and_isActive_and_catalogSortKey", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .paginate(args.paginationOpts);

    return {
      ...catalogPage,
      page: catalogPage.page.map((entry) => ({
        cycleKey: entry.cycleKey,
        label: entry.label,
        partCount: entry.partCount,
        slug: entry.slug,
        totalQuestionCount: entry.totalQuestionCount,
        tryoutId: entry.tryoutId,
      })),
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
