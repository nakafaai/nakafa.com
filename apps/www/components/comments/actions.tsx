"use client";

import type { Ref } from "@confect/core";
import {
  Delete02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import type comments from "@repo/backend/confect/_generated/refs/comments";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "cn";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, use, useTransition } from "react";
import { toast } from "sonner";
import {
  useDeleteCommentMutation,
  useVoteCommentMutation,
} from "@/components/comments/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/** The fields of a comment that its viewer actions read, in every feed. */
type ActionComment = Pick<
  Ref.Returns<typeof comments.queries.getCommentsBySlug>["page"][number],
  "_id" | "downvoteCount" | "upvoteCount" | "userId" | "viewerVote"
>;

type CommentVote = -1 | 1;

const CommentActionsContext = createContext<CommentActionsValue | null>(null);

/**
 * Owns a comment's vote and delete mutations and their shared pending state,
 * so every composed action disables together while one of them runs.
 */
export function CommentActionsProvider({
  children,
  comment,
}: {
  children: ReactNode;
  comment: ActionComment;
}) {
  const actions = useCommentActionsValue(comment);

  return (
    <CommentActionsContext value={actions}>{children}</CommentActionsContext>
  );
}

/** Builds one comment's actions and their shared pending state from its mutations. */
function useCommentActionsValue(comment: ActionComment) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const viewer = useViewer((state) => state.account);
  const [isPending, startTransition] = useTransition();
  const voteOnComment = useVoteCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  /** Runs one signed-in action and tells the learner when it fails. */
  function run<A, E>(action: Effect.Effect<A, E>) {
    if (!viewer) {
      return;
    }
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(action).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/comments/actions",
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

  /** Toggles the viewer's vote, clearing it when the same vote repeats. */
  function vote(value: CommentVote) {
    run(
      Effect.tryPromise(() =>
        voteOnComment({
          commentId: comment._id,
          vote: comment.viewerVote === value ? 0 : value,
        })
      ).pipe(Effect.flatMap(Effect.fromResult))
    );
  }

  /** Deletes the viewer's own comment. */
  function remove() {
    run(
      Effect.tryPromise(() => deleteComment({ commentId: comment._id })).pipe(
        Effect.flatMap(Effect.fromResult)
      )
    );
  }

  return { comment, isPending, remove, vote };
}

/** The value every comment action reads, as the hook that builds it returns it. */
type CommentActionsValue = ReturnType<typeof useCommentActionsValue>;

/** Selects one part of the surrounding comment's actions. */
export function useCommentActions<T>(
  selector: (actions: CommentActionsValue) => T
) {
  const value = use(CommentActionsContext);
  if (!value) {
    throw new Error(
      "Comment actions must render within CommentActionsProvider."
    );
  }
  return selector(value);
}

/** A vote or reply count that keeps its width and hides at zero. */
export function CommentCount({ value }: { value: number }) {
  return (
    <NumberFormat
      className={cn(
        "min-w-[3ch] text-xs tabular-nums tracking-tight",
        value === 0 && "invisible"
      )}
      format={{ notation: "compact", maximumFractionDigits: 1 }}
      isolate={true}
      value={value}
    />
  );
}

/** The like and dislike toggles with their counts. */
export function CommentVotes() {
  return (
    <>
      <CommentVoteButton vote={1} />
      <CommentVoteButton vote={-1} />
    </>
  );
}

/** One vote toggle whose count and pressed state follow the comment. */
function CommentVoteButton({ vote }: { vote: CommentVote }) {
  const t = useTranslations("Common");
  const positive = vote === 1;
  const count = useCommentActions(({ comment }) =>
    positive ? comment.upvoteCount : comment.downvoteCount
  );
  const selected = useCommentActions(
    ({ comment }) => comment.viewerVote === vote
  );
  const isPending = useCommentActions((actions) => actions.isPending);
  const onVote = useCommentActions((actions) => actions.vote);
  const label = t(positive ? "like" : "dislike");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={selected}
            className="group w-16"
            disabled={isPending}
            onClick={() => onVote(vote)}
            size="sm"
            variant={selected ? "secondary" : "ghost"}
          >
            <HugeIcons icon={positive ? ThumbsUpIcon : ThumbsDownIcon} />
            <CommentCount value={count} />
          </Button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Deletes the comment; only its author can see the control. */
export function CommentDelete() {
  const t = useTranslations("Common");
  const viewerId = useViewer((state) => state.account?.appUser._id);
  const authorId = useCommentActions(({ comment }) => comment.userId);
  const isPending = useCommentActions((actions) => actions.isPending);
  const remove = useCommentActions((actions) => actions.remove);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className={cn(authorId !== viewerId && "hidden")}
            disabled={isPending}
            onClick={remove}
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
  );
}
