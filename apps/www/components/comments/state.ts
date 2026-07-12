import type { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

type Comment = FunctionReturnType<
  typeof api.comments.queries.getCommentsByUserId
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
  const removed = page.find((comment) => comment._id === commentId);
  if (!removed) {
    return page;
  }

  return page.flatMap((comment) => {
    if (comment._id === commentId) {
      return [];
    }

    if (removed.parentId === comment._id) {
      return [{ ...comment, replyCount: Math.max(0, comment.replyCount - 1) }];
    }

    return [comment];
  });
}
