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
import {
  EXACT_ACTIVE_OPTIONS,
  HrefLink,
} from "@repo/internationalization/src/link";
import { withLeadingSlash } from "@repo/utilities/path";
import { Array as Arr, type Option } from "effect";
import { useTranslations } from "use-intl";
import { CommentsProvider } from "@/components/comments/provider";
import { CommentRow } from "@/components/comments/row";
import { DataFailure } from "@/components/shared/failure";
import { FeedCount, FeedEmpty, FeedNotice } from "@/components/user/feed";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/**
 * Renders the comments of one user profile, newest first. The loader reads the author and
 * the first page, so both are on the screen before the browser connects, and the live list
 * takes its place with the same comments.
 */
export function UserComments({
  author,
  first,
  userId,
}: {
  /** The profile's author, as each comment row shows it. */
  author: Ref.Returns<typeof auth.queries.getUserById>;
  first: Option.Option<
    Ref.Returns<typeof comments.queries.getCommentsByUserId>
  >;
  userId: Id<"users">;
}) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");
  const pagination = usePaginatedPreloaded(
    comments.queries.getCommentsByUserId,
    { userId },
    { initialNumItems: COMMENT_PAGE_SIZE },
    first
  );
  const { results } = pagination;
  if (PaginatedQueryResult.isLoadingFirstPage(pagination)) {
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
            author={author}
            comment={comment}
            key={comment._id}
            replyAction={
              <HrefLink
                activeOptions={EXACT_ACTIVE_OPTIONS}
                aria-label={tCommon("reply")}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                href={withLeadingSlash(comment.slug)}
              >
                <HugeIcons icon={ArrowTurnBackwardIcon} />
                <FeedCount value={comment.replyCount} />
              </HrefLink>
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
