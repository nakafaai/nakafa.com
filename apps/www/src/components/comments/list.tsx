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
import { useTranslations } from "use-intl";
import { useCommentDraft } from "@/components/comments/provider";
import { CommentRow, ReplyButton } from "@/components/comments/row";
import { useCommentsSlug } from "@/components/comments/slug";
import { CommentThread } from "@/components/comments/thread";
import { DataFailure } from "@/components/shared/failure";
import { LoadFailure } from "@/components/state/failure";
import { FeedEmpty } from "@/components/user/feed";
import { readFocusedComment } from "@/lib/comments/focus";
import { useKeptRows } from "@/lib/data/kept";

/** How many top-level comments a page holds, the first one and each one after it. */
const PAGE_SIZE = 20;

/**
 * The comments of the page's slug: the comment the reader came for, then each top-level comment with its
 * thread, in the order the header chose. Every change shows at once, the next page is read as the list nears
 * its end, with no button to press, and a new order keeps the rows on screen until its own first page arrives.
 */
export function CommentsList() {
  return (
    <>
      <FocusedComment />
      <SlugComments />
    </>
  );
}

/**
 * The comment that the address names, which an inbox row opens. It stands above the list, because a reply
 * may sit on a page of the list that is not read yet. This list renders only in the browser, so reading the
 * search here costs the static page nothing.
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
    <div className="rounded-xl border px-3">
      <CommentRow
        author={focused.value.user}
        comment={focused.value}
        repeats
        replyAction={null}
      />
    </div>
  );
}

/** The top-level comments of the slug in the chosen order, a page at a time. */
function SlugComments() {
  const t = useTranslations("Comments");
  const slug = useCommentsSlug();
  const sort = useCommentDraft((draft) => draft.sort);
  const pagination = usePaginatedQuery(
    comments.queries.getCommentsBySlug,
    { slug, sort },
    { initialNumItems: PAGE_SIZE }
  );

  // A new order keeps the rows of the last one until its first page arrives, so the list never blanks.
  const rows = useKeptRows(
    PaginatedQueryResult.isLoadingFirstPage(pagination),
    pagination.results
  );

  if (Option.isNone(rows)) {
    return null;
  }
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    Arr.isReadonlyArrayEmpty(rows.value)
  ) {
    return <LoadFailure />;
  }
  if (
    Arr.isReadonlyArrayEmpty(rows.value) &&
    PaginatedQueryResult.isExhausted(pagination)
  ) {
    return <FeedEmpty>{t("no-comments")}</FeedEmpty>;
  }
  return (
    <div className="flex flex-col">
      {Arr.map(rows.value, (comment) => (
        <div data-slot="comment-thread" key={comment._id}>
          <CommentRow
            author={comment.user}
            comment={comment}
            replyAction={<ReplyButton comment={comment} />}
          />
          <CommentThread comment={comment} />
        </div>
      ))}
      {PaginatedQueryResult.isFailure(pagination) ? <DataFailure /> : null}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </div>
  );
}
