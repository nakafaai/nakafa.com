import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import {
  tryoutPackageLookupValidator,
  tryoutPackageStatusValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { ConvexError, v } from "convex/values";

const MAX_TRYOUT_STATUS_REQUESTS = 100;
const MAX_USER_TRYOUT_STATUS_ROWS = 500;

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
    const latestAttempts = await ctx.db
      .query("userTryoutLatestAttempts")
      .withIndex("by_userId_and_product_and_locale_and_updatedAt", (q) =>
        q
          .eq("userId", appUser._id)
          .eq("product", args.product)
          .eq("locale", args.locale)
      )
      .order("desc")
      .take(MAX_USER_TRYOUT_STATUS_ROWS + 1);

    if (latestAttempts.length > MAX_USER_TRYOUT_STATUS_ROWS) {
      throw new ConvexError({
        code: "TOO_MANY_USER_TRYOUT_STATUSES",
        message:
          "Tryout package status query exceeded the supported user scan limit.",
      });
    }

    const latestAttemptByTryoutId = new Map(
      latestAttempts.map((attempt) => [attempt.tryoutId, attempt])
    );

    if (latestAttemptByTryoutId.size !== latestAttempts.length) {
      throw new ConvexError({
        code: "INVALID_LATEST_ATTEMPT_PROJECTION",
        message:
          "Latest tryout attempt projection contains duplicate tryout rows.",
      });
    }

    return requestedTryoutPackages.flatMap(({ slug, tryoutId }) => {
      const latestAttempt = latestAttemptByTryoutId.get(tryoutId);

      if (!latestAttempt) {
        return [];
      }

      return [
        {
          expiresAtMs: latestAttempt.expiresAtMs,
          slug,
          status: latestAttempt.status,
        },
      ];
    });
  },
});
