"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, DateTime } from "effect";
import { CommentComposer } from "@/components/comments/composer";
import { usePostComment } from "@/components/comments/posting";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow, ReplyButton } from "@/components/comments/row";
import { CommentThread } from "@/components/comments/thread";
import { DataFailure } from "@/components/shared/failure";
import { useAgeClock } from "@/components/user/clock.client";

/** How many top-level comments a page holds, the first one and each one after it. */
const PAGE_SIZE = 25;

/**
 * The comments of one slug: the composer of a new comment, then each top-level
 * comment with its thread. Every change shows at once, and a page is read as the
 * list reaches its end.
 */
export function CommentsList({ slug }: { slug: string }) {
  const clock = useAgeClock(DateTime.toEpochMillis(DateTime.nowUnsafe()));
  const pagination = usePaginatedQuery(
    comments.queries.getCommentsBySlug,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const postComment = usePostComment();

  return (
    <CommentsProvider clock={clock} slug={slug}>
      <CommentComposer
        onPost={(text) => postComment({ parent: null, slug, text })}
      />
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      <div className="flex flex-col gap-4">
        {Arr.map(pagination.results, (comment) => (
          <div key={comment._id}>
            <CommentRow
              author={comment.user}
              clock={clock}
              comment={comment}
              replyAction={
                <ReplyButton comment={comment} count={comment.replyCount} />
              }
            />
            <CommentThread clock={clock} comment={comment} />
          </div>
        ))}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </div>
    </CommentsProvider>
  );
}
