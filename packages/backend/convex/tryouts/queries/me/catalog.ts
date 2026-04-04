import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  userTryoutCatalogStatusesArgs,
  userTryoutCatalogStatusesResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";

/** Returns the authenticated user's hub badge summary for one product and locale. */
export const getMyTryoutCatalogStatuses = query({
  args: userTryoutCatalogStatusesArgs,
  returns: userTryoutCatalogStatusesResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const catalogStatuses = await ctx.db
      .query("userTryoutCatalogStatuses")
      .withIndex("by_userId_and_product_and_locale", (q) =>
        q
          .eq("userId", appUser._id)
          .eq("product", args.product)
          .eq("locale", args.locale)
      )
      .unique();

    return {
      statusesBySlug: catalogStatuses?.statusesBySlug ?? {},
    };
  },
});
