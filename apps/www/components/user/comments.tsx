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
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import comments from "@repo/backend/confect/_generated/refs/comments";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  CommentActionsProvider,
  CommentCount,
  CommentDelete,
  CommentVotes,
} from "@/components/comments/actions";
import { DataFailure } from "@/components/shared/failure";
import { getInitialName } from "@/lib/utils/helper";
import { getCleanHref } from "@/lib/utils/link";

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
      initialNumItems: 25,
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
    return <DataFailure />;
  }
  if (results.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        {t("no-comments")}
      </p>
    );
  }
  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) && <DataFailure />}
      <div className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
        {results.map((comment) => (
          <CommentThread
            comment={comment}
            key={comment._id}
            user={userQuery.value}
          />
        ))}
      </div>
    </>
  );
}
type UserComment = Ref.Returns<
  typeof comments.queries.getCommentsByUserId
>["page"][number];

/** Render one profile comment with optimistic viewer actions. */
function CommentThread({
  comment,
  user,
}: {
  comment: UserComment;
  user: Ref.Returns<typeof auth.queries.getUserById>;
}) {
  const t = useTranslations("Common");
  const userName = user?.name ?? t("anonymous");
  const userImage = user?.image ?? "";
  return (
    <div className="flex items-start gap-3 p-4 text-left">
      <Avatar className="size-10">
        <AvatarImage alt={userName} role="presentation" src={userImage} />
        <AvatarFallback>{getInitialName(userName)}</AvatarFallback>
      </Avatar>
      <div className="grid w-full gap-2">
        <div className="grid gap-1">
          <span className="truncate font-medium text-sm">{userName}</span>
          <MarkdownContent id={comment._id}>{comment.text}</MarkdownContent>
        </div>

        <CommentActionsProvider comment={comment}>
          <div className="flex -translate-x-2 items-center">
            <CommentVotes />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={t("reply")}
                    className="w-16 cursor-default"
                    size="sm"
                    variant="ghost"
                  >
                    <HugeIcons icon={ArrowTurnBackwardIcon} />
                    <CommentCount value={comment.replyCount} />
                  </Button>
                }
              />
              <TooltipContent side="bottom">{t("reply")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                      })
                    )}
                    href={getCleanHref(comment.slug)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <HugeIcons icon={ArrowUpRight01Icon} />
                    <span className="sr-only">{t("see")}</span>
                  </a>
                }
              />
              <TooltipContent side="bottom">{t("see")}</TooltipContent>
            </Tooltip>

            <CommentDelete />
          </div>
        </CommentActionsProvider>
      </div>
    </div>
  );
}
