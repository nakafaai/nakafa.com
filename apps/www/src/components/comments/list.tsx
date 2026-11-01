import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { useLocation } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { CommentComposer } from "@/components/comments/composer";
import { usePostComment } from "@/components/comments/posting";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow, ReplyButton } from "@/components/comments/row";
import { useCommentsSlug } from "@/components/comments/slug";
import { CommentThread } from "@/components/comments/thread";
import { DataFailure } from "@/components/shared/failure";
import { readFocusedComment } from "@/lib/comments/focus";

/** How many top-level comments a page holds, the first one and each one after it. */
const PAGE_SIZE = 25;

/**
 * The comments of the page's slug: the comment the reader came for, the composer
 * of a new comment, then each top-level comment with its thread. Every change shows
 * at once, and a page is read as the list reaches its end.
 */
export function CommentsList() {
  return (
    <CommentsProvider>
      <FocusedComment />
      <SlugComments />
    </CommentsProvider>
  );
}

/**
 * The comment that the address names, which an inbox row opens. It stands above
 * the list, because a reply may sit on a page of the list that is not read yet. This
 * list renders only in the browser, so reading the search here costs the static page
 * nothing.
 */
function FocusedComment() {
  const commentId = useLocation({
    select: ({ search }) => Option.getOrNull(readFocusedComment(search)),
  });
  return commentId === null ? null : <FocusedRow commentId={commentId} />;
}

/** The named comment in its row, once it is read, and nothing for a deleted comment. */
function FocusedRow({ commentId }: { commentId: Id<"comments"> }) {
  const focused = useQuery(comments.queries.getComment, { commentId });
  if (!QueryResult.isSuccess(focused) || focused.value === null) {
    return null;
  }
  return (
    <div className="rounded-xl border p-3">
      <CommentRow
        author={focused.value.user}
        comment={focused.value}
        repeats
        replyAction={null}
      />
    </div>
  );
}

/** The composer and the comments of the slug, inside the provider their changes write to. */
function SlugComments() {
  const slug = useCommentsSlug();
  const pagination = usePaginatedQuery(
    comments.queries.getCommentsBySlug,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const postComment = usePostComment();

  return (
    <>
      <CommentComposer
        onPost={(text) => postComment({ parent: null, slug, text })}
      />
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      <div className="flex flex-col gap-4">
        {Arr.map(pagination.results, (comment) => (
          <div key={comment._id}>
            <CommentRow
              author={comment.user}
              comment={comment}
              replyAction={
                <ReplyButton comment={comment} count={comment.replyCount} />
              }
            />
            <CommentThread comment={comment} />
          </div>
        ))}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </div>
    </>
  );
}
