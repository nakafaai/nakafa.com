import type { Id } from "@repo/backend/confect/_generated/id";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type CommentDoc,
  findComment,
} from "@repo/backend/confect/comments/rows";
import { Effect } from "effect";

/**
 * The top-level comment of the thread that a comment belongs to, which is the
 * comment itself when it is top-level. A reply names it in `threadId`. A reply
 * written before the thread migration has no `threadId`, so this walks up its
 * parents until one names it. A parent that is gone makes the comment the top of
 * its own thread, as the migration makes it top-level.
 */
export const threadOf: (
  comment: CommentDoc
) => Effect.Effect<Id<"comments">, never, DatabaseReader> = Effect.fn(
  "comments.thread.threadOf"
)(function* (comment) {
  if (comment.parentId === undefined) {
    return comment._id;
  }
  if (comment.threadId !== undefined) {
    return comment.threadId;
  }
  const parent = yield* findComment(comment.parentId);
  if (parent === null) {
    return comment._id;
  }
  return yield* threadOf(parent);
});
