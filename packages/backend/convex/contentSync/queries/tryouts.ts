import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getActiveTryoutsWithoutScale } from "@repo/backend/convex/irt/scales/read";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { type Infer, v } from "convex/values";

const tryoutScaleIntegrityItemValidator = v.object({
  cycleKey: v.string(),
  locale: localeValidator,
  product: tryoutProductValidator,
  slug: v.string(),
});

type TryoutScaleIntegrityItem = Infer<typeof tryoutScaleIntegrityItemValidator>;

export const getTryoutScaleIntegrity = internalQuery({
  args: {},
  returns: v.object({
    activeTryoutsWithoutScale: v.array(tryoutScaleIntegrityItemValidator),
  }),
  handler: async (ctx) => {
    const tryoutsWithoutScale = await getActiveTryoutsWithoutScale(ctx.db);
    const activeTryoutsWithoutScale: TryoutScaleIntegrityItem[] =
      tryoutsWithoutScale.map((tryout) => ({
        cycleKey: tryout.cycleKey,
        locale: tryout.locale,
        product: tryout.product,
        slug: tryout.slug,
      }));

    return { activeTryoutsWithoutScale };
  },
});
