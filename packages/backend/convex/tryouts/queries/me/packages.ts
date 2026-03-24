import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { loadLatestUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  TRYOUT_STATUS_BATCH_SIZE,
  tryoutPackageStatusValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { type Infer, v } from "convex/values";

/** Returns the authenticated user's latest status for the requested tryout slugs. */
export const getUserTryoutPackageStatuses = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    tryoutSlugs: v.array(v.string()),
  },
  returns: v.array(tryoutPackageStatusValidator),
  handler: async (ctx, args) => {
    if (args.tryoutSlugs.length === 0) {
      return [];
    }

    const { appUser } = await requireAuth(ctx);
    const requestedTryoutSlugs = [...new Set(args.tryoutSlugs)];
    const statuses: Array<Infer<typeof tryoutPackageStatusValidator> | null> =
      [];

    for (
      let startIndex = 0;
      startIndex < requestedTryoutSlugs.length;
      startIndex += TRYOUT_STATUS_BATCH_SIZE
    ) {
      const slugBatch = requestedTryoutSlugs.slice(
        startIndex,
        startIndex + TRYOUT_STATUS_BATCH_SIZE
      );
      const batchStatuses = await Promise.all(
        slugBatch.map(async (tryoutSlug) => {
          const context = await loadLatestUserTryoutContext(ctx, {
            locale: args.locale,
            product: args.product,
            tryoutSlug,
            userId: appUser._id,
          });

          if (!context) {
            return null;
          }

          const { attempt } = context;

          return {
            expiresAtMs: attempt.expiresAt,
            slug: tryoutSlug,
            status: attempt.status,
          };
        })
      );

      statuses.push(...batchStatuses);
    }

    return statuses.filter((status) => status !== null);
  },
});
