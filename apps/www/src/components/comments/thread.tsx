import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { CommentComposer } from "@/components/comments/composer";
import { usePostComment } from "@/components/comments/posting";
import { useCommentDraft } from "@/components/comments/provider";
import { CommentRow, ReplyButton, ReplyingTo } from "@/components/comments/row";
import {
  type CommentRow as CommentRowData,
  threadOf,
} from "@/components/comments/state";
import { DataFailure } from "@/components/shared/failure";

/** How many replies a page of a thread holds, the first one and each one after it. */
const REPLY_PAGE_SIZE = 25;

/**
 * The thread under a top-level comment: its replies, oldest first, each in the row
 * anatomy of the list, and the reply composer when one is open in this thread. A
 * thread with no replies and no open composer reads nothing.
 */
export function CommentThread({ comment }: { comment: CommentRowData }) {
  const isOpen = useCommentDraft(
    (draft) => draft.target !== null && threadOf(draft.target) === comment._id
  );
  if (comment.replyCount === 0 && !isOpen) {
    return null;
  }
  return <ThreadReplies threadId={comment._id} />;
}

/** The loaded replies of one thread, a page at a time, and the composer at their end. */
function ThreadReplies({ threadId }: { threadId: CommentRowData["_id"] }) {
  const pagination = usePaginatedQuery(
    comments.queries.getCommentReplies,
    { threadId },
    { initialNumItems: REPLY_PAGE_SIZE }
  );
  const target = useCommentDraft((draft) => draft.target);
  const close = useCommentDraft((draft) => draft.close);
  const postComment = usePostComment();

  return (
    <div className="ms-5 border-s ps-8">
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      {Arr.map(pagination.results, (reply) => (
        <CommentRow
          author={reply.user}
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
          answers={target._id}
          autoFocus
          onClose={close}
          onPost={(text) =>
            postComment({ parent: target, slug: target.slug, text })
          }
        />
      ) : null}
    </div>
  );
}
