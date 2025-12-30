"use client";

import { WinkIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
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
import { useMutation } from "convex/react";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { memo, useState, useTransition } from "react";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

export const ForumHeader = memo(({ forum }: { forum: Forum }) => {
  const t = useTranslations("Common");
  const locale = useLocale();

  const userName = forum.user?.name ?? t("anonymous");
  const userImage = forum.user?.image ?? "";

  return (
    <div className="group flex items-start gap-3 border-primary border-l-2 bg-primary/10 p-4">
      <Avatar className="size-8 shrink-0 rounded-full">
        <AvatarImage alt={userName} role="presentation" src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>

      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-medium text-sm">
              {userName}
            </span>
            <time className="min-w-0 truncate text-muted-foreground text-xs tracking-tight">
              {format(forum._creationTime, "HH:mm", {
                locale: getLocale(locale),
              })}
            </time>
          </div>

          <div className="wrap-break-word min-w-0 text-chat">
            <Response id={forum._id}>{forum.body}</Response>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ForumReactions forum={forum} />
          <ForumActions forum={forum} />
        </div>
      </div>
    </div>
  );
});
ForumHeader.displayName = "ForumHeader";

const ForumReactions = memo(({ forum }: { forum: Forum }) => {
  const t = useTranslations("Common");

  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(
    api.classes.forums.mutations.toggleForumReaction
  );

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ forumId: forum._id, emoji });
    });
  };

  if (forum.reactionUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {forum.reactionUsers.map(({ emoji, count, reactors }) => {
        const isMyReaction = forum.myReactions.includes(emoji);
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
ForumReactions.displayName = "ForumReactions";

const ForumActions = memo(({ forum }: { forum: Forum }) => {
  const t = useTranslations("Common");

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(
    api.classes.forums.mutations.toggleForumReaction
  );

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ forumId: forum._id, emoji });
    });
  };

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger asChild>
              <Button disabled={isPending} size="icon-sm" variant="outline">
                <HugeIcons icon={WinkIcon} />
                <span className="sr-only">{t("reaction")}</span>
              </Button>
            </PopoverTrigger>
          }
        />
        <TooltipContent side="top">{t("reaction")}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-fit p-0">
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
  );
});
ForumActions.displayName = "ForumActions";
