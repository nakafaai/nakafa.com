import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  createUserTryoutControl,
  getUserTryoutControl,
} from "@repo/backend/convex/tryouts/helpers/control";
import { v } from "convex/values";

const USER_TRYOUT_CONTROL_REPAIR_PAGE_SIZE = 100;

/**
 * Rebuilds missing user tryout control rows in bounded scheduled pages.
 *
 * This is an operator-facing integrity repair path for environments that need to
 * reconcile existing users with the dedicated `userTryoutControls` owner table.
 */
export const repairUserTryoutControls = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userPage = await ctx.db.query("users").paginate({
      cursor: args.cursor ?? null,
      numItems: USER_TRYOUT_CONTROL_REPAIR_PAGE_SIZE,
    });

    for (const user of userPage.page) {
      const existingControl = await getUserTryoutControl(ctx.db, user._id);

      if (existingControl) {
        continue;
      }

      await createUserTryoutControl(ctx.db, {
        updatedAt: user._creationTime,
        userId: user._id,
      });
    }

    if (userPage.isDone) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.mutations.internal.controls.repairUserTryoutControls,
      {
        cursor: userPage.continueCursor,
      }
    );

    return null;
  },
});
