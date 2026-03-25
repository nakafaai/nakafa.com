import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  MAX_TRYOUT_STATUS_REQUESTS,
  TRYOUT_STATUS_BATCH_SIZE,
} from "@repo/backend/convex/tryouts/queries/me/constants";
import {
  tryoutPackageLookupValidator,
  tryoutPackageStatusValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { type Infer, v } from "convex/values";

/** Returns the authenticated user's latest status for the requested tryout packages. */
export const getUserTryoutPackageStatuses = query({
  args: {
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
    const statuses: Array<Infer<typeof tryoutPackageStatusValidator> | null> =
      [];

    for (
      let startIndex = 0;
      startIndex < requestedTryoutPackages.length;
      startIndex += TRYOUT_STATUS_BATCH_SIZE
    ) {
      const packageBatch = requestedTryoutPackages.slice(
        startIndex,
        startIndex + TRYOUT_STATUS_BATCH_SIZE
      );
      const batchStatuses = await Promise.all(
        packageBatch.map(async ({ slug, tryoutId }) => {
          const attempt = await ctx.db
            .query("tryoutAttempts")
            .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
              q.eq("userId", appUser._id).eq("tryoutId", tryoutId)
            )
            .order("desc")
            .first();

          if (!attempt) {
            return null;
          }

          return {
            expiresAtMs: attempt.expiresAt,
            slug,
            status: attempt.status,
          };
        })
      );

      statuses.push(...batchStatuses);
    }

    return statuses.filter((status) => status !== null);
  },
});
