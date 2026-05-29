import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Duration, Effect } from "effect";

const COMMENT_VOTE_CLEANUP_BATCH_SIZE = 100;
const COMMENT_REPLY_CLEANUP_BATCH_SIZE = 100;

/** Removes votes and replies after a comment row has been deleted. */
export const cleanupDeletedComment = Effect.fnUntraced(function* (args: {
  commentId: Id<"comments">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const votes = yield* reader
    .table("commentVotes")
    .index("by_commentId_and_userId", (query) =>
      query.eq("commentId", args.commentId)
    )
    .take(COMMENT_VOTE_CLEANUP_BATCH_SIZE);

  for (const vote of votes) {
    yield* writer.table("commentVotes").delete(vote._id);
  }

  if (votes.length === COMMENT_VOTE_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
      args
    );
    return null;
  }

  const replies = yield* reader
    .table("comments")
    .index("by_parentId", (query) => query.eq("parentId", args.commentId))
    .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE);

  for (const reply of replies) {
    yield* writer.table("comments").delete(reply._id);
  }

  if (replies.length === COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.comments.cleanup.cleanupDeletedComment,
      args
    );
  }

  return null;
});
