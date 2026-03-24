import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  sortTryoutsForProduct,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_ACTIVE_TRYOUTS_PER_PRODUCT = 100;

/** Lists active tryouts for one product and locale. */
export const getActiveTryouts = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: v.array(vv.doc("tryouts")),
  handler: async (ctx, args) => {
    const tryouts = await ctx.db
      .query("tryouts")
      .withIndex("by_product_and_locale_and_isActive", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("isActive", true)
      )
      .take(MAX_ACTIVE_TRYOUTS_PER_PRODUCT + 1);

    if (tryouts.length > MAX_ACTIVE_TRYOUTS_PER_PRODUCT) {
      throw new ConvexError({
        code: "TOO_MANY_ACTIVE_TRYOUTS",
        message: "Active tryout list exceeded the supported query limit.",
      });
    }

    return sortTryoutsForProduct(args.product, tryouts);
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

    const tryoutPartSets = await ctx.db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partIndex", (q) =>
        q.eq("tryoutId", tryout._id)
      )
      .take(tryout.partCount + 1);

    if (tryoutPartSets.length !== tryout.partCount) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout part mapping count does not match partCount.",
      });
    }

    for (const [partIndex, partSet] of tryoutPartSets.entries()) {
      if (partSet.partIndex === partIndex) {
        continue;
      }

      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout part mappings are out of order.",
      });
    }

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
