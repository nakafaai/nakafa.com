"use client";

import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  FileIcon,
  WinkIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { PostAttachment } from "@repo/backend/convex/classes/forums/utils";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn, formatFileSize } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Activity, memo, useState, useTransition } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/types";
import { useForum } from "@/lib/context/use-forum";
import { useForumScrollContext } from "@/lib/context/use-forum-scroll";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

export const ForumPostItem = memo(
  ({
    post,
    isFirstInGroup,
    currentUserId,
  }: {
    post: ForumPost;
    isFirstInGroup: boolean;
    currentUserId: Id<"users">;
  }) => {
    const t = useTranslations("Common");
    const locale = useLocale();

    const replyTo = useForum((f) => f.replyTo);
    const isReplyTo = replyTo?.postId === post._id;
    const userName = post.user?.name ?? t("anonymous");
    const userImage = post.user?.image ?? "";

    const isReplyToMe = post.replyToUserId === currentUserId;

    return (
      <div
        className={cn(
          "group relative flex items-start gap-3 border-l-2 border-l-transparent px-4 py-2 transition-colors ease-out hover:bg-accent/20",
          isReplyToMe === true && "border-primary bg-primary/10",
          isReplyTo === true && "border-secondary bg-secondary/10"
        )}
        id={post._id}
      >
        <PostItemActions post={post} />

        <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
          <Avatar className="size-8 shrink-0">
            <AvatarImage alt={userName} role="presentation" src={userImage} />
            <AvatarFallback>{getInitialName(userName)}</AvatarFallback>
          </Avatar>
        </Activity>
        <Activity mode={isFirstInGroup === true ? "hidden" : "visible"}>
          <time
            className="mt-0.5 w-8 shrink-0 text-center text-muted-foreground text-xs"
            title={format(post._creationTime, "PPpp", {
              locale: getLocale(locale),
            })}
          >
            {format(post._creationTime, "HH:mm", { locale: getLocale(locale) })}
          </time>
        </Activity>

        <div className="grid min-w-0 flex-1 gap-2">
          <div className="grid gap-1">
            <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate font-medium text-sm">
                  {userName}
                </span>
                <time
                  className="min-w-0 truncate text-muted-foreground text-xs tracking-tight"
                  title={format(post._creationTime, "PPpp", {
                    locale: getLocale(locale),
                  })}
                >
                  {format(post._creationTime, "HH:mm", {
                    locale: getLocale(locale),
                  })}
                </time>
              </div>
            </Activity>

            <PostReplyIndicator post={post} />

            <Activity mode={post.body.trim() ? "visible" : "hidden"}>
              <div className="wrap-break-word min-w-0 text-chat">
                <Response id={post._id}>{post.body}</Response>
              </div>
            </Activity>

            <PostAttachments attachments={post.attachments} />
          </div>

          <PostReactions post={post} />
        </div>
      </div>
    );
  }
);
ForumPostItem.displayName = "ForumPostItem";

const PostReactions = memo(({ post }: { post: ForumPost }) => {
  const t = useTranslations("Common");

  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(
    api.classes.forums.mutations.togglePostReaction
  );

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ postId: post._id, emoji });
    });
  };

  if (post.reactionUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {post.reactionUsers.map(({ emoji, count, reactors }) => {
        const isMyReaction = post.myReactions.includes(emoji);
        const moreCount = count - reactors.length;

        return (
          <HoverCard key={emoji}>
            <HoverCardTrigger asChild>
              <Button
                disabled={isPending}
                onClick={() => handleToggleReaction(emoji)}
                size="sm"
                variant={isMyReaction === true ? "default-outline" : "outline"}
              >
                {emoji}
                <span className="tracking-tight">{count}</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              className="w-auto max-w-64"
              side="top"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl">{emoji}</span>
                <p className="line-clamp-2 text-sm leading-tight">
                  {moreCount > 0
                    ? t("reacted-by-more", {
                        names: reactors.join(", "),
                        count: moreCount,
                      })
                    : t("reacted-by", { names: reactors.join(", ") })}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
});
PostReactions.displayName = "PostReactions";

const PostAttachments = memo(
  ({ attachments }: { attachments: PostAttachment[] }) => {
    if (attachments.length === 0) {
      return null;
    }

    const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
    const files = attachments.filter((a) => !a.mimeType.startsWith("image/"));

    return (
      <div className="flex flex-col gap-1">
        {images.map((attachment) => (
          <a
            className="group/image relative block h-40 w-full max-w-xs overflow-hidden rounded-sm border bg-muted sm:h-48"
            href={attachment.url ?? "#"}
            key={attachment._id}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Image
              alt={attachment.name}
              className="object-cover transition-transform ease-out group-hover/image:scale-105"
              fetchPriority="high"
              fill
              loading="eager"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              src={attachment.url ?? ""}
            />
          </a>
        ))}

        <div className="flex flex-wrap gap-1">
          {files.map((attachment) => (
            <a
              className="group/file flex items-center gap-2 rounded-sm border bg-background p-2 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              href={attachment.url ?? "#"}
              key={attachment._id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="flex size-8 items-center justify-center rounded-sm bg-muted">
                <HugeIcons
                  className="size-4 text-muted-foreground"
                  icon={FileIcon}
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="max-w-30 truncate font-medium text-xs">
                  {attachment.name}
                </span>
                <span className="text-[10px] text-muted-foreground group-hover/file:text-accent-foreground">
                  {formatFileSize(attachment.size)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }
);
PostAttachments.displayName = "PostAttachments";

const PostReplyIndicator = memo(({ post }: { post: ForumPost }) => {
  const { parentId, replyToUser, replyToBody } = post;
  const forumScroll = useForumScrollContext();

  if (!(parentId && replyToUser)) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    forumScroll?.jumpToPostId(parentId);
  };

  return (
    <button
      className="flex min-w-0 cursor-pointer items-center gap-1 text-left text-muted-foreground text-xs transition-colors ease-out hover:text-foreground"
      onClick={handleClick}
      type="button"
    >
      <HugeIcons className="size-3 shrink-0" icon={ArrowTurnForwardIcon} />
      <span className="max-w-32 shrink-0 truncate text-primary">
        {replyToUser.name}
      </span>
      <Activity mode={replyToBody ? "visible" : "hidden"}>
        <span className="min-w-0 flex-1 truncate">{replyToBody}</span>
      </Activity>
    </button>
  );
});
PostReplyIndicator.displayName = "PostReplyIndicator";

const PostItemActions = memo(({ post }: { post: ForumPost }) => {
  const t = useTranslations("Common");
  const setReplyTo = useForum((f) => f.setReplyTo);

  const userName = post.user?.name ?? t("anonymous");

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleReaction = useMutation(
    api.classes.forums.mutations.togglePostReaction
  );

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ postId: post._id, emoji });
    });
  };

  return (
    <ButtonGroup
      className={cn(
        "absolute -top-4 right-4 z-1 opacity-0 shadow-xs transition-opacity ease-out group-hover:opacity-100",
        !!isOpen && "opacity-100"
      )}
    >
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger asChild>
                <Button disabled={isPending} size="icon" variant="outline">
                  <HugeIcons icon={WinkIcon} />
                  <span className="sr-only">{t("reaction")}</span>
                </Button>
              </PopoverTrigger>
            }
          />
          <TooltipContent side="top">{t("reaction")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-fit p-0">
          <EmojiPicker
            className="h-80"
            onEmojiSelect={({ emoji }) => {
              handleToggleReaction(emoji);
              setIsOpen(false);
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() => setReplyTo({ postId: post._id, userName })}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={ArrowTurnBackwardIcon} />
              <span className="sr-only">{t("reply")}</span>
            </Button>
          }
        />
        <TooltipContent side="top">{t("reply")}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
});
PostItemActions.displayName = "PostItemActions";
