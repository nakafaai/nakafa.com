"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getLocale } from "@/lib/utils/date";

export function UserChats({ userId }: { userId: Id<"users"> }) {
  const user = useQuery(api.auth.getCurrentUser);
  if (!user) {
    return null;
  }

  return (
    <UserChatsList
      userId={user.appUser._id}
      visibility={userId !== user.appUser._id ? "private" : undefined}
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
    return <p className="text-muted-foreground text-sm">{t("no-chats")}</p>;
  }

  return (
    <div className="flex flex-col divide-y rounded-xl border shadow-sm">
      {chats.map((chat) => (
        <NavigationLink
          className="group flex items-center justify-between gap-2 px-4 py-3 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
          href={`/chat/${chat._id}`}
          key={chat._id}
        >
          <div className="flex items-center gap-2">
            <span className="line-clamp-1">{chat.title}</span>
            <ArrowDownIcon className="-rotate-90 size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100" />
          </div>

          <time className="text-muted-foreground text-sm group-hover:text-accent-foreground/80">
            {formatDistanceToNow(chat.updatedAt, {
              locale: getLocale(locale),
              addSuffix: true,
            })}
          </time>
        </NavigationLink>
      ))}
    </div>
  );
}
