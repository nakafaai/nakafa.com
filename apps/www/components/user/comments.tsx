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
  Delete02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  useDeleteCommentMutation,
  useVoteCommentMutation,
} from "@/components/comments/mutation.client";
import { DataFailure } from "@/components/shared/failure";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";
import { getInitialName } from "@/lib/utils/helper";
import { getCleanHref } from "@/lib/utils/link";

/** Render the incrementally loaded comments for one user profile. */
export function UserComments({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Comments");
  const userQuery = useQuery(refs.public.auth.queries.getUserById, {
    userId,
  });
  const pagination = usePaginatedQuery(
    refs.public.comments.queries.getCommentsByUserId,
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
  typeof refs.public.comments.queries.getCommentsByUserId
>["page"][number];

/** Render one profile comment with optimistic viewer actions. */
function CommentThread({
  comment,
  user,
}: {
  comment: UserComment;
  user: Ref.Returns<typeof refs.public.auth.queries.getUserById>;
}) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Common");
  const currentUser = useViewer((state) => state.account);
  const userName = user?.name ?? t("anonymous");
  const userImage = user?.image ?? "";
  const [isPending, startTransition] = useTransition();
  const voteOnComment = useVoteCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  /** Toggle the current viewer's vote on this comment. */
  function handleVote(vote: -1 | 1) {
    if (!currentUser) {
      return;
    }
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            voteOnComment({
              commentId: comment._id,
              vote: comment.viewerVote === vote ? 0 : vote,
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/comments",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }

  /** Delete this comment when the viewer owns it. */
  function handleDelete() {
    if (!currentUser) {
      return;
    }
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            deleteComment({
              commentId: comment._id,
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/comments",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }
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

        <div className="flex -translate-x-2 items-center">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("like")}
                  aria-pressed={comment.viewerVote === 1}
                  className="group w-16"
                  disabled={isPending}
                  onClick={() => handleVote(1)}
                  size="sm"
                  variant={comment.viewerVote === 1 ? "secondary" : "ghost"}
                >
                  <HugeIcons icon={ThumbsUpIcon} />
                  <NumberFormat
                    className={cn(
                      "min-w-[3ch] text-xs tabular-nums tracking-tight",
                      comment.upvoteCount === 0 && "invisible"
                    )}
                    format={{ notation: "compact", maximumFractionDigits: 1 }}
                    isolate={true}
                    value={comment.upvoteCount}
                  />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("like")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("dislike")}
                  aria-pressed={comment.viewerVote === -1}
                  className="group w-16"
                  disabled={isPending}
                  onClick={() => handleVote(-1)}
                  size="sm"
                  variant={comment.viewerVote === -1 ? "secondary" : "ghost"}
                >
                  <HugeIcons icon={ThumbsDownIcon} />
                  <NumberFormat
                    className={cn(
                      "min-w-[3ch] text-xs tabular-nums tracking-tight",
                      comment.downvoteCount === 0 && "invisible"
                    )}
                    format={{ notation: "compact", maximumFractionDigits: 1 }}
                    isolate={true}
                    value={comment.downvoteCount}
                  />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("dislike")}</TooltipContent>
          </Tooltip>

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
                  <NumberFormat
                    className={cn(
                      "min-w-[3ch] text-xs tabular-nums tracking-tight",
                      comment.replyCount === 0 && "invisible"
                    )}
                    format={{ notation: "compact", maximumFractionDigits: 1 }}
                    isolate={true}
                    value={comment.replyCount}
                  />
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

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className={cn(
                    comment.userId !== currentUser?.appUser._id && "hidden"
                  )}
                  disabled={isPending}
                  onClick={handleDelete}
                  size="icon-sm"
                  variant="ghost"
                >
                  <HugeIcons icon={Delete02Icon} />
                  <span className="sr-only">{t("delete")}</span>
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("delete")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
