"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, QueryResult, useQuery } from "@confect/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { COMMENT_PAGE_SIZE } from "@repo/backend/client/comments/list";
import auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow } from "@/components/comments/row";
import { DataFailure } from "@/components/shared/failure";
import { FeedCount, FeedEmpty, FeedNotice } from "@/components/user/feed";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { getCleanHref } from "@/lib/routing/href";

/**
 * Renders the comments of one user profile, newest first. The first page comes from
 * the server, so it is on the screen before the browser connects, and the live list
 * takes its place with the same comments.
 */
export function UserComments({
  first,
  userId,
}: {
  first: Ref.Returns<typeof comments.queries.getCommentsByUserId> | undefined;
  userId: Id<"users">;
}) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const userQuery = useQuery(auth.queries.getUserById, {
    userId,
  });
  const pagination = usePaginatedPreloaded(
    comments.queries.getCommentsByUserId,
    { userId },
    { initialNumItems: COMMENT_PAGE_SIZE },
    Option.fromUndefinedOr(first)
  );
  const { results } = pagination;
  if (QueryResult.isFailure(userQuery)) {
    throw userQuery.error;
  }
  if (
    PaginatedQueryResult.isLoadingFirstPage(pagination) ||
    QueryResult.isLoading(userQuery)
  ) {
    return null;
  }
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    pagination.results.length === 0
  ) {
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
        {PaginatedQueryResult.isFailure(pagination) && (
          <FeedNotice>
            <DataFailure />
          </FeedNotice>
        )}
        {Arr.map(results, (comment) => (
          <CommentRow
            author={userQuery.value}
            comment={comment}
            key={comment._id}
            replyAction={
              <NavigationLink
                aria-label={tCommon("reply")}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                href={getCleanHref(comment.slug)}
              >
                <HugeIcons icon={ArrowTurnBackwardIcon} />
                <FeedCount value={comment.replyCount} />
              </NavigationLink>
            }
          />
        ))}
        {PaginatedQueryResult.isCanLoadMore(pagination) && (
          <Intersection
            onIntersect={() => pagination.loadMore(COMMENT_PAGE_SIZE)}
          />
        )}
      </div>
    </CommentsProvider>
  );
}
