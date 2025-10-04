"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { CommentUser } from "@repo/backend/convex/comments/queries";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import {
  ReplyIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { getInitialName } from "@/lib/utils/helper";
import { CommentsAdd } from "./add";

type Comment = Doc<"comments">;
type CommentWithUser = Comment & { user?: CommentUser | null };

// Keep in sync with MAX_DEPTH in packages/backend/convex/comments/mutations.ts
const MAX_REPLY_DEPTH = 5;

type Props = {
  slug: string;
};

export function CommentsList({ slug }: Props) {
  const { results } = usePaginatedQuery(
    api.comments.queries.getParentCommentsBySlug,
    { slug },
    { initialNumItems: 25 }
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
  return (
    <div className="flex flex-col gap-3">
      <CommentMain comment={comment} />
      <CommentReplies comment={comment} />
    </div>
  );
}

function CommentMain({ comment }: { comment: CommentWithUser }) {
  const t = useTranslations("Common");

  const userName = comment.user?.name ?? t("anonymous");
  const userImage = comment.user?.image ?? "";

  return (
    <div className="flex items-start gap-3 text-left">
      <Avatar className="size-10 rounded-full">
        <AvatarImage alt={userName} src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>
      <div className="grid w-full gap-1">
        <div className="grid gap-0.5">
          <span className="truncate font-medium text-sm">{userName}</span>
          <Response id={comment._id}>{comment.text}</Response>
        </div>

        <CommentFooter comment={comment} />
      </div>
    </div>
  );
}

function CommentFooter({ comment }: { comment: CommentWithUser }) {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <CommentAction
        comment={comment}
        replyOpen={isReplyOpen}
        setReplyOpen={setIsReplyOpen}
      />
      {isReplyOpen && (
        <CommentsAdd
          closeButton={{ onClick: () => setIsReplyOpen(false) }}
          comment={comment}
          slug={comment.contentSlug}
        />
      )}
    </div>
  );
}

function CommentReplies({ comment }: { comment: CommentWithUser }) {
  const isMaxDepth = comment.depth >= MAX_REPLY_DEPTH;
  const replyDepth = Math.min(comment.depth + 1, MAX_REPLY_DEPTH);

  const { results } = usePaginatedQuery(
    api.comments.queries.getRepliesByCommentId,
    { commentId: comment._id, depth: replyDepth },
    { initialNumItems: 25 }
  );

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !isMaxDepth && "border-l pl-4 md:pl-6"
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
  replyOpen,
  setReplyOpen,
}: {
  comment: Comment;
  replyOpen: boolean;
  setReplyOpen: (isReplyOpen: boolean) => void;
}) {
  const t = useTranslations("Common");
  const currentUser = useQuery(api.auth.getCurrentUser);

  const [isPending, startTransition] = useTransition();

  const voteOnComment = useMutation(api.comments.mutations.voteOnComment);
  const deleteComment = useMutation(api.comments.mutations.deleteComment);

  const handleVote = (vote: -1 | 1) => {
    startTransition(async () => {
      await voteOnComment({
        commentId: comment._id,
        vote,
      });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteComment({
        commentId: comment._id,
      });
    });
  };

  return (
    <div className="-translate-x-2 flex items-center">
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

      <Button
        disabled={isPending}
        onClick={() => setReplyOpen(!replyOpen)}
        size="icon-sm"
        variant="ghost"
      >
        <ReplyIcon />
        <span className="sr-only">{t("reply")}</span>
      </Button>

      <Button
        className={cn(comment.userId !== currentUser?._id && "hidden")}
        disabled={isPending}
        onClick={handleDelete}
        size="icon-sm"
        variant="ghost"
      >
        <Trash2Icon />
        <span className="sr-only">{t("delete")}</span>
      </Button>
    </div>
  );
}
