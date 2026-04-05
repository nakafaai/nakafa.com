import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const userTryoutControlIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  duplicateControlUserCount: v.number(),
  isDone: v.boolean(),
  missingControlUserCount: v.number(),
  userIdsNeedingRepair: v.array(v.id("users")),
  usersScanned: v.number(),
});

/**
 * Returns integrity totals for one bounded page of users.
 *
 * Operator scripts aggregate these page summaries client-side so verification
 * stays bounded as the user table grows.
 */
export const getUserTryoutControlIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: userTryoutControlIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").paginate(args.paginationOpts);
    let duplicateControlUserCount = 0;
    let missingControlUserCount = 0;
    const userIdsNeedingRepair: Id<"users">[] = [];

    for (const user of users.page) {
      const controls = await ctx.db
        .query("userTryoutControls")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(2);
      const isMissingControl = controls.length === 0;
      const hasDuplicateControls = controls.length === 2;

      if (isMissingControl) {
        missingControlUserCount += 1;
      }

      if (hasDuplicateControls) {
        duplicateControlUserCount += 1;
      }

      if (isMissingControl || hasDuplicateControls) {
        userIdsNeedingRepair.push(user._id);
      }
    }

    return {
      continueCursor: users.continueCursor,
      duplicateControlUserCount,
      isDone: users.isDone,
      missingControlUserCount,
      userIdsNeedingRepair,
      usersScanned: users.page.length,
    };
  },
});
