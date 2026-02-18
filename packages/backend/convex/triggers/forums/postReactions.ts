import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClassForumPostReactions table changes.
 *
 * Maintains denormalized reaction counts on forum posts:
 * - On insert: Increments count for the emoji, or adds new emoji entry
 * - On delete: Decrements count, removes emoji if count reaches zero
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function postReactionsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassForumPostReactions">
) {
  const reaction = change.newDoc;
  const oldReaction = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!reaction) {
        break;
      }

      const post = await ctx.db.get("schoolClassForumPosts", reaction.postId);
      if (post) {
        const reactionCounts = [...post.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === reaction.emoji
        );

        if (existingIndex >= 0) {
          reactionCounts[existingIndex] = {
            emoji: reaction.emoji,
            count: reactionCounts[existingIndex].count + 1,
          };
        } else {
          reactionCounts.push({ emoji: reaction.emoji, count: 1 });
        }

        await ctx.db.patch("schoolClassForumPosts", reaction.postId, {
          reactionCounts,
        });
      }
      break;
    }

    case "delete": {
      if (!oldReaction) {
        break;
      }

      const post = await ctx.db.get(
        "schoolClassForumPosts",
        oldReaction.postId
      );
      if (post) {
        const reactionCounts = [...post.reactionCounts];
        const existingIndex = reactionCounts.findIndex(
          (r) => r.emoji === oldReaction.emoji
        );

        if (existingIndex >= 0) {
          const newCount = reactionCounts[existingIndex].count - 1;
          if (newCount <= 0) {
            reactionCounts.splice(existingIndex, 1);
          } else {
            reactionCounts[existingIndex] = {
              emoji: oldReaction.emoji,
              count: newCount,
            };
          }
          await ctx.db.patch("schoolClassForumPosts", oldReaction.postId, {
            reactionCounts,
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
}
