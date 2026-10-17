"use client";

import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  Delete02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { photoOf } from "@repo/backend/confect/users/picture";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, DateTime } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  CommentActionsProvider,
  CommentCount,
  CommentVotes,
  useCommentActions,
} from "@/components/comments/actions";
import { DataFailure } from "@/components/shared/failure";
import { formatShortAge } from "@/components/user/age";
import {
  FeedActions,
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedEmpty,
  FeedEnd,
  FeedHeader,
  FeedMore,
  FeedName,
  FeedNotice,
  FeedRow,
} from "@/components/user/feed";
import { useViewer } from "@/lib/identity/client";
import { getCleanHref } from "@/lib/routing/href";

/** How many comments a page of the profile holds, the first one and each one after it. */
const PAGE_SIZE = 25;

/** Render the incrementally loaded comments for one user profile. */
export function UserComments({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Comments");
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
    <div className="flex flex-col">
      {PaginatedQueryResult.isFailure(pagination) && (
        <FeedNotice>
          <DataFailure />
        </FeedNotice>
      )}
      {Arr.map(results, (comment) => (
        <CommentRow
          comment={comment}
          key={comment._id}
          user={userQuery.value}
        />
      ))}
      {PaginatedQueryResult.isCanLoadMore(pagination) && (
        <FeedMore>
          <Button
            onClick={() => pagination.loadMore(PAGE_SIZE)}
            variant="outline"
          >
            {t("load-more")}
          </Button>
        </FeedMore>
      )}
    </div>
  );
}
type UserComment = Ref.Returns<
  typeof comments.queries.getCommentsByUserId
>["page"][number];

/**
 * One comment of the profile, in the anatomy every row of the profile shares:
 * the writer's picture, the name and the age with the More menu at the end of
 * that line, the comment, then its votes and the replies, which open the
 * comment on its page.
 */
function CommentRow({
  comment,
  user,
}: {
  comment: UserComment;
  user: Ref.Returns<typeof auth.queries.getUserById>;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  return (
    <CommentActionsProvider comment={comment}>
      <FeedRow>
        <FeedAvatar mascot={user?.mascot} photo={photoOf(user ?? {})} />
        <FeedBody>
          <FeedHeader>
            <FeedName>{user?.name ?? t("anonymous")}</FeedName>
            <FeedAge at={comment._creationTime}>
              {formatShortAge(comment._creationTime, now, locale)}
            </FeedAge>
            <FeedEnd>
              <CommentMoreMenu />
            </FeedEnd>
          </FeedHeader>
          <MarkdownContent id={comment._id}>{comment.text}</MarkdownContent>
          <FeedActions>
            <CommentVotes />
            <Button
              aria-label={t("reply")}
              nativeButton={false}
              render={
                <NavigationLink href={getCleanHref(comment.slug)}>
                  <HugeIcons icon={ArrowTurnBackwardIcon} />
                  <CommentCount value={comment.replyCount} />
                </NavigationLink>
              }
              size="sm"
              variant="ghost"
            />
          </FeedActions>
        </FeedBody>
      </FeedRow>
    </CommentActionsProvider>
  );
}

/**
 * The More menu of a comment: Delete, for its writer, asks first in the one
 * confirm pattern of the app's deletions.
 */
function CommentMoreMenu() {
  const t = useTranslations("Common");
  const tComments = useTranslations("Comments");
  const viewerId = useViewer((state) => state.account?.appUser._id);
  const authorId = useCommentActions(({ comment }) => comment.userId);
  const isPending = useCommentActions((actions) => actions.isPending);
  const remove = useCommentActions((actions) => actions.remove);
  const [asking, setAsking] = useState(false);

  if (authorId !== viewerId) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("more")}
              disabled={isPending}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setAsking(true)}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={tComments("delete-description")}
        footer={
          <>
            <Button onClick={() => setAsking(false)} variant="outline">
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                setAsking(false);
                remove();
              }}
              variant="destructive"
            >
              {t("delete")}
            </Button>
          </>
        }
        open={asking}
        setOpen={setAsking}
        title={tComments("delete-title")}
      />
    </>
  );
}
