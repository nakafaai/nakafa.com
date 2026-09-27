import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

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
export const postReactionsHandler = Effect.fn(
  "triggers.forums.postReactions.postReactionsHandler"
)(function* (change: Change<DataModel, "schoolClassForumPostReactions">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  switch (change.operation) {
    case "insert": {
      const reaction = change.newDoc;
      const post = yield* database
        .table("schoolClassForumPosts")
        .get(reaction.postId);
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
        reactionCounts.push({
          emoji: reaction.emoji,
          count: 1,
        });
      }
      yield* writer.table("schoolClassForumPosts").patch(reaction.postId, {
        reactionCounts,
      });
      break;
    }
    case "delete": {
      const oldReaction = change.oldDoc;
      const post = yield* database
        .table("schoolClassForumPosts")
        .get(oldReaction.postId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
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
          yield* writer
            .table("schoolClassForumPosts")
            .patch(oldReaction.postId, {
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
}, Effect.orDie);
