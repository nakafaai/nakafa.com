import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CommentWriteError } from "@repo/backend/confect/comments/errors";
import type { CommentPost } from "@repo/backend/confect/comments/mutations.spec";
import { findComment } from "@repo/backend/confect/comments/rows";
import {
  readCommentText,
  TEXT_REFUSAL_MESSAGE,
} from "@repo/backend/confect/comments/text";
import { threadOf } from "@repo/backend/confect/comments/thread";
import { noticeReply } from "@repo/backend/confect/notifications/reply";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Clock, Effect, Option, Result, Struct } from "effect";

/**
 * Turns a learner's unposted photos into the photos of the comment they post: each upload leaves its
 * table, and its photo moves onto the comment. A photo that is gone, or that another learner uploaded,
 * stops the post.
 */
const takeUploads = Effect.fn("comments.post.takeUploads")(function* (
  userId: GenericId.GenericId<"users">,
  uploadIds: readonly GenericId.GenericId<"commentUploads">[]
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  return yield* Effect.forEach(Arr.dedupe(uploadIds), (uploadId) =>
    Effect.gen(function* () {
      const upload = yield* reader
        .table("commentUploads")
        .get(uploadId)
        .pipe(Effect.option);
      if (Option.isNone(upload) || upload.value.userId !== userId) {
        return yield* new CommentWriteError({
          code: "COMMENT_UPLOAD_GONE",
          message: "A photo of the comment is gone.",
        });
      }
      yield* writer.table("commentUploads").delete(uploadId).pipe(Effect.orDie);
      return Struct.omit(upload.value, [
        "_creationTime",
        "_id",
        "createdAt",
        "userId",
      ]);
    })
  );
});

/** The comment a reply answers, which must stand on the same page. A top-level comment answers none. */
const readParent = Effect.fn("comments.post.readParent")(function* (
  parentId: GenericId.GenericId<"comments"> | undefined,
  slug: string
) {
  if (parentId === undefined) {
    return null;
  }
  const parent = yield* findComment(parentId);
  if (parent === null) {
    return yield* new CommentWriteError({
      code: "COMMENT_PARENT_NOT_FOUND",
      message: "Reply parent not found.",
    });
  }
  if (parent.slug !== slug) {
    return yield* new CommentWriteError({
      code: "COMMENT_PARENT_MISMATCH",
      message: "Reply parent must belong to the same slug.",
    });
  }
  return parent;
});

/**
 * Adds a top-level comment or a reply. A reply names its parent and the top-level comment of its thread,
 * so every reply, also a reply to a reply, sits in one thread and names whom it answers. The author of the
 * parent gets one inbox row for the reply, unless they wrote it. The trigger counts the comment on its page
 * and in its thread.
 */
export const postComment = Effect.fn("comments.post")(function* (
  userId: GenericId.GenericId<"users">,
  post: typeof CommentPost.Type
) {
  const text = readCommentText(post.text, post.uploads.length);
  if (Result.isFailure(text)) {
    return yield* new CommentWriteError({
      code: text.failure,
      message: TEXT_REFUSAL_MESSAGE,
    });
  }
  const slug = cleanSlug(post.slug);
  const parent = yield* readParent(post.parentId, slug);
  const photos = yield* takeUploads(userId, post.uploads);
  const commentId = yield* (yield* DatabaseWriter)
    .table("comments")
    .insert({
      likeCount: 0,
      replyCount: 0,
      slug,
      text: text.success,
      userId,
      ...(Arr.isReadonlyArrayNonEmpty(photos) ? { photos } : {}),
      ...(parent === null
        ? {}
        : {
            parentId: parent._id,
            replyToUserId: parent.userId,
            threadId: threadOf(parent),
          }),
    })
    .pipe(Effect.orDie);
  if (parent !== null && parent.userId !== userId) {
    yield* noticeReply(
      commentId,
      parent.userId,
      yield* Clock.currentTimeMillis
    );
  }
  return commentId;
});
