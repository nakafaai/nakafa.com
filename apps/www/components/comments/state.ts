import type { Ref } from "@confect/core";
import type comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";

type Comment = Ref.Returns<
  typeof comments.queries.getCommentsByUserId
>["page"][number];
type Vote = -1 | 0 | 1;

/** Apply a final viewer vote and its denormalized count changes immutably. */
export function updateCommentVote<T extends Comment>(
  comment: T,
  vote: Vote
): T {
  const previous = comment.viewerVote;
  const upvoteCount = Math.max(
    0,
    comment.upvoteCount - (previous === 1 ? 1 : 0) + (vote === 1 ? 1 : 0)
  );
  const downvoteCount = Math.max(
    0,
    comment.downvoteCount - (previous === -1 ? 1 : 0) + (vote === -1 ? 1 : 0)
  );

  return {
    ...comment,
    downvoteCount,
    upvoteCount,
    viewerVote: vote === 0 ? null : vote,
  };
}

/** Remove one comment and decrement its loaded parent reply count. */
export function deleteCommentFromPage<T extends Comment>(
  page: T[],
  commentId: Id<"comments">
): T[] {
  const removed = Arr.findFirst(page, (comment) => comment._id === commentId);
  if (Option.isNone(removed)) {
    return page;
  }

  return Arr.flatMap(page, (comment) => {
    if (comment._id === commentId) {
      return [];
    }

    if (removed.value.parentId === comment._id) {
      return [{ ...comment, replyCount: Math.max(0, comment.replyCount - 1) }];
    }

    return [comment];
  });
}
