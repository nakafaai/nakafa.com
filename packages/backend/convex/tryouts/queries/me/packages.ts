import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";

const MAX_TRYOUT_STATUS_REQUESTS = 100;

import {
  tryoutPackageLookupValidator,
  tryoutPackageStatusValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { type Infer, v } from "convex/values";

/** Returns the authenticated user's latest status for the requested tryout packages. */
export const getUserTryoutPackageStatuses = query({
  args: {
    locale: localeValidator,
    product: tryoutProductValidator,
    tryoutPackages: v.array(tryoutPackageLookupValidator),
  },
  returns: v.array(tryoutPackageStatusValidator),
  handler: async (ctx, args) => {
    if (args.tryoutPackages.length === 0) {
      return [];
    }

    const { appUser } = await requireAuth(ctx);
    const requestedTryoutPackages = Array.from(
      new Map(
        args.tryoutPackages.map((tryoutPackage) => [
          tryoutPackage.tryoutId,
          tryoutPackage,
        ])
      ).values()
    ).slice(0, MAX_TRYOUT_STATUS_REQUESTS);
    const statuses = await Promise.all(
      requestedTryoutPackages.map(async ({ slug, tryoutId }) => {
        const latestAttempt = await ctx.db
          .query("userTryoutLatestAttempts")
          .withIndex("by_userId_and_product_and_locale_and_tryoutId", (q) =>
            q
              .eq("userId", appUser._id)
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("tryoutId", tryoutId)
          )
          .unique();

        if (!latestAttempt) {
          return null;
        }

        return {
          expiresAtMs: latestAttempt.expiresAtMs,
          slug,
          status: latestAttempt.status,
        } satisfies Infer<typeof tryoutPackageStatusValidator>;
      })
    );

    return statuses.filter((status) => status !== null);
  },
});
