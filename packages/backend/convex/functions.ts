import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
import type { DataModel } from "./_generated/dataModel";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "./_generated/server";

const triggers = new Triggers<DataModel>();

export { triggers };

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));

export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// This is a trigger that deletes all votes and replies when a comment is deleted.
triggers.register("comments", async (ctx, change) => {
  if (change.operation !== "delete") {
    return;
  }

  const votes = await ctx.db
    .query("commentVotes")
    .withIndex("commentId", (q) => q.eq("commentId", change.id))
    .collect();

  for (const vote of votes) {
    await ctx.db.delete(vote._id);
  }

  const replies = await ctx.db
    .query("comments")
    .withIndex("parentId", (q) => q.eq("parentId", change.id))
    .collect();

  for (const reply of replies) {
    await ctx.db.delete(reply._id);
  }

  if (change.oldDoc.parentId) {
    const parentComment = await ctx.db.get(change.oldDoc.parentId);
    if (parentComment) {
      await ctx.db.patch(change.oldDoc.parentId, {
        replyCount: Math.max(parentComment.replyCount - 1, 0),
      });
    }
  }
});
