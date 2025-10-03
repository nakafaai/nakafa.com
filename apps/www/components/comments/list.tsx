"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
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
import { ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { getInitialName } from "@/lib/utils/helper";

type Comment = Doc<"comments">;

type Props = {
  slug: string;
};

export function CommentsList({ slug }: Props) {
  const t = useTranslations("Common");

  const { results } = usePaginatedQuery(
    api.comments.queries.getParentCommentsBySlug,
    { slug },
    { initialNumItems: 25 }
  );

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="divide-y rounded-xl border shadow-sm">
      {results.map((comment) => {
        const userName = comment.user?.name ?? t("anonymous");
        const userImage = comment.user?.image ?? "";

        return (
          <div className="p-3" key={comment._id}>
            <div className="flex items-start gap-4 text-left">
              <Avatar className="size-10 rounded-full">
                <AvatarImage alt={userName} src={userImage} />
                <AvatarFallback className="rounded-lg">
                  {getInitialName(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-2">
                <div className="grid">
                  <span className="truncate font-medium text-xs">
                    {userName}
                  </span>
                  <Response id={comment._id}>{comment.text}</Response>
                </div>

                <CommentAction comment={comment} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentAction({ comment }: { comment: Comment }) {
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
        disabled={isPending}
        onClick={() => handleVote(1)}
        size="sm"
        variant="ghost"
      >
        <ThumbsUpIcon />
        <NumberFormat
          className="font-mono text-muted-foreground text-xs tracking-tight"
          value={comment.upvoteCount}
        />
      </Button>
      <Button
        disabled={isPending}
        onClick={() => handleVote(-1)}
        size="sm"
        variant="ghost"
      >
        <ThumbsDownIcon />
        <NumberFormat
          className="font-mono text-muted-foreground text-xs tracking-tight"
          value={comment.downvoteCount}
        />
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
