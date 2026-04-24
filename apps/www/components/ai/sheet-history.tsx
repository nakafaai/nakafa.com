"use client";

import {
  ChatSearch01Icon,
  Globe02Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { Authenticated, usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useAi } from "@/components/ai/context/use-ai";
import { useUser } from "@/lib/context/use-user";

/** Opens the recent Nina chat list when a user is signed in. */
export const SheetHistory = memo(() => {
  const user = useUser((state) => state.user);

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost">
          <HugeIcons icon={ChatSearch01Icon} />
          <span className="sr-only">History</span>
        </Button>
      </DropdownMenuTrigger>
      <Authenticated>
        <SheetHistoryContent userId={user.appUser._id} />
      </Authenticated>
    </DropdownMenu>
  );
});

/** Renders recent Nina chats in the header menu. */
const SheetHistoryContent = memo(({ userId }: { userId: Id<"users"> }) => {
  const t = useTranslations("Ai");
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const { results, status } = usePaginatedQuery(
    api.chats.queries.getChats,
    { userId, type: "study" },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage" || results.length === 0) {
    return null;
  }

  return (
    <DropdownMenuContent align="end" className="max-h-64">
      <DropdownMenuLabel>{t("recent-chats")}</DropdownMenuLabel>
      <DropdownMenuGroup>
        {results.map((chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <DropdownMenuItem
              className="cursor-pointer"
              key={chat._id}
              onSelect={() => {
                setActiveChatId(chat._id);
              }}
            >
              <HugeIcons icon={isPrivate ? SquareLock01Icon : Globe02Icon} />
              <span className="max-w-62.5 truncate">{chat.title}</span>
              <DropdownMenuShortcut>
                <HugeIcons
                  className={cn(
                    "transition-opacity ease-out",
                    activeChatId === chat._id ? "opacity-100" : "opacity-0"
                  )}
                  icon={Tick01Icon}
                />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
});
