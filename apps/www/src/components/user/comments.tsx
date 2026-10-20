import type { Ref } from "@confect/core";
import { PaginatedQueryResult } from "@confect/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { COMMENT_PAGE_SIZE } from "@repo/backend/client/comments/list";
import type auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { withLeadingSlash } from "@repo/utilities/path";
import { Array as Arr, Option } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow } from "@/components/comments/row";
import { ConvexIsland } from "@/components/providers/island";
import { DataFailure } from "@/components/shared/failure";
import { FeedCount, FeedEmpty, FeedNotice } from "@/components/user/feed";
import { useVisitorList } from "@/components/user/paging";
import { visitorListView } from "@/components/user/visitor";
import { profileCommentsPageFn } from "@/lib/account/profile.functions";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

type ProfileComment = Ref.Returns<
  typeof comments.queries.getCommentsByUserId
>["page"][number];

/**
 * Renders the comments of one user profile, newest first. The loader reads the author and
 * the first page, so both are on the screen before the browser connects. A visitor reads
 * the next pages through the server, and the live list takes its place for a learner.
 */
export function UserComments({
  author,
  first,
  userId,
  username,
}: {
  /** The profile's author, as each comment row shows it. */
  author: Ref.Returns<typeof auth.queries.getUserById>;
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  userId: Id<"users">;
  username: string;
}) {
  return (
    <ConvexIsland
      fallback={
        <VisitorComments author={author} first={first} username={username} />
      }
    >
      <LiveComments author={author} first={first} userId={userId} />
    </ConvexIsland>
  );
}

/** A visitor's comments: the loader's first page, then the next pages the server reads by their cursor. */
function VisitorComments({
  author,
  first,
  username,
}: {
  author: Ref.Returns<typeof auth.queries.getUserById>;
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  username: string;
}) {
  const locale = useLocale();
  const { list, loadMore } = useVisitorList({
    first: Option.getOrUndefined(first),
    readPage: (cursor) =>
      profileCommentsPageFn({ data: { cursor, locale, username } }),
  });
  return (
    <CommentsList
      author={author}
      failed={list.failed}
      onLoadMore={list.isDone || list.pending ? undefined : loadMore}
      results={visitorListView(list).rows}
    />
  );
}

/** A learner's comments: the live list, which starts from the loader's first page. */
function LiveComments({
  author,
  first,
  userId,
}: {
  author: Ref.Returns<typeof auth.queries.getUserById>;
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  userId: Id<"users">;
}) {
  const pagination = usePaginatedPreloaded(
    comments.queries.getCommentsByUserId,
    { userId },
    { initialNumItems: COMMENT_PAGE_SIZE },
    first
  );
  if (PaginatedQueryResult.isLoadingFirstPage(pagination)) {
    return null;
  }
  return (
    <CommentsList
      author={author}
      failed={PaginatedQueryResult.isFailure(pagination)}
      onLoadMore={
        PaginatedQueryResult.isCanLoadMore(pagination)
          ? () => pagination.loadMore(COMMENT_PAGE_SIZE)
          : undefined
      }
      results={pagination.results}
    />
  );
}

/**
 * The rows of one profile\x27s comments, with the failure and the end trigger that
 * loads the next page as it comes into view.
 */
function CommentsList({
  author,
  failed,
  onLoadMore,
  results,
}: {
  author: Ref.Returns<typeof auth.queries.getUserById>;
  failed: boolean;
  onLoadMore: (() => void) | undefined;
  results: readonly ProfileComment[];
}) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  if (failed && results.length === 0) {
    return (
      <FeedNotice>
        <DataFailure />
      </FeedNotice>
    );
  }
  if (results.length === 0) {
    return <FeedEmpty>{t("no-comments")}</FeedEmpty>;
  }
  return (
    <CommentsProvider>
      <div className="flex flex-col">
        {failed && (
          <FeedNotice>
            <DataFailure />
          </FeedNotice>
        )}
        {Arr.map(results, (comment) => (
          <CommentRow
            author={author}
            comment={comment}
            key={comment._id}
            replyAction={
              <NavigationLink
                aria-label={tCommon("reply")}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                href={withLeadingSlash(comment.slug)}
              >
                <HugeIcons icon={ArrowTurnBackwardIcon} />
                <FeedCount value={comment.replyCount} />
              </NavigationLink>
            }
          />
        ))}
        {onLoadMore && <Intersection onIntersect={onLoadMore} />}
      </div>
    </CommentsProvider>
  );
}
