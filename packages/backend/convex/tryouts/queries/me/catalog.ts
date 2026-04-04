import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  userTryoutCatalogStatusesArgs,
  userTryoutCatalogStatusesResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";

/** Returns the authenticated user's hub badge summary for the requested tryout ids. */
export const getMyTryoutCatalogStatuses = query({
  args: userTryoutCatalogStatusesArgs,
  returns: userTryoutCatalogStatusesResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const uniqueTryoutIds = [...new Set(args.tryoutIds)];

    if (uniqueTryoutIds.length === 0) {
      return {
        statusesBySlug: {},
      };
    }

    const latestAttempts = await Promise.all(
      uniqueTryoutIds.map((tryoutId) => {
        return ctx.db
          .query("userTryoutLatestAttempts")
          .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
            q
              .eq("userId", appUser._id)
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("tryoutId", tryoutId)
          )
          .unique();
      })
    );

    return {
      statusesBySlug: Object.fromEntries(
        latestAttempts.flatMap((latestAttempt) =>
          latestAttempt
            ? [
                [
                  latestAttempt.slug,
                  {
                    expiresAtMs: latestAttempt.expiresAtMs,
                    status: latestAttempt.status,
                    updatedAt: latestAttempt.updatedAt,
                  },
                ],
              ]
            : []
        )
      ),
    };
  },
});
