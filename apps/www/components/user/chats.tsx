"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownIcon,
  EllipsisIcon,
  GlobeIcon,
  LockIcon,
  TrashIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { getLocale } from "@/lib/utils/date";

export function UserChats({ userId }: { userId: Id<"users"> }) {
  const user = useQuery(api.auth.getCurrentUser);
  if (!user) {
    return null;
  }

  return (
    <UserChatsList
      userId={user.appUser._id}
      // If userId is not the current user, only show public chats
      visibility={userId !== user.appUser._id ? "public" : undefined}
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
  const chats = useQuery(api.chats.queries.getChats, { userId, visibility });

  const locale = useLocale();

  if (!chats) {
    return null;
  }

  if (chats.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        {t("no-chats")}
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y overflow-hidden rounded-xl border shadow-sm">
      {chats.map((chat) => {
        const isPrivate = chat.visibility === "private";
        return (
          <div
            className="group relative flex items-center justify-between gap-2 px-4 py-2 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
            key={chat._id}
          >
            <NavigationLink
              className="absolute inset-0"
              href={`/chat/${chat._id}`}
            />
            <div className="flex items-center gap-2">
              {isPrivate ? (
                <LockIcon className="size-4 shrink-0" />
              ) : (
                <GlobeIcon className="size-4 shrink-0" />
              )}
              <span className="line-clamp-1">{chat.title}</span>
              <ArrowDownIcon className="-rotate-90 size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100" />
            </div>

            <div className="flex items-center gap-2">
              <time className="text-muted-foreground text-sm group-hover:text-accent-foreground/80">
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
    startTransition(async () => {
      await deleteChat({ chatId: chat._id });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="z-1 hover:bg-background hover:text-foreground hover:[&_svg]:text-foreground"
          size="icon-sm"
          variant="ghost"
        >
          <EllipsisIcon className="size-4" />
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
          <TrashIcon className="size-4" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
