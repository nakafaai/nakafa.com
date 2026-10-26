import type { Ref } from "@confect/core";
import { PaginatedQueryResult } from "@confect/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { COMMENT_PAGE_SIZE } from "@repo/backend/client/comments/list";
import type auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { createContext, use } from "react";
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
import { TargetLink } from "@/lib/routing/link";
import { publicPathTarget } from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

type ProfileComment = Ref.Returns<
  typeof comments.queries.getCommentsByUserId
>["page"][number];

type ProfileAuthor = Ref.Returns<typeof auth.queries.getUserById>;

/** The profile's author, which the picture and the name of every comment row show. */
const ProfileAuthorContext = createContext<ProfileAuthor | undefined>(
  undefined
);

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
  author: ProfileAuthor;
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  userId: Id<"users">;
  username: string;
}) {
  return (
    <ProfileAuthorContext value={author}>
      <ProfileCommentsContext value={{ first, userId, username }}>
        <ConvexIsland fallback={<VisitorComments />}>
          <LiveComments />
        </ConvexIsland>
      </ProfileCommentsContext>
    </ProfileAuthorContext>
  );
}

/** The profile whose comments the list shows, and the loader's first page of them, which both variants read. */
const ProfileCommentsContext = createContext<{
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  userId: Id<"users">;
  username: string;
} | null>(null);

/** Reads the profile comments around a variant of the list. */
function useProfileComments() {
  const value = use(ProfileCommentsContext);
  if (value === null) {
    throw new Error("useProfileComments must be used within UserComments");
  }
  return value;
}

/** A visitor's comments: the loader's first page, then the next pages the server reads by their cursor. */
function VisitorComments() {
  const { first, username } = useProfileComments();
  const locale = useLocale();
  const { list, loadMore } = useVisitorList({
    first: Option.getOrUndefined(first),
    readPage: (cursor) =>
      profileCommentsPageFn({ data: { cursor, locale, username } }),
  });
  return (
    <CommentsList
      failed={list.failed}
      onLoadMore={list.isDone || list.pending ? undefined : loadMore}
      results={visitorListView(list).rows}
    />
  );
}

/** A learner's comments: the live list, which starts from the loader's first page. */
function LiveComments() {
  const { first, userId } = useProfileComments();
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
 * The rows of one profile's comments, with the failure and the end trigger that
 * loads the next page as it comes into view.
 */
function CommentsList({
  failed,
  onLoadMore,
  results,
}: {
  failed: boolean;
  onLoadMore: (() => void) | undefined;
  results: readonly ProfileComment[];
}) {
  const author = use(ProfileAuthorContext);
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
              <ReplyLink
                label={tCommon("reply")}
                replyCount={comment.replyCount}
                slug={comment.slug}
              />
            }
          />
        ))}
        {onLoadMore && (
          <Intersection key={results.length} onIntersect={onLoadMore} />
        )}
      </div>
    </CommentsProvider>
  );
}

/** The reply link of one comment: the page the comment belongs to, with its reply count. */
function ReplyLink({
  label,
  replyCount,
  slug,
}: {
  label: string;
  replyCount: number;
  slug: string;
}) {
  return Option.match(publicPathTarget(slug), {
    onNone: () => null,
    onSome: (target) => (
      <TargetLink
        activeOptions={EXACT_ACTIVE_OPTIONS}
        aria-label={label}
        className={buttonVariants({ size: "sm", variant: "ghost" })}
        target={target}
      >
        <HugeIcons icon={ArrowTurnBackwardIcon} />
        <FeedCount value={replyCount} />
      </TargetLink>
    ),
  });
}
