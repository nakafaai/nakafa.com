"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  EyeIcon,
  ReplyIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { getInitialName } from "@/lib/utils/helper";

export function UserComments({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Comments");

  const { results } = usePaginatedQuery(
    api.comments.queries.getCommentsByUserId,
    { userId },
    { initialNumItems: 25 }
  );

  if (results.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        {t("no-comments")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {results.map((comment) => (
        <CommentThread comment={comment} key={comment._id} />
      ))}
    </div>
  );
}

function CommentThread({ comment }: { comment: Doc<"comments"> }) {
  const t = useTranslations("Common");

  const user = useQuery(api.auth.getUserById, { userId: comment.userId });
  const currentUser = useQuery(api.auth.getCurrentUser);

  const userName = user?.authUser.name ?? t("anonymous");
  const userImage = user?.authUser.image ?? "";

  const [isPending, startTransition] = useTransition();

  const voteOnComment = useMutation(api.comments.mutations.voteOnComment);
  const deleteComment = useMutation(api.comments.mutations.deleteComment);

  function handleVote(vote: -1 | 1) {
    if (!currentUser) {
      return;
    }

    startTransition(async () => {
      await voteOnComment({
        commentId: comment._id,
        vote,
      });
    });
  }

  function handleDelete() {
    if (!currentUser) {
      return;
    }

    startTransition(async () => {
      await deleteComment({
        commentId: comment._id,
      });
    });
  }

  return (
    <div className="flex items-start gap-3 text-left">
      <Avatar className="size-10 rounded-full">
        <AvatarImage alt={userName} role="presentation" src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="grid w-full gap-2">
        <div className="grid gap-1">
          <span className="truncate font-medium text-sm">{userName}</span>
          <Response id={comment._id}>{comment.text}</Response>
        </div>

        <div className="flex -translate-x-2 items-center">
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
                  <ThumbsUpIcon />
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
                  <ThumbsDownIcon />
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
                  className="cursor-default"
                  size={comment.replyCount === 0 ? "icon-sm" : "sm"}
                  variant="ghost"
                >
                  <ReplyIcon />
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
                <NavigationLink
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" })
                  )}
                  href={comment.slug}
                  target="_blank"
                >
                  <EyeIcon />
                  <span className="sr-only">{t("see")}</span>
                </NavigationLink>
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
                  <Trash2Icon />
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
