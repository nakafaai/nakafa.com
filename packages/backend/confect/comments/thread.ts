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

/**
 * The comment a reply hangs from once the top-level comment of its thread is gone
 * and that comment's own replies stand as top-level comments: the first comment up
 * its chain of parents that has no parent. A reply with no parent, or with a parent
 * that is gone on the way, is the top of its own thread.
 */
export const rootAfterPromotion: (
  comment: CommentDoc
) => Effect.Effect<CommentDoc, never, DatabaseReader> = Effect.fn(
  "comments.thread.rootAfterPromotion"
)(function* (comment) {
  if (comment.parentId === undefined) {
    return comment;
  }
  const parent = yield* findComment(comment.parentId);
  if (parent === null) {
    return comment;
  }
  if (parent.parentId === undefined) {
    return parent;
  }
  return yield* rootAfterPromotion(parent);
});
