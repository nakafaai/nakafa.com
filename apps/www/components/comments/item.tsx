"use client";

import type { Ref } from "@confect/core";
import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  Delete02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import type refs from "@repo/backend/confect/_generated/refs";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Activity, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { CommentsAdd } from "@/components/comments/add";
import {
  useDeleteCommentMutation,
  useVoteCommentMutation,
} from "@/components/comments/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

export type CommentWithUser = Ref.Returns<
  typeof refs.public.comments.queries.getCommentsBySlug
>["page"][number];
export type CommentDisplay = Pick<
  CommentWithUser,
  "text" | "user" | "replyToUser" | "replyToText" | "parentId"
> & {
  _id: string;
  _creationTime: number;
};

/** Compose one comment row with its optional reply editor. */
export function CommentItem({
  comment,
  submit,
}: {
  comment: CommentWithUser;
  submit: (text: string, parent: CommentWithUser) => Promise<boolean>;
}) {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2" id={comment._id}>
      <CommentContent comment={comment}>
        <CommentActions
          comment={comment}
          onReplyToggle={() => setIsReplyOpen((prev) => !prev)}
        />
      </CommentContent>
      <Activity mode={isReplyOpen ? "visible" : "hidden"}>
        <CommentsAdd
          closeButton={{
            onClick: () => setIsReplyOpen(false),
          }}
          onSubmit={(text) => submit(text, comment)}
        />
      </Activity>
    </div>
  );
}

/** Render one comment's identity, body, reply context, and actions. */
export function CommentContent({
  comment,
  children,
}: {
  comment: CommentDisplay;
  children?: ReactNode;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const user = useViewer((s) => s.account);
  const userId = comment.user?._id;
  const userName = comment.user?.name ?? t("anonymous");
  const userImage = comment.user?.image ?? "";
  const isReplyToMe = user && comment.replyToUser?._id === user.appUser._id;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl p-2 text-left transition-colors",
        !!isReplyToMe &&
          "rounded-l-none border-primary border-l bg-[color-mix(in_oklch,var(--accent)_3%,var(--background))]"
      )}
    >
      <Avatar className="size-10">
        <AvatarImage alt={userName} src={userImage} />
        <AvatarFallback>{getInitialName(userName)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <div className="flex min-w-0 items-center gap-2">
            {userId ? (
              <NavigationLink
                className="min-w-0 max-w-36 truncate font-medium text-sm transition-colors ease-out hover:text-primary"
                href={`/user/${userId}`}
                rel="noopener noreferrer"
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
            <MarkdownContent id={comment._id}>{comment.text}</MarkdownContent>
          </div>
        </div>

        {children ?? <div aria-hidden="true" className="h-8" />}
      </div>
    </div>
  );
}

/** Render optimistic vote, reply, and owner deletion controls. */
function CommentActions({
  comment,
  onReplyToggle,
}: {
  comment: CommentWithUser;
  onReplyToggle: () => void;
}) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Common");
  const user = useViewer((s) => s.account);
  const [isPending, startTransition] = useTransition();
  const voteOnComment = useVoteCommentMutation();
  const deleteComment = useDeleteCommentMutation();

  /** Toggle the viewer's selected vote. */
  function handleVote(vote: -1 | 1) {
    if (!user) {
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
                source: "components/comments/list",
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

  /** Delete the current user's comment. */
  function handleDelete() {
    if (!user) {
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
                source: "components/comments/list",
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
    <div className="flex -translate-x-2 flex-wrap items-center">
      {([1, -1] as const).map((vote) => {
        const positive = vote === 1;
        const count = positive ? comment.upvoteCount : comment.downvoteCount;
        const label = t(positive ? "like" : "dislike");
        const selected = comment.viewerVote === vote;
        return (
          <Tooltip key={vote}>
            <TooltipTrigger
              render={
                <Button
                  aria-label={label}
                  aria-pressed={selected}
                  className="group w-16"
                  disabled={isPending}
                  onClick={() => handleVote(vote)}
                  size="sm"
                  variant={selected ? "secondary" : "ghost"}
                >
                  <HugeIcons icon={positive ? ThumbsUpIcon : ThumbsDownIcon} />
                  <NumberFormat
                    className={cn(
                      "min-w-[3ch] text-xs tabular-nums tracking-tight",
                      count === 0 && "invisible"
                    )}
                    format={{ notation: "compact", maximumFractionDigits: 1 }}
                    isolate={true}
                    value={count}
                  />
                </Button>
              }
            />
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        );
      })}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={t("reply")}
              className="w-16"
              disabled={isPending}
              onClick={onReplyToggle}
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

/** Link a reply to its loaded parent comment when metadata is available. */
function ReplyToIndicator({ comment }: { comment: CommentDisplay }) {
  const { replyToUser, parentId, replyToText } = comment;
  if (!(replyToUser && parentId)) {
    return null;
  }

  /** Scroll the linked parent comment into the viewport. */
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
