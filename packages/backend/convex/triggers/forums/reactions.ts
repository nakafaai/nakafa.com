import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for schoolClassForumReactions table changes.
 *
 * Maintains denormalized reaction counts on forums:
 * - On insert: Increments count for the emoji, or adds new emoji entry
 * - On delete: Decrements count, removes emoji if count reaches zero
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function forumReactionsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "schoolClassForumReactions">
) {
  const reaction = change.newDoc;
  const oldReaction = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!reaction) {
        break;
      }

      const forum = await ctx.db.get("schoolClassForums", reaction.forumId);
      if (forum) {
        const reactionCounts = [...forum.reactionCounts];
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

        await ctx.db.patch("schoolClassForums", reaction.forumId, {
          reactionCounts,
        });
      }
      break;
    }

    case "delete": {
      if (!oldReaction) {
        break;
      }

      const forum = await ctx.db.get("schoolClassForums", oldReaction.forumId);
      if (forum) {
        const reactionCounts = [...forum.reactionCounts];
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
          await ctx.db.patch("schoolClassForums", oldReaction.forumId, {
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
