import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Array as Arr, Effect, Option } from "effect";

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
export const forumReactionsHandler = Effect.fn(
  "triggers.forums.reactions.forumReactionsHandler"
)(function* (change: Change<DataModel, "schoolClassForumReactions">) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  switch (change.operation) {
    case "insert": {
      const reaction = change.newDoc;
      const forum = yield* database
        .table("schoolClassForums")
        .get(reaction.forumId);
      let reactionCounts = [...forum.reactionCounts];
      const existingIndex = Option.getOrElse(
        Arr.findFirstIndex(reactionCounts, (r) => r.emoji === reaction.emoji),
        () => -1
      );
      if (existingIndex >= 0) {
        reactionCounts[existingIndex] = {
          emoji: reaction.emoji,
          count: reactionCounts[existingIndex].count + 1,
        };
      } else {
        reactionCounts = Arr.append(reactionCounts, {
          emoji: reaction.emoji,
          count: 1,
        });
      }
      yield* writer.table("schoolClassForums").patch(reaction.forumId, {
        reactionCounts,
      });
      break;
    }
    case "delete": {
      const oldReaction = change.oldDoc;
      const forum = yield* database
        .table("schoolClassForums")
        .get(oldReaction.forumId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
      if (forum) {
        const reactionCounts = [...forum.reactionCounts];
        const existingIndex = Option.getOrElse(
          Arr.findFirstIndex(
            reactionCounts,
            (r) => r.emoji === oldReaction.emoji
          ),
          () => -1
        );
        if (existingIndex >= 0) {
          const newCount = reactionCounts[existingIndex].count - 1;
          const before = Arr.take(reactionCounts, existingIndex);
          const after = Arr.drop(reactionCounts, existingIndex + 1);
          const remaining =
            newCount <= 0
              ? Arr.appendAll(before, after)
              : Arr.appendAll(
                  Arr.append(before, {
                    emoji: oldReaction.emoji,
                    count: newCount,
                  }),
                  after
                );
          yield* writer.table("schoolClassForums").patch(oldReaction.forumId, {
            reactionCounts: remaining,
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
