"use client";

import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  Delete02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/userHelpers";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, usePaginatedQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Activity, useState, useTransition } from "react";
import { CommentsAdd } from "@/components/comments/add";
import { useUser } from "@/lib/context/use-user";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

type Comment = Doc<"comments">;
type CommentWithUser = Comment & {
  user: UserData | null;
  replyToUser: UserData | null;
};

interface Props {
  slug: string;
}

export function CommentsList({ slug }: Props) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.comments.queries.getCommentsBySlug,
    { slug },
    { initialNumItems: 25 }
  );

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {results.map((comment) => (
        <CommentItem comment={comment} key={comment._id} slug={slug} />
      ))}

      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(25)} />
      )}
    </div>
  );
}

function CommentItem({
  comment,
  slug,
}: {
  comment: CommentWithUser;
  slug: string;
}) {
  const [isReplyOpen, setIsReplyOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2" id={comment._id}>
      <CommentContent
        comment={comment}
        onReplyToggle={() => setIsReplyOpen((prev) => !prev)}
      />
      <Activity mode={isReplyOpen ? "visible" : "hidden"}>
        <CommentsAdd
          closeButton={{ onClick: () => setIsReplyOpen(false) }}
          comment={comment}
          slug={slug}
        />
      </Activity>
    </div>
  );
}

function CommentContent({
  comment,
  onReplyToggle,
}: {
  comment: CommentWithUser;
  onReplyToggle: () => void;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const user = useUser((s) => s.user);

  const userId = comment.user?._id;
  const userName = comment.user?.name ?? t("anonymous");
  const userImage = comment.user?.image ?? "";

  const isReplyToMe = user && comment.replyToUser?._id === user.appUser._id;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl p-2 text-left transition-colors",
        !!isReplyToMe && "rounded-l-none border-primary border-l bg-primary/5"
      )}
    >
      <Avatar className="size-10 rounded-full">
        <AvatarImage alt={userName} role="presentation" src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {userId ? (
              <NavigationLink
                className="min-w-0 max-w-36 truncate font-medium text-sm transition-colors ease-out hover:text-primary"
                href={`/user/${userId}`}
                target="_blank"
                title={userName}
              >
                {userName}
              </NavigationLink>
            ) : (
              <span className="min-w-0 truncate font-medium text-sm">
                {userName}
              </span>
            )}
            <time className="min-w-0 truncate text-muted-foreground text-xs tracking-tight">
              {formatDistanceToNow(comment._creationTime, {
                locale: getLocale(locale),
                addSuffix: true,
              })}
            </time>
          </div>

          <ReplyToIndicator comment={comment} />

          <div className="wrap-break-word min-w-0">
            <Response id={comment._id}>{comment.text}</Response>
          </div>
        </div>

        <CommentActions comment={comment} onReplyToggle={onReplyToggle} />
      </div>
    </div>
  );
}

function CommentActions({
  comment,
  onReplyToggle,
}: {
  comment: CommentWithUser;
  onReplyToggle: () => void;
}) {
  const t = useTranslations("Common");
  const user = useUser((s) => s.user);

  const [isPending, startTransition] = useTransition();

  const voteOnComment = useMutation(api.comments.mutations.voteOnComment);
  const deleteComment = useMutation(api.comments.mutations.deleteComment);

  function handleVote(vote: -1 | 1) {
    if (!user) {
      return;
    }
    startTransition(async () => {
      await voteOnComment({ commentId: comment._id, vote });
    });
  }

  function handleDelete() {
    if (!user) {
      return;
    }
    startTransition(async () => {
      await deleteComment({ commentId: comment._id });
    });
  }

  return (
    <div className="flex -translate-x-2 flex-wrap items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="group"
              disabled={isPending}
              onClick={() => handleVote(1)}
              size={comment.upvoteCount === 0 ? "icon-sm" : "sm"}
              variant="ghost"
            >
              <HugeIcons icon={ThumbsUpIcon} />
              <NumberFormat
                className={cn(
                  "font-mono text-muted-foreground text-xs tracking-tight group-hover:text-accent-foreground",
                  comment.upvoteCount === 0 && "hidden"
                )}
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
              className="group"
              disabled={isPending}
              onClick={() => handleVote(-1)}
              size={comment.downvoteCount === 0 ? "icon-sm" : "sm"}
              variant="ghost"
            >
              <HugeIcons icon={ThumbsDownIcon} />
              <NumberFormat
                className={cn(
                  "font-mono text-muted-foreground text-xs tracking-tight group-hover:text-accent-foreground",
                  comment.downvoteCount === 0 && "hidden"
                )}
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
              disabled={isPending}
              onClick={onReplyToggle}
              size={comment.replyCount === 0 ? "icon-sm" : "sm"}
              variant="ghost"
            >
              <HugeIcons icon={ArrowTurnBackwardIcon} />
              <NumberFormat
                className={cn(
                  "font-mono text-muted-foreground text-xs tracking-tight",
                  comment.replyCount === 0 && "hidden"
                )}
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
            <Button
              className={cn(comment.userId !== user?.appUser._id && "hidden")}
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
  );
}

function ReplyToIndicator({ comment }: { comment: CommentWithUser }) {
  const { replyToUser, parentId, replyToText } = comment;

  if (!(replyToUser && parentId)) {
    return null;
  }

  const scrollToParent = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(parentId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <a
      className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs transition-colors ease-out hover:text-foreground"
      href={`#${parentId}`}
      onClick={scrollToParent}
    >
      <HugeIcons className="size-3 shrink-0" icon={ArrowTurnForwardIcon} />
      <span className="max-w-32 shrink-0 truncate text-primary">
        {replyToUser.name}
      </span>
      <Activity mode={replyToText ? "visible" : "hidden"}>
        <span className="min-w-0 flex-1 truncate">{replyToText}</span>
      </Activity>
    </a>
  );
}
