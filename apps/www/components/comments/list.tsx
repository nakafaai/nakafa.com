"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { AnyAppUser } from "@repo/backend/convex/auth";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  MessageCircleIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { getInitialName } from "@/lib/utils/helper";
import { CommentsAdd } from "./add";

type Comment = Doc<"comments">;
type CommentWithUser = Comment & { user?: AnyAppUser | null };

// Keep in sync with MAX_DEPTH in packages/backend/convex/comments/mutations.ts
const MAX_REPLY_DEPTH = 5;

type Props = {
  slug: string;
};

export function CommentsList({ slug }: Props) {
  const { results } = usePaginatedQuery(
    api.comments.queries.getParentCommentsBySlug,
    { slug },
    { initialNumItems: 25 },
  );

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {results.map((comment) => (
        <CommentThread comment={comment} key={comment._id} />
      ))}
    </div>
  );
}

function CommentThread({ comment }: { comment: CommentWithUser }) {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isRepliesOpen, setIsRepliesOpen] = useState(false);

  const handleReplyToggle = () => {
    const newReplyState = !isReplyOpen;
    setIsReplyOpen(newReplyState);
    // Open replies when opening reply box, toggle when closing
    setIsRepliesOpen(newReplyState || !isRepliesOpen);
  };

  return (
    <div className="flex flex-col gap-6">
      <CommentMain
        comment={comment}
        isReplyOpen={isReplyOpen}
        onReplyClose={() => setIsReplyOpen(false)}
        onReplyToggle={handleReplyToggle}
      />
      <CommentReplies comment={comment} isOpen={isRepliesOpen} />
    </div>
  );
}

function CommentMain({
  comment,
  isReplyOpen,
  onReplyToggle,
  onReplyClose,
}: {
  comment: CommentWithUser;
  isReplyOpen: boolean;
  onReplyToggle: () => void;
  onReplyClose: () => void;
}) {
  const t = useTranslations("Common");

  const userName = comment.user?.authUser.name ?? t("anonymous");
  const userImage = comment.user?.authUser.image ?? "";

  return (
    <div className="flex items-start gap-3 text-left">
      <Avatar className="size-10 rounded-full">
        <AvatarImage alt={userName} src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="grid w-full gap-2">
        <div className="grid gap-1">
          <span className="truncate font-medium text-sm">{userName}</span>
          <Response id={comment._id}>{comment.text}</Response>
        </div>

        <CommentFooter
          comment={comment}
          isReplyOpen={isReplyOpen}
          onReplyClose={onReplyClose}
          onReplyToggle={onReplyToggle}
        />
      </div>
    </div>
  );
}

function CommentFooter({
  comment,
  isReplyOpen,
  onReplyToggle,
  onReplyClose,
}: {
  comment: CommentWithUser;
  isReplyOpen: boolean;
  onReplyToggle: () => void;
  onReplyClose: () => void;
}) {
  return (
    <div className="grid gap-3">
      <CommentAction comment={comment} onReplyToggle={onReplyToggle} />
      {isReplyOpen && (
        <CommentsAdd
          closeButton={{ onClick: onReplyClose }}
          comment={comment}
          slug={comment.contentSlug}
        />
      )}
    </div>
  );
}

function CommentReplies({
  comment,
  isOpen,
}: {
  comment: CommentWithUser;
  isOpen: boolean;
}) {
  const isMaxDepth = comment.depth >= MAX_REPLY_DEPTH;
  const replyDepth = Math.min(comment.depth + 1, MAX_REPLY_DEPTH);

  const { results } = usePaginatedQuery(
    api.comments.queries.getRepliesByCommentId,
    { commentId: comment._id, depth: replyDepth },
    { initialNumItems: 25 },
  );

  if (!isOpen || results.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        !isMaxDepth && "border-l pl-4 md:pl-6",
      )}
    >
      {results.map((reply) => (
        <CommentThread comment={reply} key={reply._id} />
      ))}
    </div>
  );
}

function CommentAction({
  comment,
  onReplyToggle,
}: {
  comment: CommentWithUser;
  onReplyToggle: () => void;
}) {
  const t = useTranslations("Common");
  const currentUser = useQuery(api.auth.getCurrentUser);

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
    <div className="-translate-x-2 flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
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
                comment.upvoteCount === 0 && "hidden",
              )}
              isolate={true}
              value={comment.upvoteCount}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("like")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
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
                comment.downvoteCount === 0 && "hidden",
              )}
              isolate={true}
              value={comment.downvoteCount}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("dislike")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={isPending}
            onClick={onReplyToggle}
            size={comment.replyCount === 0 ? "icon-sm" : "sm"}
            variant="ghost"
          >
            <MessageCircleIcon />
            <NumberFormat
              className={cn(
                "font-mono text-muted-foreground text-xs tracking-tight",
                comment.replyCount === 0 && "hidden",
              )}
              isolate={true}
              value={comment.replyCount}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("reply")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn(
              comment.userId !== currentUser?.appUser._id && "hidden",
            )}
            disabled={isPending}
            onClick={handleDelete}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2Icon />
            <span className="sr-only">{t("delete")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("delete")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
