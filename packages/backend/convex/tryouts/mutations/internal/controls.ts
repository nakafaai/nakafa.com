import { internalMutation } from "@repo/backend/convex/functions";
import { repairUserTryoutControl } from "@repo/backend/convex/tryouts/helpers/control";
import { v } from "convex/values";

/** Repairs one user's control row and one bounded batch of duplicates. */
export const repairOneUserTryoutControl = internalMutation({
  args: {
    updatedAt: v.number(),
    userId: v.id("users"),
  },
  returns: v.object({
    controlId: v.union(v.id("userTryoutControls"), v.null()),
    controlsCreated: v.number(),
    duplicatesDeleted: v.number(),
    hasMoreDuplicates: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await repairUserTryoutControl(ctx.db, args);
  },
});
