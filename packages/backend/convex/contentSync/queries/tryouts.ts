import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { paginationOptsValidator } from "convex/server";
import { type Infer, v } from "convex/values";

const tryoutScaleIntegrityItemValidator = v.object({
  cycleKey: v.string(),
  locale: localeValidator,
  product: tryoutProductValidator,
  slug: v.string(),
});

type TryoutScaleIntegrityItem = Infer<typeof tryoutScaleIntegrityItemValidator>;

/** Return active tryouts that still do not have a published frozen scale. */
export const getTryoutScaleIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    page: v.array(tryoutScaleIntegrityItemValidator),
  }),
  handler: async (ctx, args) => {
    const tryoutPage = await ctx.db
      .query("tryouts")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .paginate(args.paginationOpts);
    const activeTryoutsWithoutScale: TryoutScaleIntegrityItem[] = [];

    for (const tryout of tryoutPage.page) {
      const scaleVersion = await getLatestScaleVersionForTryout(
        ctx.db,
        tryout._id
      );

      if (scaleVersion) {
        continue;
      }

      activeTryoutsWithoutScale.push({
        cycleKey: tryout.cycleKey,
        locale: tryout.locale,
        product: tryout.product,
        slug: tryout.slug,
      });
    }

    return {
      continueCursor: tryoutPage.continueCursor,
      isDone: tryoutPage.isDone,
      page: activeTryoutsWithoutScale,
    };
  },
});
