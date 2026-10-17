"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import type { StoreApi } from "zustand";
import { CommentComposer } from "@/components/comments/composer";
import { usePostComment } from "@/components/comments/posting";
import {
  useCommentsContext,
  useReplying,
} from "@/components/comments/provider";
import { CommentRow, ReplyButton, ReplyingTo } from "@/components/comments/row";
import {
  type CommentRow as CommentRowData,
  threadOf,
} from "@/components/comments/state";
import { DataFailure } from "@/components/shared/failure";
import type { AgeClock } from "@/components/user/clock";

/** How many replies a page of a thread holds, the first one and each one after it. */
const REPLY_PAGE_SIZE = 25;

/**
 * The thread under a top-level comment: its replies, oldest first, each in the row
 * anatomy of the list, and the reply composer when one is open in this thread. A
 * thread with no replies and no open composer reads nothing.
 */
export function CommentThread({
  clock,
  comment,
}: {
  clock: StoreApi<AgeClock>;
  comment: CommentRowData;
}) {
  const isOpen = useReplying(
    (replying) =>
      replying.target !== null && threadOf(replying.target) === comment._id
  );
  if (comment.replyCount === 0 && !isOpen) {
    return null;
  }
  return <ThreadReplies clock={clock} threadId={comment._id} />;
}

/** The loaded replies of one thread, a page at a time, and the composer at their end. */
function ThreadReplies({
  clock,
  threadId,
}: {
  clock: StoreApi<AgeClock>;
  threadId: CommentRowData["_id"];
}) {
  const { slug } = useCommentsContext();
  const pagination = usePaginatedQuery(
    comments.queries.getCommentReplies,
    { threadId },
    { initialNumItems: REPLY_PAGE_SIZE }
  );
  const target = useReplying((replying) => replying.target);
  const close = useReplying((replying) => replying.close);
  const postComment = usePostComment();

  return (
    <div className="ms-5 border-s ps-8">
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      {Arr.map(pagination.results, (reply) => (
        <CommentRow
          author={reply.user}
          clock={clock}
          comment={reply}
          key={reply._id}
          replyAction={<ReplyButton comment={reply} count={null} />}
          replyTo={
            reply.parentId === undefined ||
            reply.parentId === threadId ||
            reply.replyToUser === null ? undefined : (
              <ReplyingTo
                name={reply.replyToUser.name}
                parentId={reply.parentId}
              />
            )
          }
        />
      ))}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection
          onIntersect={() => pagination.loadMore(REPLY_PAGE_SIZE)}
        />
      ) : null}
      {target !== null && threadOf(target) === threadId ? (
        <CommentComposer
          autoFocus
          onClose={close}
          onPost={(text) => postComment({ parent: target, slug, text })}
        />
      ) : null}
    </div>
  );
}
