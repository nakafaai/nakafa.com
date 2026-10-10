"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ChatSearch01Icon,
  Globe02Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import chats from "@repo/backend/confect/_generated/refs/chats";
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
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context";
import { Authenticated } from "@/components/auth/gate";
import { useViewer } from "@/lib/identity/client";

/** Opens the recent Nina chat list when a user is signed in. */
export function SheetHistory() {
  const t = useTranslations("Ai");
  const isPending = useViewer((state) => state.isPending);
  const viewer = useViewer((state) => state.viewer);
  if (isPending || viewer === null) {
    return null;
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="ghost">
            <HugeIcons icon={ChatSearch01Icon} />
            <span className="sr-only">{t("chat-history")}</span>
          </Button>
        }
      />
      <Authenticated>
        <SheetHistoryContent />
      </Authenticated>
    </DropdownMenu>
  );
}

/** Renders recent Nina chats in the header menu. */
function SheetHistoryContent() {
  const t = useTranslations("Ai");
  const activeChatId = useAi((state) => state.activeChatId);
  const setActiveChatId = useAi((state) => state.setActiveChatId);
  const pagination = usePaginatedQuery(
    chats.queries.getOwnChats,
    {
      type: "study",
    },
    {
      initialNumItems: 50,
    }
  );
  const { results } = pagination;
  if (
    PaginatedQueryResult.isLoadingFirstPage(pagination) ||
    results.length === 0
  ) {
    return null;
  }
  return (
    <DropdownMenuContent align="end" className="max-h-64 w-72">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t("recent-chats")}</DropdownMenuLabel>
        {Arr.map(results, (chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <DropdownMenuItem
              className="cursor-pointer"
              key={chat._id}
              onClick={() => {
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
}
