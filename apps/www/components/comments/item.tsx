"use client";

import type { Ref } from "@confect/core";
import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
} from "@hugeicons/core-free-icons";
import type comments from "@repo/backend/confect/_generated/refs/comments";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import { Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Activity, type ReactNode, useState } from "react";
import {
  CommentActionsProvider,
  CommentCount,
  CommentDelete,
  CommentVotes,
  useCommentActions,
} from "@/components/comments/actions";
import { CommentsAdd } from "@/components/comments/add";
import { getLocale } from "@/lib/i18n/date";
import { useViewer } from "@/lib/identity/client";
import { getInitialName } from "@/lib/identity/initials";

export type CommentWithUser = Ref.Returns<
  typeof comments.queries.getCommentsBySlug
>["page"][number];
const CommentDisplayIdentitySchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Finite,
});

export type CommentDisplay = Pick<
  CommentWithUser,
  "text" | "user" | "replyToUser" | "replyToText" | "parentId"
> &
  typeof CommentDisplayIdentitySchema.Type;

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
        <CommentActionsProvider comment={comment}>
          <div className="flex -translate-x-2 flex-wrap items-center">
            <CommentVotes />
            <CommentReplyToggle
              onReplyToggle={() => setIsReplyOpen((prev) => !prev)}
              replyCount={comment.replyCount}
            />
            <CommentDelete />
          </div>
        </CommentActionsProvider>
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

/** Opens the reply editor; it disables while another action runs. */
function CommentReplyToggle({
  onReplyToggle,
  replyCount,
}: {
  onReplyToggle: () => void;
  replyCount: number;
}) {
  const t = useTranslations("Common");
  const isPending = useCommentActions((actions) => actions.isPending);

  return (
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
            <CommentCount value={replyCount} />
          </Button>
        }
      />
      <TooltipContent side="bottom">{t("reply")}</TooltipContent>
    </Tooltip>
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
