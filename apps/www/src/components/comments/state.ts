import type { Ref } from "@confect/core";
import type comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";

/** One comment as the lists of the content page read it: a top-level comment or a reply. */
export type CommentRow = Ref.Returns<
  typeof comments.queries.getCommentsBySlug
>["page"][number];

/** The top-level comment of the thread that a comment belongs to: the comment itself when it is top-level. */
export function threadOf(comment: Pick<CommentRow, "_id" | "threadId">) {
  return comment.threadId ?? comment._id;
}

/** The author of a comment, as the content page reads it. */
export type CommentAuthor = NonNullable<CommentRow["user"]>;

/** The fields of a comment that the optimistic changes read, in every list that holds it. */
export type ListedComment = Pick<
  CommentRow,
  "_id" | "liked" | "likeCount" | "parentId" | "replyCount" | "threadId"
>;

/** The comment as its viewer has liked it: one more like, and liked. A liked comment is returned as it is. */
export function likedComment<T extends ListedComment>(comment: T): T {
  if (comment.liked) {
    return comment;
  }
  return {
    ...comment,
    liked: true,
    likeCount: comment.likeCount + 1,
  };
}

/** The comment as its viewer has taken the like back. A comment that is not liked is returned as it is. */
export function unlikedComment<T extends ListedComment>(comment: T): T {
  if (!comment.liked) {
    return comment;
  }
  return {
    ...comment,
    liked: false,
    likeCount: comment.likeCount - 1,
  };
}

/** Changes the comment with this id on a page, and keeps every other comment as it is. */
export function changeComment<T extends ListedComment>(
  page: readonly T[],
  commentId: Id<"comments">,
  change: (comment: T) => T
) {
  return Arr.map(page, (comment) =>
    comment._id === commentId ? change(comment) : comment
  );
}

/** Moves the reply count of a top-level comment by a number of replies. */
export function countReplies<T extends ListedComment>(
  page: readonly T[],
  commentId: Id<"comments">,
  delta: number
) {
  return changeComment(page, commentId, (comment) => ({
    ...comment,
    replyCount: comment.replyCount + delta,
  }));
}

/** Takes the comments with these ids off a page, and keeps the rest in order. */
export function removeComments<T extends ListedComment>(
  page: readonly T[],
  commentIds: readonly Id<"comments">[]
) {
  return Arr.filter(
    page,
    (comment) => !Arr.some(commentIds, (id) => id === comment._id)
  );
}

/**
 * The ids of a comment and of every reply below it that is loaded: the replies
 * whose parent chain leads to the comment. A reply that is not loaded is not here,
 * because the page does not hold it.
 */
export function commentAndReplyIds<T extends ListedComment>(
  replies: readonly T[],
  commentId: Id<"comments">
): Id<"comments">[] {
  const children = Arr.filter(replies, (reply) => reply.parentId === commentId);
  return [
    commentId,
    ...Arr.flatMap(children, (child) => commentAndReplyIds(replies, child._id)),
  ];
}

/**
 * The comment a learner's post shows as, before the server answers. It sits where
 * the saved comment will sit: a top-level comment starts its own thread, and a reply
 * joins the thread of its parent.
 */
export function draftComment(
  /** The learner who posts it, whose id is the author of the comment. */
  author: CommentAuthor,
  /** The comment the learner replies to, or none for a top-level comment. */
  parent: CommentRow | null,
  /** The id the server never sees, the moment, the slug and the text of the comment. */
  comment: Pick<CommentRow, "_creationTime" | "_id" | "slug" | "text">
): CommentRow {
  const placement =
    parent === null
      ? {}
      : {
          parentId: parent._id,
          replyToUserId: parent.userId,
          threadId: threadOf(parent),
        };
  return {
    ...comment,
    likeCount: 0,
    liked: false,
    replyCount: 0,
    replyToUser: parent === null ? null : parent.user,
    user: author,
    userId: author._id,
    ...placement,
  };
}
