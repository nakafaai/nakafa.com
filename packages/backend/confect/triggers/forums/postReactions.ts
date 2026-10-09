import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Array as Arr, Effect, Match, Option } from "effect";

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
  yield* Match.value(change).pipe(
    Match.discriminators("operation")({
      insert: (insertion) =>
        Effect.gen(function* () {
          const reaction = insertion.newDoc;
          const post = yield* database
            .table("schoolClassForumPosts")
            .get(reaction.postId);
          let reactionCounts = [...post.reactionCounts];
          const existingIndex = Option.getOrElse(
            Arr.findFirstIndex(
              reactionCounts,
              (r) => r.emoji === reaction.emoji
            ),
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
          yield* writer.table("schoolClassForumPosts").patch(reaction.postId, {
            reactionCounts,
          });
        }),
      delete: (deletion) =>
        Effect.gen(function* () {
          const oldReaction = deletion.oldDoc;
          const post = yield* database
            .table("schoolClassForumPosts")
            .get(oldReaction.postId)
            .pipe(
              Effect.catchTag("GetByIdFailure", () => Effect.succeed(null))
            );
          if (post) {
            const reactionCounts = [...post.reactionCounts];
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
              yield* writer
                .table("schoolClassForumPosts")
                .patch(oldReaction.postId, {
                  reactionCounts: remaining,
                });
            }
          }
        }),
    }),
    Match.orElse(() => Effect.void)
  );
}, Effect.orDie);
