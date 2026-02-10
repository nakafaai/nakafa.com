"use client";

import {
  ArrowDown02Icon,
  Delete02Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useMutation, usePaginatedQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useUser } from "@/lib/context/use-user";
import { getLocale } from "@/lib/utils/date";

export function UserChats({ userId }: { userId: Id<"users"> }) {
  const user = useUser((state) => state.user);

  // Determine if viewing own profile or someone else's
  const isOwnProfile = user?.appUser._id === userId;

  return (
    <UserChatsList
      userId={userId}
      // If viewing own profile, show all chats; otherwise only public ones
      visibility={isOwnProfile ? undefined : "public"}
    />
  );
}

export function UserChatsList({
  userId,
  visibility,
}: {
  userId: Id<"users">;
  visibility?: "public" | "private";
}) {
  const t = useTranslations("Common");
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getChats,
    { userId, visibility, type: "study" },
    { initialNumItems: 50 }
  );

  const locale = useLocale();

  if (status === "LoadingFirstPage") {
    return <Skeleton className="h-12 w-full rounded-xl border shadow-sm" />;
  }

  if (results.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        {t("no-chats")}
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {results.map((chat) => {
        const isPrivate = chat.visibility === "private";
        return (
          <div
            className="group relative flex flex-col justify-between gap-2 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground sm:flex-row sm:items-center"
            key={chat._id}
          >
            <NavigationLink
              className="absolute inset-0 z-1"
              href={`/chat/${chat._id}`}
            />
            <div className="flex flex-1 items-center gap-2">
              <HugeIcons
                className="size-4 shrink-0"
                icon={isPrivate ? SquareLock01Icon : Globe02Icon}
              />
              <span className="truncate text-sm">{chat.title}</span>
              <HugeIcons
                className="size-4 shrink-0 -rotate-90 opacity-0 transition-opacity ease-out group-hover:opacity-100"
                icon={ArrowDown02Icon}
              />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2">
              <time className="truncate text-muted-foreground text-sm tracking-tight group-hover:text-accent-foreground/80">
                {formatDistanceToNow(chat.updatedAt, {
                  locale: getLocale(locale),
                  addSuffix: true,
                })}
              </time>
              <UserChatsListActions chat={chat} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserChatsListActions({ chat }: { chat: Doc<"chats"> }) {
  const t = useTranslations("Common");

  const deleteChat = useMutation(api.chats.mutations.deleteChat);

  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => {
      deleteChat({ chatId: chat._id });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="z-2 hover:bg-background hover:text-foreground hover:[&_svg]:text-foreground"
          disabled={isPending}
          size="icon-sm"
          variant="ghost"
        >
          <HugeIcons icon={MoreHorizontalIcon} />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={isPending}
          onSelect={handleDelete}
          variant="destructive"
        >
          <HugeIcons icon={Delete02Icon} />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
