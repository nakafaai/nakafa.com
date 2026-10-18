"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow } from "@/components/comments/row";
import { DataFailure } from "@/components/shared/failure";
import { FeedCount, FeedEmpty, FeedNotice } from "@/components/user/feed";
import { getCleanHref } from "@/lib/routing/href";

/** How many comments a page of the profile holds, the first one and each one after it. */
const PAGE_SIZE = 25;

/** Render the incrementally loaded comments for one user profile. */
export function UserComments({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const userQuery = useQuery(auth.queries.getUserById, {
    userId,
  });
  const pagination = usePaginatedQuery(
    comments.queries.getCommentsByUserId,
    {
      userId,
    },
    {
      initialNumItems: PAGE_SIZE,
    }
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
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        )}
      </div>
    </CommentsProvider>
  );
}
